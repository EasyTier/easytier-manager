# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyTier Manager Pro — a Tauri 2 desktop app (Vue 3 frontend + Rust backend) for visually managing the EasyTier P2P networking kernel. Manages network configurations (TOML files), monitors node/peer status, and handles kernel lifecycle.

## Common Commands

### Development

- `pnpm dev` — Vite dev server on port 4000
- `pnpm td` — Tauri dev mode (frontend + Rust backend together)

### Building

- `pnpm build` — Production frontend build (mode: pro)
- `pnpm tauri:build` — Full Tauri application build
- Platform-specific: `pnpm build:win64`, `pnpm build:win32`, `pnpm build:winarm64`, `pnpm build:mac`, `pnpm build:linux`

### Linting & Type Checking

- `pnpm ts:check` — TypeScript type checking (vue-tsc)
- `pnpm lint:eslint` — ESLint
- `pnpm lint:format` — Prettier
- `pnpm lint:style` — Stylelint
- `pnpm cargo:fix` — Rust cargo fix

### Other

- `pnpm clean` — Remove node_modules
- `pnpm clean:cache` — Clear build cache

## Architecture

### Frontend (`src/`)

- **Vue 3 Composition API** with TypeScript, Element Plus UI, UnoCSS
- **State**: Pinia stores in `src/store/modules/` — `easytier.ts` is the central store managing configs, running processes, kernel versions, STUN servers, and public peers. Persisted to localStorage.
- **Router**: Hash-based (`createWebHashHistory`), 4 routes — Workplace (dashboard), Config, ConfigWeb, Setting
- **Views**: `src/views/index/` (dashboard/monitoring), `src/views/config/` (network config CRUD), `src/views/configWeb/` (web management), `src/views/setting/` (app settings)
- **Key utils**:
  - `easyTierUtil.ts` — Parses CLI table output from EasyTier kernel (node info, peer info), extracts public IPs from logs
  - `shellUtil.ts` — Shell command execution via Tauri, Windows service management
  - `fileUtil.ts` — TOML config file operations via Tauri FS plugin
  - `sysUtil.ts` — System-level utilities
- **i18n**: English (`en.ts`) and Chinese (`zh-CN.ts`) in `src/locales/`
- **Path alias**: `@/*` → `src/*`

### Backend (`src-tauri/`)

- **Rust/Tauri 2** with 4 IPC commands exposed to frontend:
  - `run_cli(program, args)` — Execute CLI and return stdout
  - `run_command(program, args)` — Spawn background process, return PID
  - `get_exe_directory()` — Get application install directory
  - `check_cold_start()` — Detect first launch vs window restore (uses tauri-plugin-store)
- Windows-specific code uses `#[cfg(target_os = "windows")]` for `CREATE_NO_WINDOW` flag
- Logging to `{exe_dir}/logs/` with fallback to console-only if directory creation fails
- Production builds disable right-click menu and dev tools via `tauri-plugin-prevent-default`

### Config Flow

Network configurations are TOML files stored in the Tauri resource directory. The frontend reads/writes them via `tauri-plugin-fs`, parses with `smol-toml`, and launches EasyTier kernel processes via the `run_command` IPC. Running process PIDs are tracked in the `easytier` Pinia store and persisted to localStorage.

## Key Conventions

- Package manager: **pnpm** (>=8.1.0 required, `shamefully-hoist=true`)
- Commit messages: Conventional Commits enforced by commitlint (types: feat, fix, docs, style, refactor, perf, test, ci, chore, revert, workflow, mod, wip, types, release)
- Pre-commit: lint-staged via Husky
- Node.js >=18.0.0, Rust >=1.92.0
- Comments in source code are predominantly in Chinese
- Environment configs: `.env.base`, `.env.dev`, `.env.test`, `.env.pro`
