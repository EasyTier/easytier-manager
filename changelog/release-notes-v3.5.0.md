# EasyTier 管理器 Pro v3.5.0

## 🎉 重大更新

### 正式支持 MacOS（Apple Silicon）

本版本首次支持 **MacOS Apple Silicon（arm64）** 平台，合并自 PR #49（commit `cde4b8be`）。Windows 与 MacOS 现可通过同一发布流程构建，本次 Release 包含两端全部产物。

> ⚠️ MacOS 版本使用 **ad-hoc 签名**，未经过 Apple Developer ID 签名或公证（notarization），适合开发验证与本地分发。首次打开时需手动信任，详见下方说明。

---

## ✨ 新功能

- **MacOS Apple Silicon 构建**：新增 `aarch64-apple-darwin` 目标构建，产出 `.app` 与 `.dmg`，支持在 M1/M2/M3 等 Apple Silicon Mac 上运行。
- **MacOS 工作台进程状态修复**：修复工作台无法识别实际运行的 `easytier-core` 进程的问题，安装新版本后请退出旧 App 并重新启动，工作台才会重新扫描进程。
- **MacOS 节点操作列**：工作台节点列表在 MacOS 上支持 Ping、端口检测（通过 Terminal 执行 `nc`）、SSH 连接。Windows 额外支持 RDP 和 Xshell。
- **配置文件名识别优化**：MacOS 进程命令行可能包含带空格的 `Application Support` 路径，工作台现从结构化进程字段和完整命令行中识别配置文件，避免路径被截断为 `Application.toml`。
- **RPC Portal 命令行参数传递**：运行中的内核改用默认 RPC Portal，并通过命令行参数传递。

## 🐛 修复

- 修复 MacOS 工作台进程状态显示不正确的问题。
- 修复 MacOS 上内核进程命令行被截断导致配置文件识别错误的问题。
- 修复 RPC Portal 读取方式导致节点信息获取异常的问题。

## 🔧 技术改进

- 新增 MacOS ARM64 CI 构建工作流（`build-MacOS-local.yml`），含 ad-hoc 签名、DMG 打包与挂载校验。
- 新增统一多平台发布工作流（`release-pro-all.yml`），并行构建 Windows 与 MacOS 产物后汇总到同一草稿 Release。

---

## 📦 下载与安装

### Windows

| 文件 | 说明 |
|---|---|
| `easytier-manager-pro_3.5.0_x64-setup.exe` | **推荐**，NSIS 安装包 |
| `easytier-manager-pro_3.5.0_x64_en-US.msi` | MSI 安装包 |
| `easytier-manager-pro.zip` | 便携版，解压即用，免安装 |

安装注意事项：
- 推荐使用 NSIS 安装包（`*-setup.exe`）。
- 如使用安装包，请确保安装路径**没有中文和空格**。

### MacOS（Apple Silicon）

| 文件 | 说明 |
|---|---|
| `easytier-manager-pro-aarch64.dmg` | Apple Silicon（M1/M2/M3）DMG 安装包 |

**仅支持 Apple Silicon 架构**，Intel Mac 暂不支持。

#### 安装步骤

1. 下载 `easytier-manager-pro-aarch64.dmg`。
2. 双击打开 DMG，将 `easytier-manager-pro.app` 拖入 `Applications` 文件夹。
3. 首次启动时，因使用 ad-hoc 签名（未经 Apple 公证），系统会提示"无法验证开发者"。请按以下方式放行：
   - **方式一（推荐）**：在 Finder 的 `应用程序` 中找到 `easytier-manager-pro`，**右键点击 → 打开**，在弹窗中再次点击"打开"即可放行，后续启动不再提示。
   - **方式二**：若已误点"移到废纸篓"，可前往 `系统设置 → 隐私与安全性`，找到关于该 App 的提示，点击"仍要打开"。
   - **方式三（终端，进阶）**：
     ```bash
     sudo xattr -dr com.apple.quarantine /Applications/easytier-manager-pro.app
     ```

#### 可选：验证 DMG 与架构

```bash
# 验证 DMG 完整性
hdiutil verify easytier-manager-pro-aarch64.dmg

# 挂载后验证签名与架构
hdiutil attach easytier-manager-pro-aarch64.dmg
codesign --verify --deep --strict --verbose=2 "/Volumes/EasyTier Manager Pro/easytier-manager-pro.app"
file "/Volumes/EasyTier Manager Pro/easytier-manager-pro.app/Contents/MacOS/easytier-manager-pro"
lipo -archs "/Volumes/EasyTier Manager Pro/easytier-manager-pro.app/Contents/MacOS/easytier-manager-pro"
hdiutil detach "/Volumes/EasyTier Manager Pro"
```

预期架构输出为 `arm64`。

#### MacOS 使用注意

- **Terminal 权限**：端口检测通过 Terminal 执行 `nc` 命令，首次使用时系统可能要求授权应用控制 Terminal，请允许。
- **重启 App**：安装新版本后请**退出旧 App 再启动**，工作台才会重新扫描实际运行的 `easytier-core` 进程。
- **分发限制**：当前为 ad-hoc 签名，未做 Apple Developer ID 签名与公证，正式对外分发需另行配置证书。

---

## ⚠️ 注意事项

1. EasyTier 管理器 Pro v3.0.0 及以上版本与 v2.x 不兼容，建议卸载已安装的旧版服务再使用 v3+。
2. `easytier-manager-pro.zip` 是免安装的 Windows 便携压缩包，其余 `.exe`、`.msi` 为安装包。
3. Windows 沙盒（Windows Sandbox）、精简版系统、各种魔改系统中运行可能无法正常运行。
4. 如遇后台运行内核相关问题，请及时反馈。

## 📋 已知问题

- 若手动刷新界面（不建议尝试），会导致托盘图标失灵、无法退出程序，需通过任务管理器结束进程。

## 🔗 相关链接

- 详细 MacOS 构建指南：[doc/MacOS构建.md](https://github.com/xlc520/easytier-manager/blob/pro/doc/MacOS构建.md)
- 完整提交记录：[GitHub Commits](https://github.com/xlc520/easytier-manager/commits/pro)

---

**Full Changelog**: ...（GitHub 会自动填充 `generate_release_notes` 生成的变更对比链接）
