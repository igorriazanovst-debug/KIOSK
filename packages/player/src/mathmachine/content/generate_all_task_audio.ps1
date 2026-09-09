# Генерирует офлайн-озвучку ВСЕХ заданий каталога (2835 на момент
# написания, включая уже озвученные 18 пилотных Этапа 1) через встроенный
# Windows System.Speech (SAPI), конвертирует в mp3 через ffmpeg.
#
# Расширяет generate_pilot_audio.ps1 (тот покрывал только 18 пилотных
# заданий Этапа 1) на весь каталог — закрывает ТЗ FR-013 "прочитать текст
# задания" полностью, а не только для 0.6% заданий.
#
# Резюмируемый: пропускает задания, для которых mp3 уже существует на
# диске (в т.ч. уже сгенерированные 18 пилотных) — безопасно прерывать и
# перезапускать при сбое на середине ~2800-файлового прогона.
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$russianVoice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -eq 'Microsoft Irina Desktop' }
if ($russianVoice) {
    $synth.SelectVoice('Microsoft Irina Desktop')
} else {
    Write-Host "Microsoft Irina Desktop not found, falling back to SelectVoiceByHints('Female')"
    $synth.SelectVoiceByHints('Female')
}

$ffmpeg = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe'
if (-not (Test-Path $ffmpeg)) {
    Write-Error "ffmpeg not found at: $ffmpeg"
    exit 1
}
$contentPath = Join-Path $PSScriptRoot 'pilotContent.json'
$mediaDir = Join-Path $PSScriptRoot '..\..\..\public\media'
New-Item -ItemType Directory -Force -Path $mediaDir | Out-Null
$logPath = Join-Path $PSScriptRoot 'audio_generation_failures.log'
if (Test-Path $logPath) { Remove-Item $logPath }

$MIN_WAV_BYTES = 2000

$content = Get-Content $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskIds = $content.tasks.PSObject.Properties.Name
$total = $taskIds.Count
$generated = 0
$skippedExisting = 0
$failed = 0
$i = 0

foreach ($taskId in $taskIds) {
    $i++
    $task = $content.tasks.$taskId
    $wavPath = Join-Path $mediaDir "$taskId.wav"
    $mp3Path = Join-Path $mediaDir "$taskId.mp3"

    if (Test-Path $mp3Path) {
        $skippedExisting++
        continue
    }

    $ok = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $synth.SetOutputToWaveFile($wavPath)
        $synth.Speak($task.text)
        $synth.SetOutputToNull()
        $wavSize = (Get-Item $wavPath).Length
        if ($wavSize -ge $MIN_WAV_BYTES) { $ok = $true; break }
        Start-Sleep -Milliseconds 400
    }
    if (-not $ok) {
        Add-Content -Path $logPath -Value "FAILED (empty wav after 3 attempts): $taskId"
        $failed++
        continue
    }

    & $ffmpeg -y -i $wavPath -codec:a libmp3lame -qscale:a 4 $mp3Path 2>$null
    if (-not (Test-Path $mp3Path)) {
        Add-Content -Path $logPath -Value "FAILED (ffmpeg): $taskId"
        $failed++
        continue
    }
    Remove-Item $wavPath
    $generated++

    if ($i % 100 -eq 0) {
        Write-Host "[$i/$total] generated=$generated skipped=$skippedExisting failed=$failed"
    }
}

Write-Host "DONE. total=$total generated=$generated skippedExisting=$skippedExisting failed=$failed"
if ($failed -gt 0) {
    Write-Host "See $logPath for failed task IDs - re-run this script to retry them (existing mp3s are skipped)."
}
