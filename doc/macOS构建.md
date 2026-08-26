# macOS Apple Silicon 构建指南

## 适用范围

`CI Pro MacOS ARM64` 用于构建 EasyTier 管理器 Pro 的 Apple Silicon 版本。该工作流使用 `macos-14` runner 和 `aarch64-apple-darwin` 目标，产物为 DMG。

当前构建为 ad-hoc 签名，不包含 Apple Developer ID 签名或 notarization，适合开发和本地验证，不等同于面向公众分发的正式签名包。

## 触发构建

工作流文件：`.github/workflows/build-macos-local.yml`

支持两种触发方式：

1. 将提交推送到 `codex/macos-local-build` 分支。
2. 在 GitHub Actions 页面手动运行 `CI Pro MacOS ARM64`。

构建完成后，下载名为 `easytier-manager-pro-macos-arm64` 的 artifact，其中包含：

```text
easytier-manager-pro-aarch64.dmg
```

## 本地验证

下载后建议依次执行：

```bash
hdiutil verify easytier-manager-pro-aarch64.dmg
```

只读挂载 DMG 后，验证应用签名和 Apple Silicon 架构：

```bash
codesign --verify --deep --strict --verbose=2 easytier-manager-pro.app
file easytier-manager-pro.app/Contents/MacOS/easytier-manager-pro
lipo -archs easytier-manager-pro.app/Contents/MacOS/easytier-manager-pro
```

预期架构输出为 `arm64`。安装新版本后请退出旧 App 并重新启动，工作台才会重新扫描实际运行的 `easytier-core` 进程。

## 工作台运行状态和操作列

macOS 的进程命令行可能包含带空格的 `Application Support` 路径。工作台会从结构化进程字段和完整命令行中识别配置文件，避免把路径截断为 `Application.toml`。

macOS 工作台操作列支持 Ping、端口检测和 SSH；Windows 额外支持 RDP 和 Xshell。macOS 端口检测通过 Terminal 执行 `nc`，需要允许应用控制 Terminal。
