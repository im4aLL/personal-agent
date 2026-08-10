mod duckduckgo_search;
mod google_search;
mod proxy;
mod search_window;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};

const HELP_GITHUB_REPO_ID: &str = "help-github-repo";
const HELP_REPORT_ISSUE_ID: &str = "help-report-issue";

#[tauri::command]
fn write_file(dest: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&dest, &contents).map_err(|error| error.to_string())
}

fn build_menu(app: &tauri::App) -> tauri::Result<Menu<tauri::Wry>> {
    let handle = app.handle();

    let about_metadata = AboutMetadata {
        version: Some(app.package_info().version.to_string()),
        authors: Some(vec!["Hadi".to_string()]),
        comments: Some(
            "A local-first AI chat desktop app with custom instructions, skills, and agents."
                .to_string(),
        ),
        copyright: Some("© 2026 Hadi. All rights reserved.".to_string()),
        website: Some("https://github.com/im4aLL/personal-agent".to_string()),
        website_label: Some("GitHub".to_string()),
        ..Default::default()
    };

    let app_submenu = Submenu::with_items(
        handle,
        "Personal Agent",
        true,
        &[
            &PredefinedMenuItem::about(handle, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    let file_submenu = Submenu::with_items(
        handle,
        "File",
        true,
        &[&PredefinedMenuItem::close_window(handle, None)?],
    )?;

    let edit_submenu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;

    let view_submenu = Submenu::with_items(
        handle,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(handle, None)?],
    )?;

    let window_submenu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    let help_submenu = Submenu::with_items(
        handle,
        "Help",
        true,
        &[
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::about(handle, None, Some(about_metadata))?,
            &MenuItem::with_id(handle, HELP_GITHUB_REPO_ID, "GitHub Repository", true, None::<&str>)?,
            &MenuItem::with_id(handle, HELP_REPORT_ISSUE_ID, "Report an Issue", true, None::<&str>)?,
        ],
    )?;

    Menu::with_items(
        handle,
        &[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
            &help_submenu,
        ],
    )
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
        .setup(|app| {
            let menu = build_menu(app)?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri_plugin_opener::OpenerExt;

            let url = match event.id().as_ref() {
                HELP_GITHUB_REPO_ID => Some("https://github.com/im4aLL/personal-agent"),
                HELP_REPORT_ISSUE_ID => Some("https://github.com/im4aLL/personal-agent/issues"),
                _ => None,
            };

            if let Some(url) = url {
                let _ = app.opener().open_url(url, None::<&str>);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
