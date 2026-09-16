# docs/tools/gdi-screenshot.ps1
#
# Win32 GDI screenshot of a window's client area, by PID - captures exactly
# what shoot-chimiq.js (and any future live-CDP screenshot script) needs
# when `Page.captureScreenshot` over the raw CDP websocket hangs, which it
# does intermittently (see Сценарий_разработки_фичи.md §5a - large payload,
# looks like a compositor issue in a background/non-interactive session, not
# related to the app code itself).
#
# Client-area-only capture (GetClientRect + ClientToScreen), not the whole
# window rect, so the output excludes the OS title bar/borders and matches
# what a CDP Page.captureScreenshot of the same page would have framed.
#
# DPI-awareness is mandatory (see below) - without it this produced a
# consistent several-pixel-wide sliver of whatever window sits behind at
# screen-space origin (found 2026-09-16 regenerating chimiq-user-guide
# screenshots): PowerShell's own unaware DPI context made ClientToScreen/
# GetClientRect report coordinates in a different scale than the physical
# screen pixels CopyFromScreen reads.
#
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File gdi-screenshot.ps1 -ProcessId <pid> -OutPath <file.png>

param(
    [Parameter(Mandatory=$true)][int]$ProcessId,
    [Parameter(Mandatory=$true)][string]$OutPath
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32c {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    [DllImport("user32.dll")]
    public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    public struct POINT { public int X; public int Y; }
}
"@
# DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4 -- without this, PowerShell's own
# (unaware) DPI context can make ClientToScreen/GetClientRect report coordinates in a
# different scale than the actual screen pixels CopyFromScreen reads, producing a
# consistent pixel-offset sliver of whatever sits behind at screen-space origin.
[Win32c]::SetProcessDpiAwarenessContext([IntPtr]::new(-4)) | Out-Null

$proc = Get-Process -Id $ProcessId -ErrorAction Stop
$hwnd = $proc.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) { throw "no main window handle for pid $ProcessId" }

[Win32c]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE
[Win32c]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 600

$clientRect = New-Object Win32c+RECT
[Win32c]::GetClientRect($hwnd, [ref]$clientRect) | Out-Null
$origin = New-Object Win32c+POINT
$origin.X = 0; $origin.Y = 0
[Win32c]::ClientToScreen($hwnd, [ref]$origin) | Out-Null

$w = $clientRect.Right - $clientRect.Left
$h = $clientRect.Bottom - $clientRect.Top

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size $w, $h))
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "saved: $OutPath ($w x $h) origin=$($origin.X),$($origin.Y)"
