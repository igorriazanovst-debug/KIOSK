"use strict";
// packages/shared/src/types/license.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseStatus = exports.Plan = void 0;
var Plan;
(function (Plan) {
    Plan["Basic"] = "basic";
    Plan["Pro"] = "pro";
    Plan["Max"] = "max";
})(Plan || (exports.Plan = Plan = {}));
var LicenseStatus;
(function (LicenseStatus) {
    LicenseStatus["Active"] = "active";
    LicenseStatus["Suspended"] = "suspended";
    LicenseStatus["Expired"] = "expired";
    LicenseStatus["Cancelled"] = "cancelled";
})(LicenseStatus || (exports.LicenseStatus = LicenseStatus = {}));
