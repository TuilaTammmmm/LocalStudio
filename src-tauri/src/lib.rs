use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;
use tauri::Manager;

#[tauri::command]
fn get_system_status() -> String {
    "LocalAI Desktop Native Core (Rust) active".into()
}

fn ensure_backend_running() {
    // Check if backend port 3001 is already listening
    if TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        Duration::from_millis(400),
    ).is_ok() {
        return;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let _ = Command::new("cmd")
            .args(&["/C", "node dist/index.js || npx tsx src/index.ts"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("sh")
            .args(&["-c", "node dist/index.js || npx tsx src/index.ts"])
            .spawn();
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
