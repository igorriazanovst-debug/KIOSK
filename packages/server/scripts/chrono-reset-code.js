// packages/server/scripts/chrono-reset-code.js
// Для поддержки: педагог, забывший пароль «Хронолинии», диктует по
// телефону два кода, показанных на экране блокировки устройства — код
// сборки (buildCode) и код запроса (challenge). Этот скрипт вычисляет по
// ним код сброса на СЕРВЕРЕ, не заходя на устройство и не имея прямого
// доступа к производному секрету конкретной сборки (он выводится тут же,
// из мастер-секрета сервера) — см. Хронолайнер_план_реализации.md, Фаза 4.
//
// Запуск: node scripts/chrono-reset-code.js <buildCode> <challenge>

import dotenv from 'dotenv';
import { deriveBuildSecret, computeResetCode } from '../src/utils/masterCode.js';

dotenv.config();

const [buildCode, challenge] = process.argv.slice(2);

if (!buildCode || !challenge) {
  console.error('Использование: node scripts/chrono-reset-code.js <buildCode> <challenge>');
  process.exit(1);
}

const masterSecret = process.env.CHRONO_MASTER_SECRET;
if (!masterSecret) {
  console.error('CHRONO_MASTER_SECRET не задан в .env');
  process.exit(1);
}

// buildCode уже известен (продиктован педагогом с экрана блокировки) —
// выводим производный секрет этой сборки напрямую по той же формуле, что
// использовалась при сборке (buildResetConfig внутри builds.js), минуя
// повторное вычисление buildCode из buildId.
const secret = deriveBuildSecret(masterSecret, buildCode);
const code = computeResetCode(secret, buildCode, challenge);

console.log(`Код сброса: ${code}`);
