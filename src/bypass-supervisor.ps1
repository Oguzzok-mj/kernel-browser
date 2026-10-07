param([Parameter(Mandatory=$true)][string]$RunDir)
$ErrorActionPreference = 'Stop'
$ownedProcess = $null
function Write-Status([string]$phase, [string]$detail) {
  $statusPath = Join-Path $RunDir 'status.json'
  @{ phase=$phase; detail=$detail } | ConvertTo-Json | Set-Content -LiteralPath ($statusPath + '.tmp') -Encoding UTF8
  Move-Item -LiteralPath ($statusPath + '.tmp') -Destination $statusPath -Force
}
try {
  $cfg = Get-Content -LiteralPath (Join-Path $RunDir 'config.json') -Raw | ConvertFrom-Json
  if ([IO.Path]::GetFileName($cfg.exe) -ne 'winws.exe') { throw 'Unexpected executable' }
  if ((Get-FileHash -LiteralPath $cfg.exe -Algorithm SHA256).Hash.ToLower() -ne $cfg.digest) { throw 'Executable checksum mismatch' }
  $parentProcess = Get-Process -Id $cfg.parentPid -ErrorAction Stop
  $parentStarted = $parentProcess.StartTime
  if (Test-Path -LiteralPath (Join-Path $RunDir 'stop')) { Write-Status 'off' ''; exit }
  # Win32 quoting: args are passed to winws, never to a command shell.
  $quotedArgs = @($cfg.args | ForEach-Object { '"' + ([string]$_).Replace('"', '\"') + '"' }) -join ' '
  $ownedProcess = Start-Process -FilePath $cfg.exe -ArgumentList $quotedArgs -WorkingDirectory ([IO.Path]::GetDirectoryName($cfg.exe)) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $RunDir 'stdout.log') -RedirectStandardError (Join-Path $RunDir 'stderr.log')
  Start-Sleep -Milliseconds 1400
  if ($ownedProcess.HasExited) { throw ('winws exited: ' + (Get-Content -LiteralPath (Join-Path $RunDir 'stderr.log') -Raw)) }
  Write-Status 'on' 'WinDivert запущен. Доступность сайта зависит от сети и стратегии.'
  while (-not $ownedProcess.HasExited) {
    if (Test-Path -LiteralPath (Join-Path $RunDir 'stop')) { break }
    $parentNow = Get-Process -Id $cfg.parentPid -ErrorAction SilentlyContinue
    if (-not $parentNow -or $parentNow.StartTime -ne $parentStarted) { break }
    $heartbeat = Get-Item -LiteralPath (Join-Path $RunDir 'heartbeat') -ErrorAction SilentlyContinue
    if (-not $heartbeat -or ((Get-Date) - $heartbeat.LastWriteTime).TotalSeconds -gt 15) { break }
    Start-Sleep -Seconds 1
    $ownedProcess.Refresh()
  }
  if ($ownedProcess.HasExited -and -not (Test-Path -LiteralPath (Join-Path $RunDir 'stop'))) { throw 'winws stopped unexpectedly. Try a different strategy.' }
  if (-not $ownedProcess.HasExited) { $ownedProcess.Kill(); $ownedProcess.WaitForExit(5000) | Out-Null }
  Write-Status 'off' ''
} catch {
  Write-Status 'error' $_.Exception.Message
} finally {
  if ($ownedProcess -and -not $ownedProcess.HasExited) { $ownedProcess.Kill() }
}
