use chrono::Local;
use serde_json::json;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn check_cold_start(app: tauri::AppHandle) -> bool {
    let current_pid = std::process::id() as u64;

    let store: Arc<tauri_plugin_store::Store<tauri::Wry>> = match app.store("cold_start.store") {
        Ok(store) => store,
        Err(err) => {
            log::warn!("init cold_start store failed: {}", err);
            return true;
        }
    };

    let existing_pid: u64 = match store.get("cold_start_token") {
        Some(val) => val.as_u64().unwrap_or(0),
        None => 0,
    };

    let is_cold = existing_pid == 0 || existing_pid != current_pid;

    store.set("cold_start_token", json!(current_pid));
    if let Err(err) = store.save() {
        log::warn!("save cold_start_token failed: {}", err);
    }

    is_cold
}

#[tauri::command(rename_all = "snake_case")]
fn run_cli(program: String, args: Vec<String>) -> String {
    // 尝试执行命令并捕获输出
    #[cfg(target_os = "windows")]
    let result = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new(&program)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    };

    #[cfg(not(target_os = "windows"))]
    let result = Command::new(&program)
        .args(args)
        .output();

    match result {
        Ok(output) => {
            // 将输出转换为字符串并返回
            match String::from_utf8(output.stdout) {
                Ok(result) => result,
                Err(e) => format!("Error decoding output: {}", e),
            }
        }
        Err(e) => {
            println!("Failed to execute process: {}", e);
            return format!("Error: {}", e);
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
fn run_command(program: String, args: Vec<String>) -> String {
    // 尝试执行命令并捕获错误
    #[cfg(target_os = "windows")]
    let result = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new(&program)
            .args(args)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
    };

    #[cfg(not(target_os = "windows"))]
    let result = Command::new(&program)
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();

    match result {
        Ok(child) => {
            let pid = child.id();
            return pid.to_string();
        }
        Err(e) => {
            println!("Failed to execute process: {}", e);
            return format!("Error: {}", e);
        }
    }
}

#[tauri::command]
fn get_exe_directory() -> String {
    match std::env::current_exe() {
        Ok(exe_path) => {
            if let Some(parent) = exe_path.parent() {
                return parent.display().to_string();
            }
            "".to_string()
        }
        Err(e) => {
            println!("failed to get current exe path: {e}");
            "".to_string()
        }
    }
}

// 获取日志目录（优先程序安装目录下的 logs，只读环境回退到用户数据目录）
fn get_log_directory() -> String {
    let exe_log_dir = format!("{}/logs", get_exe_directory());
    if std::fs::create_dir_all(&exe_log_dir).is_ok() {
        return exe_log_dir;
    }
    if let Some(data_dir) = dirs::data_dir() {
        let app_log_dir = data_dir.join("easytier-manager-pro").join("logs");
        if std::fs::create_dir_all(&app_log_dir).is_ok() {
            return app_log_dir.display().to_string();
        }
    }
    exe_log_dir
}

fn show_window(app: &AppHandle) {
    let windows = app.webview_windows();

    windows
        .values()
        .next()
        .expect("Sorry, no window found")
        .set_focus()
        .expect("Can't Bring Window to Focus");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 尝试创建日志目录（如果失败也继续运行）
    let log_dir = get_log_directory();
    let log_dir_created = std::fs::create_dir_all(&log_dir).is_ok();

    if !log_dir_created {
        println!("Warning: Failed to create log directory at: {}", log_dir);
        println!("Logs will only be output to console.");
    }

    let mut builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_command,
            run_cli,
            get_exe_directory,
            check_cold_start
        ])
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_window(app);
        }));

    // 只有在日志目录创建成功时才启用文件日志
    if log_dir_created {
        builder = builder.plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .level(log::LevelFilter::Info)
                .format(|out, message, record| {
                    let date = Local::now().format("%Y-%m-%d %H:%M:%S");
                    let target = record.target().split("@").next().unwrap_or(record.target());
                    out.finish(format_args!(
                        "{} {:<5} [{}]: {}",
                        date,
                        record.level(),
                        target,
                        message
                    ))
                })
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some(format!("{}/{}", log_dir, env!("CARGO_PKG_NAME"))),
                    }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        );
    } else {
        // 日志目录创建失败，仅使用控制台和 Webview 输出
        builder = builder.plugin(
            tauri_plugin_log::Builder::new()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .level(log::LevelFilter::Info)
                .format(|out, message, record| {
                    let date = Local::now().format("%Y-%m-%d %H:%M:%S");
                    let target = record.target().split("@").next().unwrap_or(record.target());
                    out.finish(format_args!(
                        "{} {:<5} [{}]: {}",
                        date,
                        record.level(),
                        target,
                        message
                    ))
                })
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        );
    }

    // 配置插件
    #[cfg_attr(debug_assertions, allow(unused_mut))]
    let mut app_builder = builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build());

    // 仅在生产环境下启用 prevent-default 插件，禁用右键菜单和快捷键
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_prevent_default::{Builder, Flags};
        let prevent_default_plugin = Builder::new()
            .with_flags(Flags::CONTEXT_MENU | Flags::RELOAD | Flags::DEV_TOOLS)
            .build();
        app_builder = app_builder.plugin(prevent_default_plugin);
    }

    app_builder
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                match app.store("cold_start.store") {
                    Ok(store) => {
                        let store: Arc<tauri_plugin_store::Store<tauri::Wry>> = store;
                        if let Err(err) = store.save() {
                            log::warn!("init cold_start store save failed: {}", err);
                        }
                    }
                    Err(err) => log::warn!("init cold_start store failed: {}", err),
                };
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
