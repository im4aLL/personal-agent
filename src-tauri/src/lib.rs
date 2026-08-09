mod duckduckgo_search;
mod google_search;
mod proxy;
mod search_window;

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
            google_search::google_search,
            google_search::collect_google_results,
            duckduckgo_search::duckduckgo_search,
            duckduckgo_search::collect_duckduckgo_results,
            write_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
