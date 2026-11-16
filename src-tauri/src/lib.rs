use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

#[tauri::command]
fn get_system_status() -> String {
    "LocalAI Desktop Native Core (Rust) active".into()
}

fn find_project_root() -> Option<std::path::PathBuf> {
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("dist").join("index.js").exists() || cwd.join("src").join("index.ts").exists() {
            return Some(cwd);
        }
    }
    if let Ok(exe_path) = std::env::current_exe() {
        let mut curr = exe_path.parent();
        while let Some(dir) = curr {
            if dir.join("dist").join("index.js").exists() || dir.join("src").join("index.ts").exists() {
                return Some(dir.to_path_buf());
            }
            curr = dir.parent();
        }
    }
    None
}

fn ensure_backend_running() {
    // Check if backend port 3001 is already listening
    if TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        Duration::from_millis(300),
    ).is_ok() {
        return;
    }

    let root_opt = find_project_root();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let mut cmd = Command::new("cmd");
        cmd.args(&["/C", "node dist/index.js || npx tsx src/index.ts"])
           .creation_flags(CREATE_NO_WINDOW);
        
        if let Some(ref root) = root_opt {
            cmd.current_dir(root);
        }

        let _ = cmd.spawn();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("sh");
        cmd.args(&["-c", "node dist/index.js || npx tsx src/index.ts"]);
        if let Some(ref root) = root_opt {
            cmd.current_dir(root);
        }
        let _ = cmd.spawn();
    }

    // Wait up to 3 seconds for port 3001 to become ready
    for _ in 0..30 {
        if TcpStream::connect_timeout(
            &"127.0.0.1:3001".parse().unwrap(),
            Duration::from_millis(100),
        ).is_ok() {
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_backend_running();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_system_status])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LocalAI Studio desktop application");
}
