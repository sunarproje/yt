$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
$oldPythonPath = $env:PYTHONPATH
$oldPython = $env:PYTHON
$oldTemp = $env:TEMP
$oldTmp = $env:TMP
try {
    $bundled = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    $env:PYTHON = if ($env:PYTHON) { $env:PYTHON } elseif (Test-Path $bundled) { $bundled } else { 'python' }
    New-Item -ItemType Directory -Force '.runtime\temp' | Out-Null
    $env:TEMP = (Resolve-Path '.runtime\temp').Path
    $env:TMP = $env:TEMP
    $env:PYTHONPATH = Join-Path $PSScriptRoot '.runtime\packages'
    & $env:PYTHON -m pip install --disable-pip-version-check --no-cache-dir --upgrade --target $env:PYTHONPATH -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python paketleri kurulamadi.' }
    node update.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Bazi yayinlar acilamadi. streams/status.json dosyasina bakin.' }
    Write-Host 'Hazir: streams klasorundeki M3U8 dosyasini VLC ile acabilirsiniz.'
} finally {
    $env:PYTHONPATH = $oldPythonPath
    $env:PYTHON = $oldPython
    $env:TEMP = $oldTemp
    $env:TMP = $oldTmp
    Pop-Location
}
