mod clipboard;
mod delete_app;

use clipboard::{copy_slack_message, read_slack_clipboard};
use delete_app::delete_slackbuilder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            copy_slack_message,
            delete_slackbuilder,
            read_slack_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
