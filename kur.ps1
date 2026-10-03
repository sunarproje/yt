$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Check-Exit($message) { if ($LASTEXITCODE -ne 0) { throw $message } }
$pythonExe = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path $pythonExe)) { throw 'Bu bilgisayardaki Python kurulumu bulunamadi.' }
Get-Command node,git -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Force '.runtime\temp' | Out-Null
$env:TEMP = (Resolve-Path '.runtime\temp').Path
$env:TMP = $env:TEMP
& $pythonExe -m pip install --disable-pip-version-check --no-cache-dir --upgrade --target '.runtime\packages' -r requirements.txt
Check-Exit 'Paket kurulumu basarisiz.'
node test.mjs
Check-Exit 'Testler basarisiz.'
git add -- .gitignore .github/workflows/update.yml kur.ps1 yayinla.ps1
Check-Exit 'Kurulum dosyalari eklenemedi.'
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    git -c user.name='Beleş TiVi Publisher' -c user.email='sunarproje@users.noreply.github.com' commit -m 'Run scheduled extraction on local computer'
    Check-Exit 'Kurulum kaydi basarisiz.'
} elseif ($LASTEXITCODE -ne 0) { throw 'Git durumu okunamadi.' }
git push origin main
Check-Exit 'GitHub girisi/gonderimi tamamlanamadi. Giris yaptiktan sonra tekrar calistirin.'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'yayinla.ps1') -Interactive
Check-Exit 'Ilk yayinlama basarisiz; saatlik gorev kurulmadı.'
$scriptPath = Join-Path $PSScriptRoot 'yayinla.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`"" -WorkingDirectory $PSScriptRoot
$hourly = New-ScheduledTaskTrigger -Once -At (Get-Date).AddHours(1) -RepetitionInterval (New-TimeSpan -Hours 1)
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$logon = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'Belestivi-YouTube-Yenile' -Action $action -Trigger @($hourly,$logon) -Principal $principal -Settings $settings -Description 'YouTube canli listelerini yeniler ve sunarproje/yt deposuna gonderir.' -Force | Out-Null
Write-Host 'TAMAM: Ilk yayinlama basarili. Saatlik ve oturum acilisinda yenileme kuruldu.'
Write-Host 'Windows oturumunuz acik ve bilgisayar uyanik olmali. Kilit ekraninda calisir.'
