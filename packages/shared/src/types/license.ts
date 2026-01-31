// packages/shared/src/types/license.ts

export enum Plan {
  Basic = 'basic',
  Pro = 'pro',
  Max = 'max'
}

export enum LicenseStatus {
  Active = 'active',
  Suspended = 'suspended',
  Expired = 'expired',
  Cancelled = 'cancelled'
}

export interface License {
  id: string;
  licenseKey: string;
  organizationId: string;
  plan: Plan;
  status: LicenseStatus;
  seatsEditor: number;
  seatsPlayer: number;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLicenseInput {
  organizationId: string;
  plan: Plan;
  seatsEditor: number;
  seatsPlayer: number;
  validFrom: Date;
  validUntil: Date;
}

export interface UpdateLicenseInput {
  plan?: Plan;
  status?: LicenseStatus;
  seatsEditor?: number;
  seatsPlayer?: number;
  validUntil?: Date;
}

export interface LicenseWithUsage extends License {
  activeEditorDevices: number;
  activePlayerDevices: number;
}
