// Подпись разрушительных команд сервера (удалённое удаление).
//
// Ключ — licenseKeyHash, который уже встроен в project.json и известен
// серверу (SHA-256 лицензионного ключа). Это не заменяет HTTPS, но не даёт
// сетевому посреднику без файла проекта подделать команду. Секрет не
// передаётся по сети в сообщении.

const crypto = require('node:crypto');

function commandPayload(deviceId, commandId, issuedAt) {
  return `${deviceId}:${commandId}:${issuedAt}:uninstall`;
}

function signUninstallCommand({ licenseKeyHash, deviceId, commandId, issuedAt }) {
  if (!licenseKeyHash || !deviceId || !commandId || !Number.isFinite(issuedAt)) return '';
  return crypto
    .createHmac('sha256', String(licenseKeyHash))
    .update(commandPayload(deviceId, commandId, issuedAt))
    .digest('hex');
}

function verifyUninstallCommand({
  licenseKeyHash,
  deviceId,
  commandId,
  issuedAt,
  signature,
  now = Date.now(),
  // 60 минут — запас на расхождение часов киоска; повтор дополнительно
  // отсекается кэшем commandId.
  maxAgeMs = 60 * 60 * 1000
}) {
  if (!licenseKeyHash || !deviceId || !commandId || typeof signature !== 'string') return false;
  if (!Number.isFinite(issuedAt) || Math.abs(now - issuedAt) > maxAgeMs) return false;
  const expected = signUninstallCommand({ licenseKeyHash, deviceId, commandId, issuedAt });
  if (!expected) return false;
  let actualBuffer;
  try {
    actualBuffer = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

module.exports = { signUninstallCommand, verifyUninstallCommand };
