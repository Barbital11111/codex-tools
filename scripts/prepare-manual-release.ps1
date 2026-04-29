param(
  [string]$Tag,
  [string]$Version,
  [string]$ReleaseBaseUrl,
  [string]$NotesPath
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $repoRoot "package.json"
$tauriConfigPath = Join-Path $repoRoot "src-tauri/tauri.conf.json"
$bundleRoot = Join-Path $repoRoot "src-tauri/target/release/bundle"

$packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
$tauriConfig = Get-Content -Raw $tauriConfigPath | ConvertFrom-Json

if (-not $Version) {
  $Version = [string]$tauriConfig.version
}

if (-not $Version) {
  throw "无法推断版本号，请通过 -Version 传入。"
}

if (-not $Tag) {
  $Tag = "v$Version"
}

$repositoryUrl = ([string]$packageJson.repository.url) -replace "\.git$", ""
if (-not $ReleaseBaseUrl) {
  $ReleaseBaseUrl = "$repositoryUrl/releases/download/$Tag"
}

$nsisInstaller = Get-ChildItem -Path (Join-Path $bundleRoot "nsis") -Filter "*-setup.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$nsisSignature = Get-ChildItem -Path (Join-Path $bundleRoot "nsis") -Filter "*-setup.exe.sig" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$msiInstaller = Get-ChildItem -Path (Join-Path $bundleRoot "msi") -Filter "*.msi" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$msiSignature = Get-ChildItem -Path (Join-Path $bundleRoot "msi") -Filter "*.msi.sig" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $nsisInstaller -or -not $nsisSignature) {
  throw "未找到 NSIS 安装包或签名。请先在已设置 TAURI_SIGNING_PRIVATE_KEY 的环境下执行 Tauri build。"
}

$notes = ""
if ($NotesPath) {
  $notes = Get-Content -Raw $NotesPath
}

$outputDir = Join-Path $repoRoot "release/$Tag"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Copy-Item -Force $nsisInstaller.FullName (Join-Path $outputDir $nsisInstaller.Name)
Copy-Item -Force $nsisSignature.FullName (Join-Path $outputDir $nsisSignature.Name)

if ($msiInstaller -and $msiSignature) {
  Copy-Item -Force $msiInstaller.FullName (Join-Path $outputDir $msiInstaller.Name)
  Copy-Item -Force $msiSignature.FullName (Join-Path $outputDir $msiSignature.Name)
}

$latestJson = [ordered]@{
  version = $Version
  notes = $notes.Trim()
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = (Get-Content -Raw $nsisSignature.FullName).Trim()
      url = "$ReleaseBaseUrl/$($nsisInstaller.Name)"
    }
  }
}

$latestJsonPath = Join-Path $outputDir "latest.json"
$latestJson | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $latestJsonPath

Write-Host ""
Write-Host "手工 release 资产已准备完成：" -ForegroundColor Green
Write-Host "  输出目录: $outputDir"
Write-Host "  latest.json: $latestJsonPath"
Write-Host "  NSIS: $($nsisInstaller.Name)"
Write-Host "  NSIS.sig: $($nsisSignature.Name)"
if ($msiInstaller -and $msiSignature) {
  Write-Host "  MSI: $($msiInstaller.Name)"
  Write-Host "  MSI.sig: $($msiSignature.Name)"
}
