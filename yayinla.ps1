param([switch]$Interactive)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$mutex = [Threading.Mutex]::new($false, 'Local\BelestiviYouTubePublisher')
if (-not $mutex.WaitOne(0)) { exit 0 }
try {
    New-Item -ItemType Directory -Force '.runtime' | Out-Null
    Start-Transcript -Path '.runtime\last-run.log' -Force | Out-Null
    if (-not $Interactive) {
        $env:GIT_TERMINAL_PROMPT = '0'
        $env:GCM_INTERACTIVE = 'never'
    }
    git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'GitHub degisiklikleri alinamadi. Yerel degisiklikleri kontrol edin.' }
    $env:PYTHON = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    $env:PYTHONPATH = Join-Path $PSScriptRoot '.runtime\packages'
    & $env:PYTHON -m yt_dlp --version
    if ($LASTEXITCODE -ne 0) { throw 'Once kur.ps1 calistirilmali.' }
    node update.mjs
    $failed = $LASTEXITCODE
    if (-not (Test-Path 'streams/status.json')) { throw 'Sonuc dosyasi uretilemedi.' }
    git add -- streams
    if ($LASTEXITCODE -ne 0) { throw 'Listeler Git dizinine eklenemedi.' }
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        git -c user.name='Beleş TiVi Publisher' -c user.email='sunarproje@users.noreply.github.com' commit -m 'Refresh live playlists from local computer'
        if ($LASTEXITCODE -ne 0) { throw 'Liste kaydi basarisiz.' }
    } elseif ($LASTEXITCODE -ne 0) { throw 'Git durumu okunamadi.' }
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'GitHub gonderimi basarisiz. Tekrar calistirmada yeniden denenecek.' }
    if ($failed -ne 0) { throw 'Bir veya daha fazla yayin acilamadi. streams/status.json dosyasini kontrol edin.' }
    Write-Host 'Listeler yenilendi ve GitHub gonderimi tamamlandi.'
} finally {
    Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
