#!/bin/bash
# ============================================================
# fix-remaining.sh
# Удаляет оставшиеся ошибки в updateLicense() — поля
# companyName, contactEmail, notes не существуют в Prisma schema.
#
# Запуск:
#   cd /opt/kiosk/kiosk-content-platform/packages/server
#   bash fix-remaining.sh
# ============================================================

set -e

FILE="src/services/LicenseService.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Файл не найден: $FILE"
  echo "   Убедитесь что вы в packages/server"
  exit 1
fi

echo "=== Патчим $FILE ==="
echo ""

python3 << 'PYEOF'
filepath = "src/services/LicenseService.ts"

with open(filepath, "r") as f:
    lines = f.readlines()

removed = []
output = []

for i, line in enumerate(lines):
    stripped = line.strip()

    # Удаляем из сигнатуры updates: companyName?, contactEmail?, notes?
    if any(stripped.startswith(f"{field}?:") for field in ["companyName", "contactEmail", "notes"]):
        removed.append((i + 1, line.rstrip()))
        continue

    # Удаляем из тела: if (updates.companyName !== undefined) ...
    if any(f"updates.{field}" in stripped for field in ["companyName", "contactEmail", "notes"]):
        removed.append((i + 1, line.rstrip()))
        continue

    output.append(line)

with open(filepath, "w") as f:
    f.writelines(output)

if removed:
    print(f"  ✓ Удалено {len(removed)} строк:")
    for line_no, text in removed:
        print(f"    L{line_no}: {text}")
else:
    print("  ⚠ Ничего не найдено — возможно уже исправлено")
PYEOF

echo ""
echo "=== Компиляция ==="
echo ""
npm run build

echo ""
echo "============================================"
echo "  ✓ BUILD OK"
echo "============================================"
echo ""
echo "Следующие шаги:"
echo "  sudo systemctl restart kiosk-license-server"
echo "  curl http://localhost:3001/health"
