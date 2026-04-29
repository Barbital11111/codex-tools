param(
  [string]$Bundles = "nsis,msi",
  [string]$SigningKeyPath = "$env:USERPROFILE\.tauri\codex-tools-updater.key",
  [string]$SigningKeyPassword,
  [switch]$PrepareManualRelease,
  [string]$Tag,
  [string]$NotesPath,
  [int]$BuildTimeoutSeconds = 300,
  [int]$ArtifactSettleSeconds = 15
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$repoRoot = Split-Path -Parent $PSScriptRoot
$tauriConfigPath = Join-Path $repoRoot "src-tauri/tauri.conf.json"
$bundleRoot = Join-Path $repoRoot "src-tauri/target/release/bundle"
$buildLogRoot = Join-Path $repoRoot "src-tauri/target/release/build-logs"

function Get-RequestedBundles {
  param([string]$BundleList)

  $BundleList -split "," |
    ForEach-Object { $_.Trim().ToLowerInvariant() } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Get-CurrentVersion {
  $tauriConfig = Get-Content -Raw -LiteralPath $tauriConfigPath | ConvertFrom-Json
  [string]$tauriConfig.version
}

function Get-BundleArtifacts {
  param(
    [string]$Version,
    [datetime]$Since,
    [string[]]$RequestedBundles
  )

  $artifacts = @()
  if ($RequestedBundles -contains "nsis") {
    $nsisDir = Join-Path $bundleRoot "nsis"
    if (Test-Path -LiteralPath $nsisDir) {
      $artifacts += Get-ChildItem -LiteralPath $nsisDir -File -Filter "*$Version*setup.exe" |
        Where-Object { $_.LastWriteTime -ge $Since }
    }
  }

  if ($RequestedBundles -contains "msi") {
    $msiDir = Join-Path $bundleRoot "msi"
    if (Test-Path -LiteralPath $msiDir) {
      $artifacts += Get-ChildItem -LiteralPath $msiDir -File -Filter "*$Version*.msi" |
        Where-Object { $_.LastWriteTime -ge $Since }
    }
  }

  $artifacts
}

function Test-ExpectedArtifacts {
  param(
    [string]$Version,
    [datetime]$Since,
    [string[]]$RequestedBundles
  )

  $artifacts = Get-BundleArtifacts -Version $Version -Since $Since -RequestedBundles $RequestedBundles
  foreach ($bundle in $RequestedBundles) {
    if ($bundle -eq "nsis" -and -not ($artifacts | Where-Object { $_.Name -like "*$Version*setup.exe" })) {
      return $false
    }
    if ($bundle -eq "msi" -and -not ($artifacts | Where-Object { $_.Name -like "*$Version*.msi" })) {
      return $false
    }
  }
  return $true
}

function Stop-ProcessTree {
  param([int]$ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Write-LogTail {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path) {
    Write-Host ""
    Write-Host "Log tail: $Path" -ForegroundColor DarkGray
    Get-Content -LiteralPath $Path -Tail 80
  }
}

function Invoke-TauriBuild {
  param([string]$BundleList)

  $version = Get-CurrentVersion
  $requestedBundles = @(Get-RequestedBundles -BundleList $BundleList)
  if ($requestedBundles.Count -eq 0) {
    throw "No bundle targets were requested."
  }

  $tauriCli = Join-Path $repoRoot "node_modules/.bin/tauri.cmd"
  if (-not (Test-Path -LiteralPath $tauriCli)) {
    throw "Tauri CLI was not found. Run npm install first: $tauriCli"
  }

  New-Item -ItemType Directory -Force -Path $buildLogRoot | Out-Null
  $startedAt = Get-Date
  $safeTimestamp = $startedAt.ToString("yyyyMMdd-HHmmss")
  $stdoutLog = Join-Path $buildLogRoot "tauri-build-$version-$safeTimestamp.out.log"
  $stderrLog = Join-Path $buildLogRoot "tauri-build-$version-$safeTimestamp.err.log"

  Write-Host "  Version: $version"
  Write-Host "  Tauri:   $tauriCli"
  Write-Host "  Logs:    $buildLogRoot"
  Write-Host ""

  $process = Start-Process `
    -FilePath $tauriCli `
    -ArgumentList @("build", "--bundles", $BundleList) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -NoNewWindow `
    -PassThru

  $artifactDetectedAt = $null
  $completedByArtifacts = $false
  $artifactSince = $startedAt.AddSeconds(-2)

  while ($true) {
    Start-Sleep -Seconds 2
    $process.Refresh()

    if ($process.HasExited) {
      break
    }

    $elapsedSeconds = [int]((Get-Date) - $startedAt).TotalSeconds
    $hasExpectedArtifacts = Test-ExpectedArtifacts `
      -Version $version `
      -Since $artifactSince `
      -RequestedBundles $requestedBundles

    if ($hasExpectedArtifacts) {
      if ($null -eq $artifactDetectedAt) {
        $artifactDetectedAt = Get-Date
        Write-Host "  Detected fresh installer artifacts. Waiting $ArtifactSettleSeconds seconds for file handles to settle..." -ForegroundColor Yellow
      }
      elseif (((Get-Date) - $artifactDetectedAt).TotalSeconds -ge $ArtifactSettleSeconds) {
        Write-Host "  Build artifacts are stable; stopping lingering build wrapper process." -ForegroundColor Yellow
        Stop-ProcessTree -ProcessId $process.Id
        $completedByArtifacts = $true
        break
      }
    }

    if ($elapsedSeconds -ge $BuildTimeoutSeconds) {
      if ($hasExpectedArtifacts) {
        Write-Host "  Build timeout reached, but expected artifacts exist; stopping lingering process." -ForegroundColor Yellow
        Stop-ProcessTree -ProcessId $process.Id
        $completedByArtifacts = $true
        break
      }

      Stop-ProcessTree -ProcessId $process.Id
      Write-LogTail -Path $stdoutLog
      Write-LogTail -Path $stderrLog
      throw "tauri build exceeded $BuildTimeoutSeconds seconds and expected artifacts were not produced."
    }
  }

  if (-not $completedByArtifacts) {
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
      Write-LogTail -Path $stdoutLog
      Write-LogTail -Path $stderrLog
      throw "tauri build failed with exit code: $($process.ExitCode)"
    }
  }

  if (-not (Test-ExpectedArtifacts -Version $version -Since $artifactSince -RequestedBundles $requestedBundles)) {
    Write-LogTail -Path $stdoutLog
    Write-LogTail -Path $stderrLog
    throw "tauri build finished, but expected installer artifacts for version $version were not found."
  }

  Write-Host ""
  Write-Host "Built installer artifacts:" -ForegroundColor Green
  Get-BundleArtifacts -Version $version -Since $artifactSince -RequestedBundles $requestedBundles |
    Sort-Object FullName |
    ForEach-Object { Write-Host "  $($_.FullName)" }
}

if (-not (Test-Path -LiteralPath $SigningKeyPath)) {
  throw "Local updater signing key was not found: $SigningKeyPath"
}

$privateKey = Get-Content -Raw -LiteralPath $SigningKeyPath
if ([string]::IsNullOrWhiteSpace($privateKey)) {
  throw "Local updater signing key file is empty: $SigningKeyPath"
}

$privateKey = $privateKey.Trim()
$privateKeyEnvValue = $null
$decodedKey = $null

if ($privateKey -match "secret key") {
  $decodedKey = $privateKey
  $privateKeyEnvValue = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($privateKey))
}
else {
  try {
    $decodedCandidate = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($privateKey)).Trim()
    if ($decodedCandidate -match "secret key") {
      $decodedKey = $decodedCandidate
      $privateKeyEnvValue = $privateKey
    }
  }
  catch {
  }
}

