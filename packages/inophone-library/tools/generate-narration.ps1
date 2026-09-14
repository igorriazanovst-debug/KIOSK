# packages/inophone-library/tools/generate-narration.ps1
# Озвучка русского и английского голосами Windows SAPI.
#
# ОДИН ПРОЦЕСС НА ВЕСЬ СПИСОК, а не по процессу на слово. Запуск PowerShell
# стоит около трети секунды; на 792 словах это четыре минуты чистого ожидания
# сверх самого синтеза.
#
# ГОЛОС ВЫБИРАЕТСЯ ПО ИМЕНИ, а не «первый для культуры ru-RU». На машине с
# несколькими русскими голосами «первый» меняется от обновления к обновлению, и
# половина пакета начинает звучать другим голосом — заметно и неприятно.
#
# ДВЕ ОШИБКИ ЭТОГО СКРИПТА, СТОИВШИЕ 2376 ИСПОРЧЕННЫХ ФАЙЛОВ.
#
# Первая: отбор `Where-Object { $_.engine -eq 'sapi' }` в конвейере не отсёк
# чужие языки, и скрипт взялся озвучивать французский, немецкий, китайский и
# башкирский. Отбор теперь делается ЯВНОЙ ПРОВЕРКОЙ внутри цикла — её видно и
# она не зависит от того, как ConvertFrom-Json отдаёт массив в конвейер.
#
# Вторая, и худшая: SelectVoice бросает НЕПРЕРЫВАЮЩУЮ ошибку. Скрипт печатал её
# и шёл дальше — озвучивать голосом по умолчанию. Русский голос, читающий
# китайский, даёт файл в двести байт, то есть тишину; а вот французский он
# читает бодро и неправильно, и на глаз такой файл неотличим от хорошего.
# Теперь голос выбирается ОДИН РАЗ на язык, в try/catch, и сбой выбора
# останавливает работу.
#
# Пишет WAV во временный каталог; в mp3 их переводит encode.mjs.
#
# Запуск: powershell -File tools/generate-narration.ps1 -Plan tools/narration-plan.json -Out <каталог wav>

# ФАЙЛ СОХРАНЁН С BOM, И ЭТО ОБЯЗАТЕЛЬНО. Windows PowerShell 5.1 читает .ps1
# без BOM как текст в системной кодировке, кириллица превращается в мусор, и
# скрипт падает разбором на первой же строке с русским текстом в кавычках.

param(
  [Parameter(Mandatory = $true)][string]$Plan,
  [Parameter(Mandatory = $true)][string]$Out
)

Add-Type -AssemblyName System.Speech

$voices = @{ ru = 'Microsoft Irina Desktop'; en = 'Microsoft Zira Desktop' }

$all = Get-Content $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Test-Path $Out)) { New-Item -ItemType Directory $Out -Force | Out-Null }

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
foreach ($needed in $voices.Values) {
  if ($installed -notcontains $needed) {
    Write-Error "Нет голоса «$needed». Установленные: $($installed -join ', ')"
    exit 1
  }
}

# Скорость на две ступени ниже обычной: пособие существует ради того, чтобы
# слово можно было расслышать и повторить, а не ради беглости
$synth.Rate = -2

$made = 0
$skipped = 0

# Язык за языком, а не вперемешку: голос переключается ровно два раза за прогон
foreach ($code in @('ru', 'en')) {
  try {
    $synth.SelectVoice($voices[$code])
  } catch {
    Write-Error "Не удалось выбрать голос «$($voices[$code])» для языка $code : $($_.Exception.Message)"
    $synth.Dispose()
    exit 1
  }
  Write-Host "$code — голос «$($voices[$code])»"

  $dir = Join-Path $Out $code
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir -Force | Out-Null }

  foreach ($it in $all) {
    if ($it.code -ne $code) { continue }
    if ($it.engine -ne 'sapi') { continue }

    $wav = Join-Path $dir ($it.id + '.wav')
    if (Test-Path $wav) { $skipped++; continue }

    $synth.SetOutputToWaveFile($wav)
    $synth.Speak($it.text)
    $synth.SetOutputToNull()

    # Пустой файл — не успех. Синтезатор возвращает управление и на тексте,
    # который не смог прочитать, и в пакет уезжает тишина
    if ((Get-Item $wav).Length -lt 1000) {
      Remove-Item $wav -Force
      Write-Warning "$code/$($it.id): пусто («$($it.text)»)"
      continue
    }
    $made++
    if ($made % 100 -eq 0) { Write-Host "  озвучено $made" }
  }
}
$synth.Dispose()
Write-Host "SAPI: сделано $made, пропущено (уже было) $skipped"
