#!/bin/bash
# ============================================================
# fix-build-errors.sh  —  исправление 9 ошибок компиляции
# Запуск: cd /opt/kiosk/kiosk-content-platform/packages/server
#         bash fix-build-errors.sh
# ============================================================

set -e

echo "=== Бэкуп файлов ==="
cp src/controllers/AdminController.ts   src/controllers/AdminController.ts.bak
cp src/services/LicenseService.ts       src/services/LicenseService.ts.bak
echo "✓ Бэкупы созданы"
echo ""

# ============================================================
# FIX 1 — AdminController.ts
# Патч Iteration 3 добавил дублирующий метод deleteDevice
# с неверными вызовами:
#   DeviceService.findById       (нет такого метода)
#   DeviceService.deactivate     (нет такого метода)
#   AuditService.logDeviceDeactivated (нет такого метода)
#
# Оригинальный метод уже существует выше и работает правильно.
# Удаляем всё от JSDoc-комментаря дублирующего метода до его
# закрывающей скобки включительно.
# ============================================================
echo "=== Fix 1: AdminController.ts ==="

python3 << 'PYEOF'
with open("src/controllers/AdminController.ts", "r") as f:
    lines = f.readlines()

# Ищем строку с DeviceService.findById — это уникальный маркер дублирующего метода
broken_line_idx = None
for i, line in enumerate(lines):
    if "DeviceService.findById" in line:
        broken_line_idx = i
        break

if broken_line_idx is None:
    print("  ⚠ DeviceService.findById не найдена — возможно уже исправлено")
else:
    # Ищем начало метода: ищем назад от broken_line до "static async"
    method_start = broken_line_idx
    for i in range(broken_line_idx, -1, -1):
        if "static async" in lines[i]:
            method_start = i
            break

    # Ищем JSDoc перед методом (/**  ... */)
    block_start = method_start
    for i in range(method_start - 1, max(method_start - 10, -1), -1):
        stripped = lines[i].strip()
        if stripped == "":
            continue
        if stripped.startswith("*") or stripped.startswith("/**") or stripped.startswith("*/"):
            block_start = i
            if stripped.startswith("/**"):
                break
        else:
            break

    # Ищем конец метода: считаем фигурные скобки от method_start
    brace_count = 0
    method_end = broken_line_idx
    found_open = False
    for i in range(method_start, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                brace_count += 1
                found_open = True
            elif ch == '}':
                brace_count -= 1
                if found_open and brace_count == 0:
                    method_end = i
                    break
        if found_open and brace_count == 0:
            break

    # Удаляем блок [block_start .. method_end] включительно
    removed = lines[block_start:method_end + 1]
    lines = lines[:block_start] + lines[method_end + 1:]
    
    with open("src/controllers/AdminController.ts", "w") as f:
        f.writelines(lines)
    
    print(f"  ✓ Удалён дублирующий deleteDevice (строки {block_start+1}–{method_end+1}, {len(removed)} строк)")

PYEOF
echo ""


# ============================================================
# FIX 2 — LicenseService.ts  (5 ошибок)
# ============================================================
echo "=== Fix 2: LicenseService.ts ==="

python3 << 'PYEOF'
with open("src/services/LicenseService.ts", "r") as f:
    content = f.read()

fixes = []

# ── 2a: finalLicenseKey не инициализирована ─────────────────
# TS2454: Variable 'finalLicenseKey' is used before being assigned
# Причина: let finalLicenseKey; присвоение внутри while — TS не гарантирует запуск
for variant in [
    ("let finalLicenseKey: string;",  "let finalLicenseKey: string = '';"),
    ("let finalLicenseKey;",          "let finalLicenseKey = '';"),
]:
    if variant[0] in content:
        content = content.replace(variant[0], variant[1], 1)
        fixes.append(f"finalLicenseKey инициализирована: '{variant[0]}' → '{variant[1]}'")
        break

# ── 2b: .toUpperCase() on type 'never' ───────────────────────
# TS2339: Property 'toUpperCase' does not exist on type 'never'
# Причина: params.plan / updates.plan / updates.status — TypeScript inference
#          сужает тип до never когда Plan — enum.
# Решение: оборачиваем в String() для явного приведения
replacements = [
    ("params.plan.toUpperCase()",     "String(params.plan).toUpperCase()"),
    ("updates.plan.toUpperCase()",    "String(updates.plan).toUpperCase()"),
    ("updates.status.toUpperCase()",  "String(updates.status).toUpperCase()"),
]
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        fixes.append(f"toUpperCase: '{old}' → '{new}'")

# ── 2c: companyName / contactEmail / notes не существуют в schema ──
# TS2353: Object literal may only specify known properties
# Prisma schema License модель содержит только:
#   licenseKey, organizationId, plan, status, seatsEditor, seatsPlayer, validFrom, validUntil
# Удаляем строки с несуществующими полями из prisma.license.create({ data: { ... } })
lines = content.split('\n')
filtered_lines = []
for line in lines:
    stripped = line.strip()
    skip = False
    for field in ['companyName', 'contactEmail', 'notes']:
        if stripped.startswith(f'{field}:') or stripped.startswith(f'{field} :'):
            skip = True
            fixes.append(f"Удалено поле '{field}' из prisma.create")
            break
    if not skip:
        filtered_lines.append(line)
content = '\n'.join(filtered_lines)

# ── Записываем ──
with open("src/services/LicenseService.ts", "w") as f:
    f.write(content)

if fixes:
    for fix in fixes:
        print(f"  ✓ {fix}")
else:
    print("  ⚠ Ничего не изменено — возможно уже исправлено")

PYEOF
echo ""


# ============================================================
# ЗАПУСК КОМПИЛЯЦИИ
# ============================================================
echo "=== npm run build ==="
echo ""
npm run build

echo ""
echo "============================================"
echo "  ✓ BUILD SUCCESSFUL — все ошибки исправлены"
echo "============================================"
