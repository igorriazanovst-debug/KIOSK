// packages/server/scripts/generate-keys.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '..', 'keys');

// Создаём директорию если не существует
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
  console.log('✅ Created keys directory');
}

// Генерируем пару ключей RSA
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Сохраняем ключи
const privateKeyPath = path.join(keysDir, 'private.key');
const publicKeyPath = path.join(keysDir, 'public.key');

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log('✅ Generated RSA key pair:');
console.log(`   Private key: ${privateKeyPath}`);
console.log(`   Public key: ${publicKeyPath}`);
console.log('');
console.log('⚠️  Keep the private key secure and never commit it to git!');
