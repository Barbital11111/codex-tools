# 自动更新发布说明

这份说明用于补齐 Tauri updater 所需的发布资产，避免应用内出现：

- `Could not fetch a valid release JSON from the remote`
- `检查更新失败：...`

## 你需要准备的东西

### 1. Updater 私钥 / 公钥

Tauri updater 必须使用一对固定的签名密钥：

- `pubkey`：写入 `src-tauri/tauri.conf.json`
- 私钥：用于给安装包生成 `.sig`

可以使用 Tauri CLI 生成一套新密钥：

```powershell
npx @tauri-apps/cli signer generate -w "$env:USERPROFILE\\.tauri\\codex-tools-updater.key"
```

如果你丢失了当前已发布版本对应的私钥，**这批已经安装的用户就无法继续通过应用内更新升级**。这种情况下只能：

1. 生成一套新的 updater 密钥
2. 发布一个新版本（例如 `1.8.3`）
3. 让用户手动覆盖安装一次
4. 从这个新版本开始恢复自动更新

### 2. GitHub Release 里必须存在的资产

至少要有这些：

- `Codex-Tools-<version>-x64-setup.exe`
- `Codex-Tools-<version>-x64-setup.exe.sig`
- `latest.json`

建议同时上传：

- `Codex-Tools-<version>-x64.msi`
- `Codex-Tools-<version>-x64.msi.sig`

## GitHub Actions 自动发布

仓库已配置 `.github/workflows/release.yml`。

需要在仓库 Secrets and variables -> Actions -> Secrets 中设置：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（如果私钥有密码）

然后推送 tag：

```powershell
git tag v1.8.3
git push origin v1.8.3
```

只要私钥配置正确，GitHub Actions 会自动上传：

- 安装包
- `.sig`
- `latest.json`

## 手工发布（不依赖 Actions）

### 第一步：在本机带签名构建

仓库已经内置一个本地脚本，会默认读取：

- `%USERPROFILE%\.tauri\codex-tools-updater.key`

直接执行：

```powershell
npm run release:build-local-signed
```

如果私钥有密码，可以先在当前终端设置：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "你的密码"
npm run release:build-local-signed
```

也可以显式传参：

```powershell
npm run release:build-local-signed -- -SigningKeyPassword "你的密码"
```

如果你希望构建完成后顺手整理 `latest.json` 和手工发布目录：

```powershell
npm run release:build-local-signed -- -PrepareManualRelease
```

### 备用做法：手动设置环境变量再构建

在 PowerShell 中先设置签名环境变量：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "你的私钥文件路径，或私钥内容本身"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "可选密码"
```

然后执行构建：

```powershell
npx @tauri-apps/cli build
```

成功后，Windows 产物会出现在：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

并同时生成对应 `.sig`

### 第二步：生成 `latest.json`

仓库内置了脚本：

```powershell
npm run release:prepare-manual -- -Tag v1.8.3
```

默认会：

1. 读取当前版本号与仓库地址
2. 从 `bundle/nsis` 与 `bundle/msi` 中查找安装包和 `.sig`
3. 生成可直接上传到 GitHub Release 的 `latest.json`
4. 把这些文件整理到 `release/v1.8.3/`

### 第三步：上传到 GitHub Release

至少上传：

- `Codex-Tools-1.8.3-x64-setup.exe`
- `Codex-Tools-1.8.3-x64-setup.exe.sig`
- `latest.json`

建议再附带：

- `Codex-Tools-1.8.3-x64.msi`
- `Codex-Tools-1.8.3-x64.msi.sig`

## 发布后校验

可以直接运行：

```powershell
npm run release:check-updater -- -Tag v1.8.3
```

它会检查 release 里是否包含：

- `latest.json`
- `setup.exe`
- `setup.exe.sig`
- `msi`
- `msi.sig`

并在 `latest.json` 存在时打印内容。
