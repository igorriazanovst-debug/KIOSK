#!/bin/bash
# fix-admin-ctrl.sh
# Точный патч AdminController.ts по содержимому строк
#
# cd /opt/kiosk/kiosk-content-platform/packages/server
# bash fix-admin-ctrl.sh

set -e

FILE="src/controllers/AdminController.ts"

echo "=== Патчим $FILE ==="

python3 << 'PYEOF'
filepath = "src/controllers/AdminController.ts"

with open(filepath, "r") as f:
    lines = f.readlines()

out = []
removed = []

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # ── 1. Деструктуризация req.body ─────────────────────────
    # Убираем строки:  companyName,  /  contactEmail,  /  notes
    # внутри блока  const { ... } = req.body;
    if stripped in ("companyName,", "contactEmail,", "notes"):
        removed.append((i + 1, line.rstrip()))
        i += 1
        continue

    # ── 2. Вызов LicenseService.createLicense({ ... }) ────────
    # Убираем:  companyName,  /  contactEmail,  /  notes
    # (уже покрыто выше — та же логика)

    # ── 3. where.OR в getLicenses ──────────────────────────────
    # Убираем строки с companyName и contactEmail в where.OR
    # { companyName: { contains: ... } },
    # { contactEmail: { contains: ... } }
    if "companyName:" in stripped and "contains:" in stripped:
        removed.append((i + 1, line.rstrip()))
        i += 1
        continue
    if "contactEmail:" in stripped and "contains:" in stripped:
        removed.append((i + 1, line.rstrip()))
        i += 1
        continue

    out.append(line)
    i += 1

with open(filepath, "w") as f:
    f.writelines(out)

if removed:
    print(f"  ✓ Удалено {len(removed)} строк:")
    for ln, txt in removed:
        print(f"    L{ln}: {txt}")
else:
    print("  ⚠ Ничего не найдено")
PYEOF

echo ""
echo "=== Компиляция ==="
npm run build

echo ""
echo "============================================"
echo "  ✓ BUILD OK"
echo "============================================"
echo ""
echo "  sudo systemctl restart kiosk-license-server"
echo "  curl http://localhost:3001/health"
