"use strict";
// packages/shared/src/types/token.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenErrorCode = void 0;
var TokenErrorCode;
(function (TokenErrorCode) {
    TokenErrorCode["InvalidToken"] = "INVALID_TOKEN";
    TokenErrorCode["ExpiredToken"] = "EXPIRED_TOKEN";
    TokenErrorCode["RevokedToken"] = "REVOKED_TOKEN";
    TokenErrorCode["LicenseExpired"] = "LICENSE_EXPIRED";
    TokenErrorCode["LicenseSuspended"] = "LICENSE_SUSPENDED";
    TokenErrorCode["DeviceDeactivated"] = "DEVICE_DEACTIVATED";
})(TokenErrorCode || (exports.TokenErrorCode = TokenErrorCode = {}));
