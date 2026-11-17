use std::net::TcpStream;
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

static BACKEND_CHILD: Mutex<Option<std::process::Child>> = Mutex::new(None);

#[tauri::command]
fn get_system_status() -> String {
    "LocalAI Desktop Native Core (Rust) active".into()
}

#[allow(dead_code)]
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

#[allow(dead_code)]
fn ensure_backend_running() {
    // Check if backend port 3001 is already listening
    if TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        Duration::from_millis(300),
    ).is_ok() {
        return;
    }

    let root_opt = find_project_root();
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));

    // 1. Check if bundled node.exe and server.cjs exist in resources/ (All-in-One Mode)
    let bundled_backend = exe_dir.as_ref().and_then(|dir| {
        let node_path = dir.join("resources").join("node.exe");
        let server_path = dir.join("resources").join("server.cjs");
        if node_path.exists() && server_path.exists() {
            Some((node_path, server_path))
        } else {
            let node_path2 = dir.join("node.exe");
            let server_path2 = dir.join("server.cjs");
            if node_path2.exists() && server_path2.exists() {
                Some((node_path2, server_path2))
            } else {
                None
            }
        }
    });

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if let Some((node_bin, server_script)) = bundled_backend {
            let mut cmd = Command::new(&node_bin);
            cmd.arg(&server_script)
               .creation_flags(CREATE_NO_WINDOW);
            if let Some(ref dir) = exe_dir {
                cmd.current_dir(dir);
            }
            if let Ok(child) = cmd.spawn() {
                if let Ok(mut lock) = BACKEND_CHILD.lock() {
                    *lock = Some(child);
                }
            }
        } else {
            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "node dist/index.js > .data/backend.log 2>&1"])
               .creation_flags(CREATE_NO_WINDOW);
            
            if let Some(ref root) = root_opt {
                cmd.current_dir(root);
            }

            if let Ok(child) = cmd.spawn() {
                if let Ok(mut lock) = BACKEND_CHILD.lock() {
                    *lock = Some(child);
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("sh");
        cmd.args(&["-c", "node dist/index.js"]);
        if let Some(ref root) = root_opt {
            cmd.current_dir(root);
        }
        if let Ok(child) = cmd.spawn() {
            if let Ok(mut lock) = BACKEND_CHILD.lock() {
                *lock = Some(child);
            }
        }
    }

    // Wait up to 5 seconds for port 3001 to become ready
    for _ in 0..50 {
        if TcpStream::connect_timeout(
            &"127.0.0.1:3001".parse().unwrap(),
            Duration::from_millis(100),
        ).is_ok() {
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

fn kill_backend_child() {
    if let Ok(mut lock) = BACKEND_CHILD.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
            #[cfg(target_os = "windows")]
            {
                let pid = child.id();
                let _ = Command::new("taskkill")
                    .args(&["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // In dev mode (debug_assertions), the backend is already managed by concurrently/tsx.
    // In release mode, auto-spawn backend if not already listening.
    #[cfg(not(debug_assertions))]
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    kill_backend_child();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running LocalAI Studio desktop application");
}
