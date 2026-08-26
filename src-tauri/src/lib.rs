use chrono::Local;
use serde::Serialize;
use serde_json::json;
use std::net::IpAddr;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_store::StoreExt;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessInfo {
    name: String,
    command_line: String,
    path: String,
    pid: u32,
    memory: u64,
    config_file_name: Option<String>,
    file_name: Option<String>,
}

fn command_output(program: &str, args: &[String]) -> std::io::Result<std::process::Output> {
    let mut command = Command::new(program);
    command.args(args);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    command.output()
}

fn command_spawn(program: &str, args: &[String]) -> std::io::Result<std::process::Child> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);
    command.spawn()
}

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
fn run_cli(app: AppHandle, program: String, args: Vec<String>) -> String {
    #[cfg(target_os = "macos")]
    let program = match (|| -> Result<String, String> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("failed to locate application data directory: {error}"))?;
        let expected = data_dir.join("resource/current/easytier-cli");
        let requested = Path::new(&program)
            .canonicalize()
            .map_err(|error| format!("failed to resolve CLI path: {error}"))?;
        let expected = expected
            .canonicalize()
            .map_err(|error| format!("failed to resolve managed CLI path: {error}"))?;
        if requested != expected {
            return Err("CLI path is outside the managed core directory".to_string());
        }
        Ok(expected.to_string_lossy().to_string())
    })() {
        Ok(program) => program,
        Err(error) => return format!("Error: {error}"),
    };
    #[cfg(not(target_os = "macos"))]
    let _ = app;

    match command_output(&program, &args) {
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
    match command_spawn(&program, &args) {
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

fn ensure_child_path(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("failed to resolve data directory: {error}"))?;
    let path = path
        .canonicalize()
        .map_err(|error| format!("failed to resolve path: {error}"))?;
    if !path.starts_with(&root) {
        return Err("path is outside the application data directory".to_string());
    }
    Ok(path)
}

fn normalize_sha256(value: &str) -> Result<String, String> {
    let digest = value
        .strip_prefix("sha256:")
        .unwrap_or(value)
        .to_ascii_lowercase();
    if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("release asset does not provide a valid SHA-256 digest".to_string());
    }
    Ok(digest)
}

fn validate_config_file_name(value: &str) -> Result<(), String> {
    if Path::new(value).file_name().and_then(|name| name.to_str()) != Some(value)
        || !value.ends_with(".toml")
    {
        return Err("invalid configuration file name".to_string());
    }
    Ok(())
}

