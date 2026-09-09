# Разовый скрипт: генерирует офлайн-озвучку пилотного контента Этапа 1
# (18 заданий) через встроенный Windows System.Speech (SAPI), конвертирует
# в mp3 через ffmpeg. Не часть рантайма плеера — озвучиваются только
# заранее известные тексты пилота (add1/add2/count1/count2), не
# сгенерированный контент волн 2b (у него своей озвучки нет по спеке).
#
# Отличие от исходного Task 16 (реставрация 2026-09-09): исходный скрипт
# переписывал ВЕСЬ pilotContent.json через ConvertTo-Json — тогда файл
# содержал только 18 заданий, сейчас 309 (после волн 2b), и ConvertTo-Json
# переформатировал бы файл целиком другим стилем отступов (тот же урок,
# что уже применялся в Этапе 2a — "не редактировать JSON через
# PowerShell ConvertTo-Json"). Поэтому этот скрипт ТОЛЬКО читает тексты
# и генерирует mp3 — запись `audioTaskTextId` обратно в JSON делает
# отдельный Node-скрипт (fill_pilot_audio_ids.mjs), точечно, с тем же
# стилем форматирования, что и остальной генератор.
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
# Явный русский голос вместо SelectVoiceByHints('Female') — хинт мог
# выбрать англоязычный женский голос (Zira), с фолбэком на хинт, если на
# машине нет "Microsoft Irina Desktop".
$russianVoice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -eq 'Microsoft Irina Desktop' }
if ($russianVoice) {
    $synth.SelectVoice('Microsoft Irina Desktop')
} else {
    Write-Host "Microsoft Irina Desktop not found, falling back to SelectVoiceByHints('Female')"
    $synth.SelectVoiceByHints('Female')
}

# Путь строится через переменную окружения, а не литеральной кириллицей в
# коде скрипта — .ps1 без BOM на этой машине читается PowerShell 5.1 в
# системной ANSI-кодировке, и кириллица в исходном тексте скрипта
# превращалась в mojibake (ffmpeg.exe не находился).
$ffmpeg = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe'
if (-not (Test-Path $ffmpeg)) {
    Write-Error "ffmpeg not found at: $ffmpeg"
    exit 1
}
$contentPath = Join-Path $PSScriptRoot 'pilotContent.json'
# public/media, не src/mathmachine/media — vite копирует public/* в dist/*
# без изменений при сборке (файлы, ссылающиеся динамическим путём
# `./media/${id}.mp3`, недоступны статическому анализу Rollup, поэтому
# import-based бандлинг их не подхватит).
$mediaDir = Join-Path $PSScriptRoot '..\..\..\public\media'
New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null

$pilotTaskIds = @(
    'add1_intro','add1_1','add1_2','add1_3','add1_4',
    'add2_intro','add2_1','add2_2','add2_3',
    'count1_intro','count1_1','count1_2','count1_3','count1_4',
    'count2_intro','count2_1','count2_2','count2_3'
)

# Найдено вживую: SAPI иногда отдаёт почти пустой WAV (46 байт — только
# заголовок, без аудиоданных) без единой ошибки — воспроизводилось не для
# конкретных слов (проверено изоляцией: даже нейтральный тестовый текст
# ломался в том же состоянии системы), а из-за зависшего на этой машине
# состояния службы Windows Audio (AudioSrv) — `Restart-Service AudioSrv`
# решило проблему полностью. SAPI использует аудио-движок системы даже
# при выводе в WAV-файл (SetOutputToWaveFile), поэтому зависшая служба
# ломает и файловый вывод, не только реальное воспроизведение. Скрипт САМ
# не перезапускает системную службу (требует прав администратора, задел
# бы весь хост, не только этот процесс) — минимальный порог размера WAV +
# до 3 повторных попыток остаётся как защита от единичных сбоев, но если
# видите ту же ошибку массово — сначала проверьте/перезапустите AudioSrv
# вручную, а не увеличивайте число попыток.
$MIN_WAV_BYTES = 2000

$content = Get-Content $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$generated = 0
foreach ($taskId in $pilotTaskIds) {
    $task = $content.tasks.$taskId
    if (-not $task) { Write-Host "SKIP (not found): $taskId"; continue }

    $wavPath = Join-Path $mediaDir "$taskId.wav"
    $mp3Path = Join-Path $mediaDir "$taskId.mp3"

    $ok = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $synth.SetOutputToWaveFile($wavPath)
        $synth.Speak($task.text)
        $synth.SetOutputToNull()
        $wavSize = (Get-Item $wavPath).Length
        if ($wavSize -ge $MIN_WAV_BYTES) { $ok = $true; break }
        Write-Host "  retry $attempt for ${taskId}: wav only $wavSize bytes"
        Start-Sleep -Milliseconds 400
    }
    if (-not $ok) {
        Write-Error "SAPI kept producing a near-empty wav for ${taskId} after 3 attempts — skipped, wav kept for inspection"
        continue
    }

    & $ffmpeg -y -i $wavPath -codec:a libmp3lame -qscale:a 4 $mp3Path 2>$null
    if (-not (Test-Path $mp3Path)) {
        Write-Error "ffmpeg failed to produce: $mp3Path (wav kept for inspection)"
        continue
    }
    Remove-Item $wavPath
    $generated++
    Start-Sleep -Milliseconds 300
}

Write-Host "Generated $generated narration files (pilotContent.json not modified by this script)."
