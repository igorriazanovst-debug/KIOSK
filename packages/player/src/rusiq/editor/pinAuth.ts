// SHA-256 хэширование PIN режима учителя и пароля конкретной викторины
// через Web Crypto API (доступен в renderer без IPC-круговорота) - тот же
// алгоритм, что уже используется в проекте для licenseKeyHash (project.json).
// Открытый текст никогда не сохраняется - только хэш (спека Фазы 2a, разд. 3).

export async function hashSecret(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySecret(text: string, hash: string | null): Promise<boolean> {
  if (hash === null) return false;
  return (await hashSecret(text)) === hash;
}