#[tauri::command]
fn install_core_archive(
    app: AppHandle,
    archive_path: String,
    expected_sha256: String,
) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    use std::fs::{self, File};
    use std::io::{Read, Write};

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to locate application data directory: {error}"))?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("failed to create application data directory: {error}"))?;
    let archive = ensure_child_path(&data_dir, Path::new(&archive_path))?;

    let expected = normalize_sha256(&expected_sha256)?;

    let mut file = File::open(&archive)
        .map_err(|error| format!("failed to open downloaded archive: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("failed to read downloaded archive: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected {
        let _ = fs::remove_file(&archive);
        return Err(format!(
            "SHA-256 mismatch: expected {expected}, received {actual}"
        ));
    }

    let resource_dir = data_dir.join("resource");
    fs::create_dir_all(&resource_dir)
        .map_err(|error| format!("failed to create resource directory: {error}"))?;
    let staging = resource_dir.join(format!(".install-{}", std::process::id()));
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("failed to clear staging directory: {error}"))?;
    }
    fs::create_dir_all(&staging)
        .map_err(|error| format!("failed to create staging directory: {error}"))?;

    let install_result = (|| -> Result<String, String> {
        let archive_file = File::open(&archive)
            .map_err(|error| format!("failed to reopen downloaded archive: {error}"))?;
        let mut zip = zip::ZipArchive::new(archive_file)
            .map_err(|error| format!("invalid core archive: {error}"))?;
        let executable_names: &[&str] = if cfg!(target_os = "windows") {
            &["easytier-core.exe", "easytier-cli.exe"]
        } else {
            &["easytier-core", "easytier-cli"]
        };

        for executable_name in executable_names {
            let mut found = None;
            for index in 0..zip.len() {
                let entry = zip
                    .by_index(index)
                    .map_err(|error| format!("failed to inspect core archive: {error}"))?;
                let enclosed = entry
                    .enclosed_name()
                    .ok_or_else(|| "core archive contains an unsafe path".to_string())?;
                if enclosed.file_name().and_then(|name| name.to_str()) == Some(executable_name) {
                    found = Some(index);
                    break;
                }
            }
            let index =
                found.ok_or_else(|| format!("{executable_name} is missing from archive"))?;
            let mut entry = zip
                .by_index(index)
                .map_err(|error| format!("failed to read {executable_name}: {error}"))?;
            let destination = staging.join(executable_name);
            let mut output = File::create(&destination)
                .map_err(|error| format!("failed to create {executable_name}: {error}"))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|error| format!("failed to extract {executable_name}: {error}"))?;
            output
                .flush()
                .map_err(|error| format!("failed to flush {executable_name}: {error}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&destination, fs::Permissions::from_mode(0o755)).map_err(
                    |error| format!("failed to make {executable_name} executable: {error}"),
                )?;
            }
        }

        let cli_name = if cfg!(target_os = "windows") {
            "easytier-cli.exe"
        } else {
            "easytier-cli"
        };
        let version = Command::new(staging.join(cli_name))
            .arg("-V")
            .output()
            .map_err(|error| format!("failed to validate easytier-cli: {error}"))?;
        if !version.status.success() {
            return Err(format!(
                "easytier-cli validation failed: {}",
                String::from_utf8_lossy(&version.stderr).trim()
            ));
        }

        let current = resource_dir.join("current");
        let backup = resource_dir.join(".previous");
        if backup.exists() {
            fs::remove_dir_all(&backup)
                .map_err(|error| format!("failed to remove previous backup: {error}"))?;
        }
        if current.exists() {
            fs::rename(&current, &backup)
                .map_err(|error| format!("failed to preserve current core: {error}"))?;
        }
        if let Err(error) = fs::rename(&staging, &current) {
            if backup.exists() {
                let _ = fs::rename(&backup, &current);
            }
            return Err(format!("failed to activate installed core: {error}"));
        }
        if backup.exists() {
            let _ = fs::remove_dir_all(&backup);
        }
        Ok(String::from_utf8_lossy(&version.stdout).trim().to_string())
    })();

    if staging.exists() {
        let _ = fs::remove_dir_all(&staging);
    }
    if install_result.is_ok() {
        let _ = fs::remove_file(&archive);
    }
    install_result
}

