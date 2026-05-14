// FetchLab Tauri runtime entry point. The webview loads the Vite frontend
// from the bundled `dist/` directory in production. No custom commands are
// exposed — the frontend talks to remote APIs directly via the standard
// fetch() API, which works in Tauri without going through a backend proxy.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // dev-only setup hook
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FetchLab");
}