if ($null -eq $decodedKey -or $decodedKey -notmatch "(minisign|rsign).+secret key") {
  throw "The provided file does not look like a supported minisign/rsign private key: $SigningKeyPath"
}

$previousPrivateKey = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY", "Process")
$previousPassword = [Environment]::GetEnvironmentVariable("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "Process")

try {
  $env:TAURI_SIGNING_PRIVATE_KEY = $privateKeyEnvValue

  if (-not [string]::IsNullOrEmpty($SigningKeyPassword)) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $SigningKeyPassword
  }
  if ([string]::IsNullOrEmpty($SigningKeyPassword) -and [string]::IsNullOrEmpty($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD)) {
    Write-Host "No signing key password was provided. If the key is password protected, signing will fail." -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "Starting local signed build..." -ForegroundColor Cyan
  Write-Host "  Key file: $SigningKeyPath"
  Write-Host "  Bundles:  $Bundles"
  Write-Host ""

  Invoke-TauriBuild -BundleList $Bundles

  if ($PrepareManualRelease) {
    $tauriConfig = Get-Content -Raw -LiteralPath $tauriConfigPath | ConvertFrom-Json
    if (-not $Tag) {
      $Tag = "v$($tauriConfig.version)"
    }

    Write-Host ""
    Write-Host "Preparing manual release assets..." -ForegroundColor Cyan
    Write-Host "  Tag: $Tag"
    Write-Host ""

    $prepareArgs = @(
      "-ExecutionPolicy", "Bypass",
      "-File", (Join-Path $repoRoot "scripts\prepare-manual-release.ps1"),
      "-Tag", $Tag
    )

    if ($NotesPath) {
      $prepareArgs += @("-NotesPath", $NotesPath)
    }

    & powershell @prepareArgs
    $prepareExitCode = $LASTEXITCODE

    if ($prepareExitCode -ne 0) {
      throw "prepare-manual-release.ps1 failed with exit code: $prepareExitCode"
    }
  }
}
finally {
  if ($null -eq $previousPrivateKey) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  }
  else {
    $env:TAURI_SIGNING_PRIVATE_KEY = $previousPrivateKey
  }

  if ($null -eq $previousPassword) {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
  }
  else {
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousPassword
  }
}