#[cfg(target_os = "macos")]
fn run_osascript(lines: &[&str], args: &[String]) -> Result<String, String> {
    let mut command = Command::new("/usr/bin/osascript");
    for line in lines {
        command.arg("-e").arg(line);
    }
    command.arg("--").args(args);
    let output = command
        .output()
        .map_err(|error| format!("failed to open macOS authorization dialog: {error}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn start_core_macos(
    app: AppHandle,
    config_file_name: String,
    log_level: String,
    rpc_portal: Option<String>,
) -> Result<u32, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, config_file_name, log_level, rpc_portal);
        return Err("macOS elevated launch is unavailable on this platform".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        validate_config_file_name(&config_file_name)?;
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("failed to locate application data directory: {error}"))?;
        let core = ensure_child_path(&data_dir, &data_dir.join("resource/current/easytier-core"))?;
        let config = ensure_child_path(&data_dir, &data_dir.join("config").join(config_file_name))?;
        let logs = data_dir.join("logs");
        std::fs::create_dir_all(&logs)
            .map_err(|error| format!("failed to create log directory: {error}"))?;
        if !matches!(
            log_level.as_str(),
            "off" | "error" | "warn" | "info" | "debug" | "trace"
        ) {
            return Err("invalid log level".to_string());
        }
        let args = vec![
            core.to_string_lossy().to_string(),
            logs.to_string_lossy().to_string(),
            log_level,
            config.to_string_lossy().to_string(),
            rpc_portal.unwrap_or_default(),
        ];
        let output = run_osascript(
            &[
                "on run argv",
                "set corePath to quoted form of item 1 of argv",
                "set logPath to quoted form of item 2 of argv",
                "set logLevel to quoted form of item 3 of argv",
                "set configPath to quoted form of item 4 of argv",
                "set rpcPortal to item 5 of argv",
                "set commandLine to corePath & \" --file-log-dir \" & logPath & \" --file-log-level \" & logLevel & \" --file-log-size 10 --file-log-count 10 --config-file \" & configPath",
                "if rpcPortal is not \"\" then set commandLine to commandLine & \" --rpc-portal \" & quoted form of rpcPortal",
                "return do shell script commandLine & \" >/dev/null 2>&1 & echo $!\" with administrator privileges",
                "end run",
            ],
            &args,
        )?;
        output
            .trim()
            .parse::<u32>()
            .map_err(|_| format!("macOS did not return a valid core PID: {output}"))
    }
}

#[tauri::command]
fn stop_core_macos(pid: u32, force: bool) -> Result<(), String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (pid, force);
        return Err("macOS elevated stop is unavailable on this platform".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        if pid <= 1 {
            return Err("invalid process id".to_string());
        }
        let signal = if force { "-KILL" } else { "-TERM" };
        run_osascript(
            &[
                "on run argv",
                "set signalName to item 1 of argv",
                "set processId to item 2 of argv",
                "return do shell script \"/bin/kill \" & signalName & \" \" & processId with administrator privileges",
                "end run",
            ],
            &[signal.to_string(), pid.to_string()],
        )?;
        Ok(())
    }
}

fn build_terminal_command(action: &str, host: &str, port: Option<u16>) -> Result<String, String> {
    let host = host
        .parse::<IpAddr>()
        .map_err(|_| "invalid node IP address".to_string())?;
    match action {
        "ping" => Ok(format!("ping {host}")),
        "ssh" => Ok(format!("ssh root@{host}")),
        "telnet" => port
            .map(|port| format!("nc -v {host} {port}"))
            .ok_or_else(|| "port is required for telnet".to_string()),
        _ => Err("unsupported terminal action".to_string()),
    }
}

#[tauri::command]
fn open_terminal_macos(action: String, host: String, port: Option<u16>) -> Result<(), String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (action, host, port);
        return Err("macOS Terminal integration is unavailable on this platform".to_string());
    }
    #[cfg(target_os = "macos")]
    {
        let command = build_terminal_command(&action, &host, port)?;
        run_osascript(
            &[
                "on run argv",
                "set commandText to item 1 of argv",
                "tell application \"Terminal\"",
                "activate",
                "do script commandText",
                "end tell",
                "end run",
            ],
            &[command],
        )?;
        Ok(())
    }
}

#[tauri::command]
fn list_core_processes() -> Result<Vec<ProcessInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        return Err("native process enumeration is only used on Unix".to_string());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("/bin/ps")
            .args(["-axo", "pid=,rss=,comm=,args="])
            .output()
            .map_err(|error| format!("failed to enumerate processes: {error}"))?;
        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(parse_process_line)
            .collect())
    }
}

