// Выбор хранилища для данных пользователей ЭУМК. В собранном приложении это
// файл в профиле приложения (мост eumkAPI из preload.js): localStorage
// Chromium теряет данные при внезапном завершении процесса. В обычном
// браузере (стенд разработчика, предпросмотр) остаётся localStorage.

import type { KeyValueStorage } from './userData.ts';
import type { PasswordRecord } from './model/schema.ts';

export interface BridgeReply<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export interface EumkBridge {
  getItem(key: string): BridgeReply<string | null>;
  setItem(key: string, value: string): BridgeReply<undefined>;
  // Пароли (K5-1): PBKDF2 считается в главном процессе (node:crypto),
  // рендерер получает только готовую запись или ответ «подошёл/нет».
  hashPassword(password: string): Promise<BridgeReply<PasswordRecord>>;
  verifyPassword(password: string, record: PasswordRecord): Promise<BridgeReply<boolean>>;
}

export interface StorageHost {
  eumkAPI?: EumkBridge;
  localStorage?: KeyValueStorage;
}

function fromBridge(bridge: EumkBridge): KeyValueStorage {
  return {
    getItem(key) {
      const reply = bridge.getItem(key);
      if (!reply.ok) throw new Error(reply.error ?? 'Ошибка хранилища');
      return reply.value ?? null;
    },
    setItem(key, value) {
      const reply = bridge.setItem(key, value);
      if (!reply.ok) throw new Error(reply.error ?? 'Ошибка хранилища');
    },
  };
}

// Доступ к localStorage в приватном режиме или при запрете может бросить исключение.
export function pickStorage(host: StorageHost): KeyValueStorage | null {
  try {
    if (host.eumkAPI) return fromBridge(host.eumkAPI);
    return host.localStorage ?? null;
  } catch {
    return null;
  }
}
