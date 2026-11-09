export function buildUninstallSignature(input: {
  licenseKey?: string | null;
  deviceId: string;
  commandId: string;
  issuedAt: number;
}): { licenseKeyHash: string; signature: string };
