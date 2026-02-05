"use strict";
// packages/shared/src/types/license-client.ts
// Types for License integration in Editor and Player
Object.defineProperty(exports, "__esModule", { value: true });
exports.LICENSE_ERROR_MESSAGES = exports.LicenseError = void 0;
var LicenseError;
(function (LicenseError) {
    LicenseError["INVALID_KEY"] = "INVALID_KEY";
    LicenseError["EXPIRED"] = "EXPIRED";
    LicenseError["SEAT_LIMIT"] = "SEAT_LIMIT";
    LicenseError["NETWORK_ERROR"] = "NETWORK_ERROR";
    LicenseError["DEACTIVATED"] = "DEACTIVATED";
    LicenseError["UNKNOWN"] = "UNKNOWN";
})(LicenseError || (exports.LicenseError = LicenseError = {}));
exports.LICENSE_ERROR_MESSAGES = {
    [LicenseError.INVALID_KEY]: 'Invalid license key',
    [LicenseError.EXPIRED]: 'License has expired',
    [LicenseError.SEAT_LIMIT]: 'Maximum devices reached for this license',
    [LicenseError.NETWORK_ERROR]: 'Cannot connect to license server',
    [LicenseError.DEACTIVATED]: 'Device was deactivated. Contact support.',
    [LicenseError.UNKNOWN]: 'An unknown error occurred'
};
