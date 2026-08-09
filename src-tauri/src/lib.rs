mod proxy;

#[tauri::command]
fn write_file(dest: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&dest, &contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(proxy::StreamState::default())
        .invoke_handler(tauri::generate_handler![
            proxy::proxy,
            proxy::proxy_stream,
            proxy::abort_stream,
            proxy::proxy_bytes,
            write_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
