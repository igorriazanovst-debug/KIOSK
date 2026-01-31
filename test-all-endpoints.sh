#!/bin/bash

# ==============================================================================
# KIOSK LICENSE SERVER - COMPREHENSIVE API TESTING SCRIPT
# ==============================================================================
# Description: Tests all 16 API endpoints of the License Server
# Usage: ./test-all-endpoints.sh
# ==============================================================================

set -e

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

print_info() {
    echo -e "${YELLOW}ℹ INFO:${NC} $1"
}

print_response() {
    echo -e "${NC}Response:${NC}"
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
    echo ""
}

# ==============================================================================
# TEST FUNCTIONS
# ==============================================================================

# Test 1: Health Check
test_health_check() {
    print_header "TEST 1: Health Check"
    print_test "GET /health"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Health check passed"
        print_response "$body"
        return 0
    else
        print_error "Health check failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 2: Server Info
test_server_info() {
    print_header "TEST 2: Server Info"
    print_test "GET /"
    
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Server info retrieved"
        print_response "$body"
        return 0
    else
        print_error "Server info failed (HTTP $http_code)"
        print_response "$body"
        return 1
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
        }")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Device activated successfully"
        print_response "$body"
        
        # Extract token for future tests
        DEVICE_TOKEN=$(echo "$body" | jq -r '.token' 2>/dev/null)
        CREATED_DEVICE_ID=$(echo "$body" | jq -r '.device.id' 2>/dev/null)
        
        print_info "Saved device token for future tests"
        print_info "Device ID: $CREATED_DEVICE_ID"
        return 0
    else
        print_error "License activation failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 4: Token Validation
test_token_validation() {
    print_header "TEST 4: Token Validation"
    print_test "POST /api/license/validate"
    
    if [ -z "$DEVICE_TOKEN" ]; then
        print_error "No device token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/validate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEVICE_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Token validated successfully"
        print_response "$body"
        return 0
    else
        print_error "Token validation failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 5: Token Refresh
test_token_refresh() {
    print_header "TEST 5: Token Refresh"
    print_test "POST /api/license/refresh"
    
    if [ -z "$DEVICE_TOKEN" ]; then
        print_error "No device token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/refresh" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEVICE_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Token refreshed successfully"
        print_response "$body"
        
        # Update token
        NEW_TOKEN=$(echo "$body" | jq -r '.token' 2>/dev/null)
        if [ "$NEW_TOKEN" != "null" ] && [ -n "$NEW_TOKEN" ]; then
            DEVICE_TOKEN="$NEW_TOKEN"
            print_info "Updated device token"
        fi
        return 0
    else
        print_error "Token refresh failed (HTTP $http_code)"
        print_response "$body"
        return 1
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
        }")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Admin login successful"
        print_response "$body"
        
        # Extract admin token
        ADMIN_TOKEN=$(echo "$body" | jq -r '.token' 2>/dev/null)
        print_info "Saved admin token for future tests"
        return 0
    else
        print_error "Admin login failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 7: Get All Licenses
test_get_licenses() {
    print_header "TEST 7: Get All Licenses"
    print_test "GET /api/admin/licenses"
    
    if [ -z "$ADMIN_TOKEN" ]; then
        print_error "No admin token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/licenses" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Licenses retrieved successfully"
        print_response "$body"
        
        # Save first license ID for later tests
        CREATED_LICENSE_ID=$(echo "$body" | jq -r '.licenses[0].id' 2>/dev/null)
        print_info "Saved license ID: $CREATED_LICENSE_ID"
        return 0
    else
        print_error "Get licenses failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 8: Get License by ID
test_get_license_by_id() {
    print_header "TEST 8: Get License by ID"
    print_test "GET /api/admin/licenses/:id"
    
    if [ -z "$ADMIN_TOKEN" ] || [ -z "$CREATED_LICENSE_ID" ]; then
        print_error "No admin token or license ID available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/licenses/$CREATED_LICENSE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "License details retrieved successfully"
        print_response "$body"
        return 0
    else
        print_error "Get license by ID failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 9: Create New License
test_create_license() {
    print_header "TEST 9: Create New License"
    print_test "POST /api/admin/licenses"
    
    if [ -z "$ADMIN_TOKEN" ]; then
        print_error "No admin token available. Skipping test."
        return 1
    fi
    
    # Get organization ID from existing license
    ORG_ID=$(curl -s -X GET "$BASE_URL/api/admin/licenses" \
        -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.licenses[0].organizationId' 2>/dev/null)
    
    if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
        print_error "Could not get organization ID. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/licenses" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"organizationId\": \"$ORG_ID\",
            \"plan\": \"BASIC\",
            \"maxDevices\": 5,
            \"validUntil\": \"2027-12-31T23:59:59Z\"
        }")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "201" ]; then
        print_success "License created successfully"
        print_response "$body"
        
        # Save new license ID
        NEW_LICENSE_ID=$(echo "$body" | jq -r '.id' 2>/dev/null)
        print_info "New license ID: $NEW_LICENSE_ID"
        return 0
    else
        print_error "Create license failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 10: Update License
test_update_license() {
    print_header "TEST 10: Update License"
    print_test "PATCH /api/admin/licenses/:id"
    
    if [ -z "$ADMIN_TOKEN" ] || [ -z "$CREATED_LICENSE_ID" ]; then
        print_error "No admin token or license ID available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/admin/licenses/$CREATED_LICENSE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"maxDevices\": 15
        }")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "License updated successfully"
        print_response "$body"
        return 0
    else
        print_error "Update license failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 11: Get All Devices
test_get_devices() {
    print_header "TEST 11: Get All Devices"
    print_test "GET /api/admin/devices"
    
    if [ -z "$ADMIN_TOKEN" ]; then
        print_error "No admin token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/devices" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Devices retrieved successfully"
        print_response "$body"
        return 0
    else
        print_error "Get devices failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 12: Get Admin Stats
test_admin_stats() {
    print_header "TEST 12: Admin Statistics"
    print_test "GET /api/admin/stats"
    
    if [ -z "$ADMIN_TOKEN" ]; then
        print_error "No admin token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/stats" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Statistics retrieved successfully"
        print_response "$body"
        return 0
    else
        print_error "Get stats failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 13: Get Audit Logs
test_audit_logs() {
    print_header "TEST 13: Audit Logs"
    print_test "GET /api/admin/audit"
    
    if [ -z "$ADMIN_TOKEN" ]; then
        print_error "No admin token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/admin/audit?limit=10" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Audit logs retrieved successfully"
        print_response "$body"
        return 0
    else
        print_error "Get audit logs failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 14: License Deactivation
test_license_deactivation() {
    print_header "TEST 14: License Deactivation"
    print_test "POST /api/license/deactivate"
    
    if [ -z "$DEVICE_TOKEN" ]; then
        print_error "No device token available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/license/deactivate" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $DEVICE_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Device deactivated successfully"
        print_response "$body"
        return 0
    else
        print_error "License deactivation failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# Test 15: Delete Device (Admin)
test_delete_device() {
    print_header "TEST 15: Delete Device"
    print_test "DELETE /api/admin/devices/:id"
    
    if [ -z "$ADMIN_TOKEN" ] || [ -z "$CREATED_DEVICE_ID" ]; then
        print_error "No admin token or device ID available. Skipping test."
        return 1
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/admin/devices/$CREATED_DEVICE_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        print_success "Device deleted successfully"
        print_response "$body"
        return 0
    else
        print_error "Delete device failed (HTTP $http_code)"
        print_response "$body"
        return 1
    fi
}

# ==============================================================================
# MAIN TEST EXECUTION
# ==============================================================================

main() {
    print_header "KIOSK LICENSE SERVER - API TESTING"
    print_info "Base URL: $BASE_URL"
    print_info "Test Device ID: $DEVICE_ID"
    echo ""
    
    # Track test results
    passed=0
    failed=0
    skipped=0
    
    # Run all tests
    tests=(
        "test_health_check"
        "test_server_info"
        "test_license_activation"
        "test_token_validation"
        "test_token_refresh"
        "test_admin_login"
        "test_get_licenses"
        "test_get_license_by_id"
        "test_create_license"
        "test_update_license"
        "test_get_devices"
        "test_admin_stats"
        "test_audit_logs"
        "test_license_deactivation"
        "test_delete_device"
    )
    
    for test in "${tests[@]}"; do
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
        sleep 1  # Small delay between tests
    done
    
    # Print summary
    print_header "TEST SUMMARY"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"
    echo -e "${YELLOW}Skipped: $skipped${NC}"
    echo ""
    
    total=$((passed + failed + skipped))
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED! ($passed/$total)${NC}"
        return 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED ($failed/$total)${NC}"
        return 1
    fi
}

# Run main function
main
