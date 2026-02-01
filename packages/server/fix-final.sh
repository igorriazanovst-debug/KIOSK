#!/bin/bash
# ============================================================
# fix-final.sh — исправляет оставшиеся 4 ошибки компиляции
#
# 1. AdminController.ts:223 — убрать companyName/contactEmail/notes
#    из вызова LicenseService.createLicense (их больше нет в сигнатуре)
#
# 2. AdminController.ts:379-381 — сломанный метод deactivateDevice
#    использует DeviceService.deactivate и AuditService.logDeviceDeactivated
#    которых не существует. Заменяем на корректную логику и переименовываем
#    в deleteDevice (на него ссылается admin.routes.ts)
#
# Запуск:
#   cd /opt/kiosk/kiosk-content-platform/packages/server
#   bash fix-final.sh
# ============================================================

set -e

FILE="src/controllers/AdminController.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Файл не найден: $FILE"
  exit 1
fi

echo "=== Патчим AdminController.ts ==="
echo ""

python3 << 'PYEOF'
filepath = "src/controllers/AdminController.ts"

with open(filepath, "r") as f:
    content = f.read()

changes = []

# ─────────────────────────────────────────────────────────────
# FIX 1: убрать companyName, contactEmail, notes из вызова
#         LicenseService.createLicense({ ... })
# ─────────────────────────────────────────────────────────────
for field in ["companyName", "contactEmail", "notes"]:
    # Паттерн в вызове createLicense: "      companyName,\n"
    # или "      companyName\n" (последний без запятой)
    import re
    # С запятой
    pattern_comma = rf'^\s*{field},\s*\n'
    match = re.search(pattern_comma, content, re.MULTILINE)
    if match:
        content = content[:match.start()] + content[match.end():]
        changes.append(f"Удалено поле '{field},' из createLicense вызова")
        continue
    # Без запятой (последний параметр)
    pattern_no_comma = rf'^\s*{field}\s*\n'
    match = re.search(pattern_no_comma, content, re.MULTILINE)
    if match:
        content = content[:match.start()] + content[match.end():]
        changes.append(f"Удалено поле '{field}' из createLicense вызова")

# ─────────────────────────────────────────────────────────────
# FIX 2: заменить сломанный метод deactivateDevice
#         на рабочий deleteDevice
# ─────────────────────────────────────────────────────────────

# Уникальный маркер сломанного метода
broken_marker = "DeviceService.deactivate("

if broken_marker in content:
    lines = content.split('\n')
    
    # Найти строку с маркером
    marker_idx = None
    for i, line in enumerate(lines):
        if broken_marker in line:
            marker_idx = i
            break
    
    # Найти начало метода (static async deactivateDevice)
    method_start = marker_idx
    for i in range(marker_idx, -1, -1):
        if "static async" in lines[i]:
            method_start = i
            break
    
    # Найти JSDoc перед методом
    block_start = method_start
    for i in range(method_start - 1, max(method_start - 15, -1), -1):
        stripped = lines[i].strip()
        if stripped == "":
            block_start = i + 1
            break
        if stripped.startswith("/**"):
            block_start = i
            break
        if not (stripped.startswith("*") or stripped.startswith("*/")):
            block_start = i + 1
            break
    
    # Найти конец метода по подсчёту скобок
    brace_count = 0
    method_end = marker_idx
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
    
    # Новый корректный метод deleteDevice
    new_method = """  /**
   * DELETE /api/admin/devices/:id
   * Удалить (деактивировать) устройство
   */
  static async deleteDevice(req: Request, res: Response) {
    const { id } = req.params;
    
    const prisma = getPrismaClient();
    const device = await prisma.device.findUnique({
      where: { id }
    });
    
    if (!device) {
      throw ApiError.notFound('Device not found');
    }
    
    await DeviceService.deactivateDevice(device.deviceId);
    
    await AuditService.logDeactivation({
      deviceId: device.deviceId,
      licenseId: device.licenseId,
      userId: req.user!.id,
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: 'Device deactivated successfully'
    });
  }"""
    
    # Заменяем блок
    lines = lines[:block_start] + [new_method] + lines[method_end + 1:]
    content = '\n'.join(lines)
    changes.append(f"Замена deactivateDevice → deleteDevice (строки {block_start+1}–{method_end+1})")
else:
    changes.append("⚠ DeviceService.deactivate не найдено — может быть уже исправлено")

# ─────────────────────────────────────────────────────────────
# Записываем
# ─────────────────────────────────────────────────────────────
with open(filepath, "w") as f:
    f.write(content)

for c in changes:
    print(f"  ✓ {c}")

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
echo "Дальше:"
echo "  sudo systemctl restart kiosk-license-server"
echo "  curl http://localhost:3001/health"
