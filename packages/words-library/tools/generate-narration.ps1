# packages/words-library/tools/generate-narration.ps1
#
# Офлайн-генерация озвучки пакета контента: Windows SAPI (System.Speech) в WAV,
# затем ffmpeg в mp3. Ни сети, ни облачных сервисов, ни рантайм-зависимостей —
# в приложение едут только готовые .mp3.
#
# Пайплайн перенесён из виджета «Матемашка» (Тип 6), где он уже отработал на
# 2835 файлах. Отличие адресации: у «Матемашки» все файлы лежат плоско в
# public/media/<id>.mp3, здесь — раскладка пакета контента по идентификатору
# слова, и единственный источник правды о путях — resources.ts в @kiosk/shared.
# Поэтому список заданий на генерацию СЧИТАЕТ НЕ ЭТОТ СКРИПТ: его готовит
# plan-narration.mjs, который спрашивает пути у того же модуля, что потом
# проверяет комплектность. Иначе скрипт и проверка разошлись бы в путях, и
# озвучка молча не находилась бы в игре.
#
# ВАЖНО ПРО СОДЕРЖИМОЕ. Это СИНТЕЗИРОВАННАЯ речь. План реализации относит
# синтез речи к тому, что НЕ входит в MVP («Синтез речи вместо записанной
# озвучки»), поэтому такие файлы — средство сделать игру проверяемой руками и
# замерить реальный вес контента (спайк 0.3), а не поставочный контент. Для
# приёмки нужна запись живым голосом: требование ТЗ FR-019 — «озвученные
# слова», и пригодность синтеза решает заказчик, а не разработчик.
#
# ГРАБЛИ, ЗАЛОЖЕННЫЕ В КОД (все — из опыта «Матемашки»):
#
# 1. Зависшая служба Windows Audio (AudioSrv) заставляет SAPI отдавать почти
#    пустой WAV (порядка 46 байт) БЕЗ ЕДИНОЙ ОШИБКИ и с нулевым кодом
#    возврата. Exit code такой сбой не ловит. Защита здесь — порог на размер
#    WAV и до трёх попыток; саму зависшую службу это не лечит (помогает только
#    Restart-Service AudioSrv), но одиночный прогон защищает.
# 2. Прогон резюмируемый: готовый mp3 пропускается. Каталог на 270 слов — это
#    под тысячу файлов, и рассчитывать надо на прерывания, а не на один
#    непрерывный проход.
# 3. Неудачи идут в лог-файл и НЕ роняют прогон целиком.
# 4. Путь к ffmpeg — параметром, а не хардкодом: в этом проекте рабочие
#    каталоги лежат по путям с кириллицей, и зашитая строка в .ps1 ломается
#    кодировкой (сам файл обязан быть в UTF-8 С BOM, иначе PowerShell 5.1
#    прочитает кириллицу в системной ANSI-кодировке).
# 5. Если текст слова изменится ПОСЛЕ генерации, резюмируемый прогон этого не
#    заметит — он смотрит только «файл есть / файла нет». Устаревшие mp3 перед
#    перегенерацией нужно удалять; для этого есть -Force.

param(
    # План генерации: JSON-массив { path, text } от plan-narration.mjs
    [Parameter(Mandatory = $true)][string]$PlanFile,
    # Корень пакета контента (там, где assets/)
    [Parameter(Mandatory = $true)][string]$PackageRoot,
    # ffmpeg: полный путь либо имя в PATH
    [string]$FfmpegPath = 'ffmpeg',
    # Имя голоса SAPI; при отсутствии берётся любой женский
    [string]$VoiceName = 'Microsoft Irina Desktop',
    # Качество mp3 для libmp3lame: 4 — тот же параметр, что у «Матемашки»
    [int]$Quality = 4,
    # Перегенерировать уже существующие файлы
    [switch]$Force,
    # Выровнять громкость. SAPI отдаёт заметно тихий звук (пик порядка -15 dB),
    # а плеер поверх этого применяет свою громкость — в группе детей такую
    # озвучку не слышно. loudnorm приводит всё к -16 LUFS с запасом по пику.
    [bool]$Normalize = $true
)

