#!/bin/bash

# ==============================================================================
# KIOSK LICENSE SERVER - COMPREHENSIVE API TESTING SCRIPT v2
# ==============================================================================
# Description: Tests all 16 API endpoints of the License Server
# Usage: ./test-all-endpoints.sh
# ==============================================================================

# DO NOT use set -e - we want to continue on failures
# set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3001"
ADMIN_EMAIL="admin@kiosk.local"
ADMIN_PASSWORD="Admin123!"

# Test data
LICENSE_KEY="3VBN-8ZQ9-1MKO-AK0R"  # PRO license from seed
DEVICE_ID="test-device-$(date +%s)"
DEVICE_NAME="Test Device Auto"
APP_TYPE="editor"

# Global variables to store tokens and IDs
DEVICE_TOKEN=""
ADMIN_TOKEN=""
CREATED_DEVICE_ID=""
CREATED_LICENSE_ID=""

# Test results tracking
PASSED=0
FAILED=0
SKIPPED=0

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ SUCCESS:${NC} $1"
}

print_error() {
    echo -e "${RED}✗ ERROR:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠ WARNING:${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ INFO:${NC} $1"
}

print_response() {
    echo -e "${NC}Response:${NC}"
    if command -v jq &> /dev/null; then
        echo "$1" | jq '.' 2>/dev/null || echo "$1"
    else
        echo "$1"
    fi
    echo ""
}

increment_passed() {
    PASSED=$((PASSED + 1))
}

increment_failed() {
    FAILED=$((FAILED + 1))
}

increment_skipped() {
    SKIPPED=$((SKIPPED + 1))
}

# ==============================================================================
# TEST FUNCTIONS
# ==============================================================================

