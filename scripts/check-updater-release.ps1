param(
  [string]$Repository,
  [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$repoRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $repoRoot "package.json"

if (-not $Repository) {
  $packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
  $Repository = ([string]$packageJson.repository.url) -replace "^https://github.com/", "" -replace "\.git$", ""
}

$apiUrl = if ($Tag -eq "latest") {
  "https://api.github.com/repos/$Repository/releases/latest"
} else {
  "https://api.github.com/repos/$Repository/releases/tags/$Tag"
}

$release = Invoke-RestMethod -Uri $apiUrl
$assetNames = @($release.assets | ForEach-Object { $_.name })

Write-Host "Release: $($release.tag_name)  $($release.html_url)"
Write-Host "Assets:"
$assetNames | ForEach-Object { Write-Host "  - $_" }

$latestAsset = $release.assets | Where-Object { $_.name -eq "latest.json" } | Select-Object -First 1
$hasNsis = @($assetNames | Where-Object { $_ -like "*-setup.exe" }).Count -gt 0
$hasNsisSig = @($assetNames | Where-Object { $_ -like "*-setup.exe.sig" }).Count -gt 0
$hasMsi = @($assetNames | Where-Object { $_ -like "*.msi" }).Count -gt 0
$hasMsiSig = @($assetNames | Where-Object { $_ -like "*.msi.sig" }).Count -gt 0

Write-Host ""
Write-Host "检查结果："
Write-Host "  latest.json:   " -NoNewline
Write-Host ($(if ($latestAsset) { "OK" } else { "缺失" })) -ForegroundColor $(if ($latestAsset) { "Green" } else { "Red" })
Write-Host "  setup.exe:     " -NoNewline
Write-Host ($(if ($hasNsis) { "OK" } else { "缺失" })) -ForegroundColor $(if ($hasNsis) { "Green" } else { "Red" })
Write-Host "  setup.exe.sig: " -NoNewline
Write-Host ($(if ($hasNsisSig) { "OK" } else { "缺失" })) -ForegroundColor $(if ($hasNsisSig) { "Green" } else { "Red" })
Write-Host "  msi:           " -NoNewline
Write-Host ($(if ($hasMsi) { "OK" } else { "缺失" })) -ForegroundColor $(if ($hasMsi) { "Green" } else { "Red" })
Write-Host "  msi.sig:       " -NoNewline
Write-Host ($(if ($hasMsiSig) { "OK" } else { "缺失" })) -ForegroundColor $(if ($hasMsiSig) { "Green" } else { "Red" })

if ($latestAsset) {
  Write-Host ""
  Write-Host "latest.json:"
  Invoke-RestMethod -Uri $latestAsset.browser_download_url | ConvertTo-Json -Depth 6
}
