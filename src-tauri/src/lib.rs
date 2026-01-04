use chrono::Local;
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::{Target, TargetKind};

#[tauri::command(rename_all = "snake_case")]
fn run_cli(program: String, args: Vec<String>) -> String {
    // CREATE_NO_WINDOW: 不创建控制台窗口
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    // DETACHED_PROCESS: 使进程在后台运行
    // const DETACHED_PROCESS: u32 = 0x00000008;
    // 尝试执行命令并捕获输出
    match Command::new(&program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output() // 使用 output() 来获取输出
    {
        Ok(output) => {
            // 将输出转换为字符串并返回
            match String::from_utf8(output.stdout) {
                Ok(result) => result,
                Err(e) => format!("Error decoding output: {}", e), // 返回解码错误信息
            }
        }
        Err(e) => {
            println!("Failed to execute process: {}", e);
            return format!("Error: {}", e); // 返回错误信息
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
fn run_command(program: String, args: Vec<String>) -> String {
    // CREATE_NO_WINDOW: 不创建控制台窗口
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    // DETACHED_PROCESS: 使进程在后台运行
    // const DETACHED_PROCESS: u32 = 0x00000008;

    // 尝试执行命令并捕获错误
    match Command::new(&program)
        .args(args)
        .stdout(std::process::Stdio::null()) // 将标准输出重定向到null
        .stderr(std::process::Stdio::null()) // 将标准错误重定向到null
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
    {
        Ok(child) => {
            let pid = child.id(); // 获取进程ID
            return pid.to_string(); // 返回进程ID
        }
        Err(e) => {
            println!("Failed to execute process: {}", e);
            return format!("Error: {}", e); // 返回错误信息
        }
    };
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

// 获取日志目录（程序安装目录下的 logs）
fn get_log_directory() -> String {
    format!("{}/logs", get_exe_directory())
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
            get_exe_directory
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

    builder
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