# Test 1: Health Check
test_health_check() {
    print_header "TEST 1: Health Check"
    print_test "GET /health"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Health check passed"
        print_response "$body"
        increment_passed
    else
        print_error "Health check failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 2: Server Info
test_server_info() {
    print_header "TEST 2: Server Info"
    print_test "GET /"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Server info retrieved"
        print_response "$body"
        increment_passed
    else
        print_error "Server info failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 3: License Activation
test_license_activation() {
    print_header "TEST 3: License Activation"
    print_test "POST /api/license/activate"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/activate" \
        -H "Content-Type: application/json" \
        -d "{
            \"licenseKey\": \"$LICENSE_KEY\",
            \"deviceId\": \"$DEVICE_ID\",
            \"appType\": \"$APP_TYPE\",
            \"deviceName\": \"$DEVICE_NAME\"
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        print_success "Device activated successfully"
        print_response "$body"
        
        # Extract token for future tests
        if command -v jq &> /dev/null; then
            DEVICE_TOKEN=$(echo "$body" | jq -r '.token' 2>/dev/null)
            CREATED_DEVICE_ID=$(echo "$body" | jq -r '.device.id' 2>/dev/null)
        fi
        
        if [ -n "$DEVICE_TOKEN" ] && [ "$DEVICE_TOKEN" != "null" ]; then
            print_info "Saved device token for future tests"
            print_info "Device ID (UUID): $CREATED_DEVICE_ID"
            print_info "Device ID (string): $DEVICE_ID"
        fi
        increment_passed
    else
        print_error "License activation failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 4: Token Validation
test_token_validation() {
    print_header "TEST 4: Token Validation"
    print_test "POST /api/license/validate"
    
    if [ -z "$DEVICE_TOKEN" ] || [ "$DEVICE_TOKEN" = "null" ]; then
        print_warning "No device token available. Skipping test."
        increment_skipped
        return
    fi
    
    if [ -z "$DEVICE_ID" ]; then
        print_warning "No device ID available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/validate" \
        -H "Content-Type: application/json" \
        -d "{
            \"token\": \"$DEVICE_TOKEN\",
            \"deviceId\": \"$DEVICE_ID\"
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Token validated successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Token validation failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 5: Token Refresh
test_token_refresh() {
    print_header "TEST 5: Token Refresh"
    print_test "POST /api/license/refresh"
    
    if [ -z "$DEVICE_TOKEN" ] || [ "$DEVICE_TOKEN" = "null" ]; then
        print_warning "No device token available. Skipping test."
        increment_skipped
        return
    fi
    
    if [ -z "$DEVICE_ID" ]; then
        print_warning "No device ID available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/refresh" \
        -H "Content-Type: application/json" \
        -d "{
            \"deviceId\": \"$DEVICE_ID\",
            \"oldToken\": \"$DEVICE_TOKEN\"
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Token refreshed successfully"
        print_response "$body"
        
        # Update token
        if command -v jq &> /dev/null; then
            NEW_TOKEN=$(echo "$body" | jq -r '.token' 2>/dev/null)
            if [ "$NEW_TOKEN" != "null" ] && [ -n "$NEW_TOKEN" ]; then
                DEVICE_TOKEN="$NEW_TOKEN"
                print_info "Updated device token"
            fi
        fi
        increment_passed
    else
        print_error "Token refresh failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 6: Admin Login
test_admin_login() {
    print_header "TEST 6: Admin Login"
    print_test "POST /api/admin/login"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$ADMIN_EMAIL\",
            \"password\": \"$ADMIN_PASSWORD\"
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Admin login successful"
        print_response "$body"
        
        # Extract admin token
        if command -v jq &> /dev/null; then
            ADMIN_TOKEN=$(echo "$body" | jq -r '.token' 2>/dev/null)
        fi
        
        if [ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
            print_info "Saved admin token for future tests"
        fi
        increment_passed
    else
        print_error "Admin login failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 7: Get All Licenses
test_get_licenses() {
    print_header "TEST 7: Get All Licenses"
    print_test "GET /api/admin/licenses"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/licenses" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Licenses retrieved successfully"
        print_response "$body"
        
        # Save first license ID for later tests
        if command -v jq &> /dev/null; then
            CREATED_LICENSE_ID=$(echo "$body" | jq -r '.data[0].id' 2>/dev/null)
            if [ -n "$CREATED_LICENSE_ID" ] && [ "$CREATED_LICENSE_ID" != "null" ]; then
                print_info "Saved license ID: $CREATED_LICENSE_ID"
            fi
        fi
        increment_passed
    else
        print_error "Get licenses failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 8: Get License by ID
test_get_license_by_id() {
    print_header "TEST 8: Get License by ID"
    print_test "GET /api/admin/licenses/:id"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    if [ -z "$CREATED_LICENSE_ID" ] || [ "$CREATED_LICENSE_ID" = "null" ]; then
        print_warning "No license ID available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/licenses/$CREATED_LICENSE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "License details retrieved successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Get license by ID failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 9: Create New License
test_create_license() {
    print_header "TEST 9: Create New License"
    print_test "POST /api/admin/licenses"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    # Get organization ID from existing license
    ORG_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/licenses" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    if command -v jq &> /dev/null; then
        ORG_ID=$(echo "$ORG_RESPONSE" | jq -r '.data[0].organizationId' 2>/dev/null)
    fi
    
    if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
        print_warning "Could not get organization ID. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/licenses" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"organizationId\": \"$ORG_ID\",
            \"plan\": \"BASIC\",
            \"seatsEditor\": 2,
            \"seatsPlayer\": 5,
            \"validUntil\": \"2027-12-31T23:59:59Z\"
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "201" ]; then
        print_success "License created successfully"
        print_response "$body"
        
        # Save new license ID
        if command -v jq &> /dev/null; then
            NEW_LICENSE_ID=$(echo "$body" | jq -r '.id' 2>/dev/null)
            if [ -n "$NEW_LICENSE_ID" ] && [ "$NEW_LICENSE_ID" != "null" ]; then
                print_info "New license ID: $NEW_LICENSE_ID"
            fi
        fi
        increment_passed
    else
        print_error "Create license failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 10: Update License
test_update_license() {
    print_header "TEST 10: Update License"
    print_test "PATCH /api/admin/licenses/:id"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    if [ -z "$CREATED_LICENSE_ID" ] || [ "$CREATED_LICENSE_ID" = "null" ]; then
        print_warning "No license ID available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/admin/licenses/$CREATED_LICENSE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"seatsEditor\": 25
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "License updated successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Update license failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 11: Get All Devices
test_get_devices() {
    print_header "TEST 11: Get All Devices"
    print_test "GET /api/admin/devices"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/devices" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Devices retrieved successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Get devices failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 12: Get Admin Stats
test_admin_stats() {
    print_header "TEST 12: Admin Statistics"
    print_test "GET /api/admin/stats"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/stats" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Statistics retrieved successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Get stats failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 13: Get Audit Logs
test_audit_logs() {
    print_header "TEST 13: Audit Logs"
    print_test "GET /api/admin/audit"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/audit?limit=10" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Audit logs retrieved successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Get audit logs failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 14: License Deactivation
test_license_deactivation() {
    print_header "TEST 14: License Deactivation"
    print_test "POST /api/license/deactivate"
    
    if [ -z "$DEVICE_TOKEN" ] || [ "$DEVICE_TOKEN" = "null" ]; then
        print_warning "No device token available. Skipping test."
        increment_skipped
        return
    fi
    
    if [ -z "$DEVICE_ID" ]; then
        print_warning "No device ID available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/deactivate" \
        -H "Content-Type: application/json" \
        -d "{
            \"deviceId\": \"$DEVICE_ID\",
            \"licenseKey\": \"$LICENSE_KEY\"
        }" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Device deactivated successfully"
        print_response "$body"
        increment_passed
    else
        print_error "License deactivation failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# Test 15: Delete Device (Admin)
test_delete_device() {
    print_header "TEST 15: Delete Device"
    print_test "DELETE /api/admin/devices/:id"
    
    if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
        print_warning "No admin token available. Skipping test."
        increment_skipped
        return
    fi
    
    if [ -z "$CREATED_DEVICE_ID" ] || [ "$CREATED_DEVICE_ID" = "null" ]; then
        print_warning "No device ID available. Skipping test."
        increment_skipped
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/admin/devices/$CREATED_DEVICE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        print_success "Device deleted successfully"
        print_response "$body"
        increment_passed
    else
        print_error "Delete device failed (HTTP $http_code)"
        print_response "$body"
        increment_failed
    fi
}

# ==============================================================================
# MAIN TEST EXECUTION
# ==============================================================================

main() {
    print_header "KIOSK LICENSE SERVER - API TESTING"
    print_info "Base URL: $BASE_URL"
    print_info "Test Device ID: $DEVICE_ID"
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed. JSON parsing will be limited."
        print_info "Install with: sudo apt install jq -y"
    fi
    
    # Check if server is running
    print_info "Checking server connectivity..."
    if ! curl -s --connect-timeout 5 "$BASE_URL/health" > /dev/null 2>&1; then
        print_error "Cannot connect to server at $BASE_URL"
        print_info "Make sure the server is running: sudo systemctl status kiosk-license-server"
        exit 1
    fi
    print_success "Server is reachable"
    echo ""
    
    # Run all tests
    test_health_check
    sleep 0.5
    
    test_server_info
    sleep 0.5
    
    test_license_activation
    sleep 0.5
    
    test_token_validation
    sleep 0.5
    
    test_token_refresh
    sleep 0.5
    
    test_admin_login
    sleep 0.5
    
    test_get_licenses
    sleep 0.5
    
    test_get_license_by_id
    sleep 0.5
    
    test_create_license
    sleep 0.5
    
    test_update_license
    sleep 0.5
    
    test_get_devices
    sleep 0.5
    
    test_admin_stats
    sleep 0.5
    
    test_audit_logs
    sleep 0.5
    
    test_license_deactivation
    sleep 0.5
    
    test_delete_device
    
    # Print summary
    print_header "TEST SUMMARY"
    echo -e "${GREEN}✓ Passed:  $PASSED${NC}"
    echo -e "${RED}✗ Failed:  $FAILED${NC}"
    echo -e "${YELLOW}⚠ Skipped: $SKIPPED${NC}"
    echo ""
    
    total=$((PASSED + FAILED + SKIPPED))
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! ($PASSED/$total)${NC}"
        exit 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED ($FAILED/$total failed)${NC}"
        exit 1
    fi
}

# Check if script is being sourced or executed
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
