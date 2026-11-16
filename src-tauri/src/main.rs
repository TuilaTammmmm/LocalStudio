// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn get_system_status() -> String {
    "LocalAI Desktop Native Core (Rust) active".into()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![get_system_status])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                println!("LocalAI Studio window initialized successfully in debug mode.");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LocalAI Studio desktop application");
}
