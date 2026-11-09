// Подпись разрушительной команды удалённого удаления.
// Ключ — SHA-256 лицензионного ключа: он уже встроен в project.json клиента
// и известен серверу, поэтому сетевой посредник без файла проекта не может
// подделать команду. Это дополнение к проверенному WS-соединению, не замена HTTPS.

import { createHash, createHmac } from 'crypto';

export function buildUninstallSignature({ licenseKey, deviceId, commandId, issuedAt }) {
  if (!licenseKey || !deviceId || !commandId || !Number.isFinite(issuedAt)) {
    return { licenseKeyHash: '', signature: '' };
  }
  const licenseKeyHash = createHash('sha256').update(licenseKey).digest('hex');
  const signature = createHmac('sha256', licenseKeyHash)
    .update(`${deviceId}:${commandId}:${issuedAt}:uninstall`)
    .digest('hex');
  return { licenseKeyHash, signature };
}