$ErrorActionPreference = 'Stop'
$MIN_WAV_BYTES = 2000
$MAX_ATTEMPTS = 3

$logFile = Join-Path $PSScriptRoot 'generate-narration.failures.log'
if (Test-Path $logFile) { Remove-Item $logFile -Force }

function Write-Failure([string]$message) {
    $line = '[' + (Get-Date -Format 'o') + '] ' + $message
    Add-Content -Path $logFile -Value $line -Encoding utf8
    Write-Host "  ОШИБКА: $message" -ForegroundColor Red
}

# ── проверки окружения до начала работы ────────────────────────────────────

if (-not (Test-Path $PlanFile)) { throw "План генерации не найден: $PlanFile" }
if (-not (Test-Path $PackageRoot)) { throw "Каталог пакета не найден: $PackageRoot" }

$ffmpegOk = $false
try {
    & $FfmpegPath -hide_banner -version > $null 2>&1
    $ffmpegOk = $LASTEXITCODE -eq 0
} catch { $ffmpegOk = $false }
if (-not $ffmpegOk) { throw "ffmpeg не запускается: $FfmpegPath" }

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

$installed = $synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo.Name }
if ($installed -contains $VoiceName) {
    $synth.SelectVoice($VoiceName)
    Write-Host "Голос: $VoiceName"
} else {
    # Фолбэк ровно как у «Матемашки»: лучше женский голос не того имени, чем отказ
    $synth.SelectVoiceByHints('Female')
    Write-Host "Голос '$VoiceName' не установлен, взят женский по умолчанию: $($synth.Voice.Name)" -ForegroundColor Yellow
}

$plan = Get-Content $PlanFile -Raw -Encoding utf8 | ConvertFrom-Json
Write-Host "Заданий в плане: $($plan.Count)"
Write-Host ""

$done = 0; $skipped = 0; $failed = 0
$tmpDir = Join-Path $env:TEMP ('words-narration-' + $PID)
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

try {
    foreach ($item in $plan) {
        $target = Join-Path $PackageRoot $item.path

        if ((Test-Path $target) -and -not $Force) { $skipped++; continue }

        $dir = Split-Path $target -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

        $wav = Join-Path $tmpDir ('part-' + $done + '-' + $failed + '.wav')
        $spoken = $false

        for ($attempt = 1; $attempt -le $MAX_ATTEMPTS; $attempt++) {
            try {
                if (Test-Path $wav) { Remove-Item $wav -Force }
                $synth.SetOutputToWaveFile($wav)
                $synth.Speak($item.text)
                $synth.SetOutputToNull()

                # Тихий сбой SAPI: код возврата нулевой, файл почти пустой
                $size = if (Test-Path $wav) { (Get-Item $wav).Length } else { 0 }
                if ($size -ge $MIN_WAV_BYTES) { $spoken = $true; break }
                Write-Host "  попытка ${attempt}: WAV всего $size байт — похоже, подвисла служба Windows Audio" -ForegroundColor Yellow
            } catch {
                try { $synth.SetOutputToNull() } catch {}
                Write-Host "  попытка ${attempt}: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }

        if (-not $spoken) {
            Write-Failure "синтез не удался: $($item.path) — «$($item.text)»"
            $failed++
            continue
        }

        if ($Normalize) {
            & $FfmpegPath -hide_banner -loglevel error -y -i $wav `
                -af 'loudnorm=I=-16:TP=-1.5:LRA=11' `
                -codec:a libmp3lame -qscale:a $Quality $target 2>$null
        } else {
            & $FfmpegPath -hide_banner -loglevel error -y -i $wav `
                -codec:a libmp3lame -qscale:a $Quality $target 2>$null
        }
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) {
            Write-Failure "ffmpeg не сконвертировал: $($item.path)"
            $failed++
        } else {
            $done++
            if ($done % 10 -eq 0) { Write-Host "  готово: $done" }
        }
        Remove-Item $wav -Force -ErrorAction SilentlyContinue
    }
} finally {
    $synth.Dispose()
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Сгенерировано: $done, пропущено готовых: $skipped, не удалось: $failed"
if ($failed -gt 0) {
    Write-Host "Список неудач: $logFile" -ForegroundColor Red
    exit 1
}
