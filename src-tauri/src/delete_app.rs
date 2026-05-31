use std::{env, fs, path::PathBuf, process::Command};

use tauri::{AppHandle, Manager};

const DELETE_CONFIRMATION: &str = "DELETE SLACKBUILDER";

#[tauri::command]
pub fn delete_slackbuilder(app: AppHandle, confirmation: String) -> Result<(), String> {
    if confirmation != DELETE_CONFIRMATION {
        return Err("Delete confirmation did not match.".to_string());
    }

    let app_path = installed_app_path().map_err(|err| err.to_string())?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Could not locate Slackbuilder app data: {err}"))?;

    schedule_delete(app_path, data_dir)?;
    app.exit(0);
    Ok(())
}

fn installed_app_path() -> std::io::Result<PathBuf> {
    let exe = env::current_exe()?;

    #[cfg(target_os = "macos")]
    {
        if let Some(bundle) = exe.ancestors().find(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
        }) {
            return Ok(bundle.to_path_buf());
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(install_dir) = exe.parent().filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.eq_ignore_ascii_case("slackbuilder"))
        }) {
            return Ok(install_dir.to_path_buf());
        }
    }

    Ok(exe)
}

fn schedule_delete(app_path: PathBuf, data_dir: PathBuf) -> Result<(), String> {
    let _ = fs::remove_dir_all(&data_dir);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                "$data=$args[0]; $target=$args[1]; Start-Sleep -Milliseconds 800; Remove-Item -LiteralPath $data -Recurse -Force -ErrorAction SilentlyContinue; if (Test-Path -LiteralPath $target -PathType Container) { $uninstaller=Join-Path $target 'uninstall.exe'; if (Test-Path -LiteralPath $uninstaller) { Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue }; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue } else { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue }",
            ])
            .arg(data_dir)
            .arg(app_path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|err| format!("Could not schedule Slackbuilder deletion: {err}"))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("sh")
            .arg("-c")
            .arg("sleep 1; rm -rf \"$1\" \"$2\"")
            .arg("delete-slackbuilder")
            .arg(data_dir)
            .arg(app_path)
            .spawn()
            .map_err(|err| format!("Could not schedule Slackbuilder deletion: {err}"))?;
    }

    Ok(())
}