fn parse_process_line(line: &str) -> Option<ProcessInfo> {
    let line = line.trim_start();
    let (pid, remainder) = split_first_field(line)?;
    let (memory, process_text) = split_first_field(remainder.trim_start())?;
    let pid = pid.parse::<u32>().ok()?;
    let memory = memory.parse::<u64>().ok()?.saturating_mul(1024);
    let core_end = process_text.find("easytier-core")? + "easytier-core".len();
    let command_path = &process_text[..core_end];
    let command_line = process_text.to_string();
    let file_name = extract_toml_file_name(&command_line);
    let config_file_name = file_name
        .as_deref()
        .and_then(|name| name.strip_suffix(".toml"))
        .map(str::to_string);
    Some(ProcessInfo {
        name: Path::new(command_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("easytier-core")
            .to_string(),
        command_line,
        path: command_path.to_string(),
        pid,
        memory,
        config_file_name,
        file_name,
    })
}

fn split_first_field(value: &str) -> Option<(&str, &str)> {
    let index = value.find(char::is_whitespace)?;
    Some((&value[..index], &value[index..]))
}

fn extract_toml_file_name(command_line: &str) -> Option<String> {
    let marker = ["--config-file", "-c"]
        .into_iter()
        .find(|marker| command_line.contains(marker))?;
    let value = command_line.split_once(marker)?.1.trim_start();
    let value = value.strip_prefix('=').unwrap_or(value).trim_start();
    let end = value.to_ascii_lowercase().find(".toml")? + ".toml".len();
    Path::new(value[..end].trim_matches(['\'', '"']))
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
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
    let mut builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_command,
            run_cli,
            install_core_archive,
            start_core_macos,
            stop_core_macos,
            open_terminal_macos,
            list_core_processes,
            get_exe_directory,
            check_cold_start
        ])
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_window(app);
        }));

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
                    file_name: Some(env!("CARGO_PKG_NAME").to_string()),
                }),
                Target::new(TargetKind::Webview),
            ])
            .build(),
    );

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_sha256_digest() {
        let digest = "A".repeat(64);
        assert_eq!(
            normalize_sha256(&format!("sha256:{digest}")).unwrap(),
            "a".repeat(64)
        );
    }

    #[test]
    fn rejects_invalid_sha256_digest() {
        assert!(normalize_sha256("sha256:not-a-digest").is_err());
        assert!(normalize_sha256(&"g".repeat(64)).is_err());
    }

    #[test]
    fn validates_plain_toml_file_name() {
        assert!(validate_config_file_name("office.toml").is_ok());
        assert!(validate_config_file_name("../office.toml").is_err());
        assert!(validate_config_file_name("office.json").is_err());
    }

    #[test]
    fn parses_easytier_process_line() {
        let process = parse_process_line(
            "  123 2048 /Users/test/Lib /Users/test/Library/Application Support/easytier-manager-pro/resource/current/easytier-core --config-file /Users/test/Library/Application Support/easytier-manager-pro/config/office.toml",
        )
        .unwrap();
        assert_eq!(process.pid, 123);
        assert_eq!(process.memory, 2 * 1024 * 1024);
        assert_eq!(process.name, "easytier-core");
        assert!(process.path.ends_with("resource/current/easytier-core"));
        assert_eq!(process.config_file_name.as_deref(), Some("office"));
        assert_eq!(process.file_name.as_deref(), Some("office.toml"));
        assert!(process
            .command_line
            .contains("easytier-core --config-file /Users/test/Library/Application Support"));
        assert!(parse_process_line("1 512 /sbin/launchd /sbin/launchd").is_none());
    }

    #[test]
    fn validates_terminal_commands() {
        assert_eq!(
            build_terminal_command("ssh", "10.144.144.23", None).unwrap(),
            "ssh root@10.144.144.23"
        );
        assert_eq!(
            build_terminal_command("telnet", "10.144.144.23", Some(22)).unwrap(),
            "nc -v 10.144.144.23 22"
        );
        assert!(build_terminal_command("ping", "127.0.0.1; whoami", None).is_err());
        assert!(build_terminal_command("shell", "127.0.0.1", None).is_err());
    }
}
