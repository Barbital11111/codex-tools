$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$devRoot = Join-Path $repoRoot ".dev-runtime"
$appDataDir = Join-Path $devRoot "app-data"
$codexDir = Join-Path $devRoot "codex"

New-Item -ItemType Directory -Force -Path $appDataDir | Out-Null
New-Item -ItemType Directory -Force -Path $codexDir | Out-Null

function Copy-IfMissing {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (!(Test-Path -LiteralPath $Source) -or (Test-Path -LiteralPath $Destination)) {
        return
    }

    $parent = Split-Path -Parent $Destination
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

$prodAppDataDir = Join-Path $env:APPDATA "com.carry.codex-tools"
Copy-IfMissing -Source (Join-Path $prodAppDataDir "accounts.json") -Destination (Join-Path $appDataDir "accounts.json")
Copy-IfMissing -Source (Join-Path $prodAppDataDir "profiles") -Destination (Join-Path $appDataDir "profiles")

$devAccountsPath = Join-Path $appDataDir "accounts.json"
if (Test-Path -LiteralPath $devAccountsPath) {
    try {
        $store = Get-Content -LiteralPath $devAccountsPath -Raw | ConvertFrom-Json
        if ($store.settings) {
            $store.settings.launchAtStartup = $false
            $store | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $devAccountsPath -Encoding UTF8
        }
    } catch {
        Write-Warning ("无法重写开发预览开机启动设置: {0}" -f $_.Exception.Message)
    }
}

$prodCodexDir = Join-Path $env:USERPROFILE ".codex"
Copy-IfMissing -Source (Join-Path $prodCodexDir "auth.json") -Destination (Join-Path $codexDir "auth.json")
Copy-IfMissing -Source (Join-Path $prodCodexDir "config.toml") -Destination (Join-Path $codexDir "config.toml")

$env:CODEX_TOOLS_DEV_DATA_DIR = $appDataDir
$env:CODEX_TOOLS_DEV_CODEX_DIR = $codexDir

$cargoBin = Join-Path $env:USERPROFILE ".cargo\\bin"
if (Test-Path -LiteralPath $cargoBin) {
    $env:PATH = "$cargoBin;$env:PATH"
}

$rustToolchainBin = Join-Path $env:USERPROFILE ".rustup\\toolchains\\stable-x86_64-pc-windows-msvc\\bin"
if (Test-Path -LiteralPath $rustToolchainBin) {
    $env:PATH = "$rustToolchainBin;$env:PATH"
    $rustcBin = Join-Path $rustToolchainBin "rustc.exe"
    if (Test-Path -LiteralPath $rustcBin) {
        $env:RUSTC = $rustcBin
    }
}

Write-Host "开发预览将使用隔离目录:"
Write-Host ("  app data: {0}" -f $appDataDir)
Write-Host ("  codex dir: {0}" -f $codexDir)

$devTauriConfigPath = Join-Path $devRoot "tauri.dev.conf.json"
$devTauriConfig = @{
    productName = "Codex Tools Dev"
    identifier = "com.carry.codex-tools.dev"
    app = @{
        windows = @(
            @{
                title = "Codex Tools Dev"
                width = 1320
                height = 960
                resizable = $true
            }
        )
    }
} | ConvertTo-Json -Depth 8
Set-Content -LiteralPath $devTauriConfigPath -Value $devTauriConfig -Encoding UTF8
Write-Host ("  tauri config: {0}" -f $devTauriConfigPath)

Set-Location $repoRoot
npm run tauri -- dev --config $devTauriConfigPath
