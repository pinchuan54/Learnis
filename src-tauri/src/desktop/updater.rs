//! 检查更新与一键更新，做法参考 CC Switch：
//!
//! - 只在用户点击「检查更新」时联网，读取发布页上的 `latest.json`；
//! - 下载的安装包先用内置公钥校验签名（并核对签名里的版本号），通过后才安装；
//! - Windows 上安装器启动后当前进程会被插件直接结束，安装器装完再重新打开 Learnis，
//!   所以退出前的清理（托盘图标、单实例锁）放在 `on_before_exit` 里。
//!
//! 正在进行的计时只记了开始时间，重启后会继续，不会丢。

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::{Error as UpdaterError, Update, UpdaterExt};

use super::{startup, tray};
use crate::error::{AppError, AppResult};

/// 下载进度事件，载荷为 [`DownloadProgress`]
pub const UPDATE_PROGRESS_EVENT: &str = "update-progress";

/// 可以更新到的新版本
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    /// 更新说明，发布时取自 CHANGELOG
    pub notes: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded: u64,
    /// 服务器没给出文件大小时为空
    total: Option<u64>,
}

/// 检查是否有新版本；已是最新时返回 `None`
pub async fn check<R: Runtime>(app: &AppHandle<R>) -> AppResult<Option<UpdateInfo>> {
    let update = find_update(app).await?;
    Ok(update.map(|update| UpdateInfo {
        version: update.version,
        current_version: update.current_version,
        notes: update.body.filter(|notes| !notes.trim().is_empty()),
    }))
}

/// 下载、校验并安装新版本，完成后重启到新版本。成功时不会返回。
pub async fn install<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let Some(update) = find_update(app).await? else {
        return Err(AppError::conflict("已经是最新版本"));
    };

    let progress_app = app.clone();
    let mut downloaded: u64 = 0;
    let bytes = update
        .download(
            move |chunk, total| {
                downloaded = downloaded.saturating_add(chunk as u64);
                let _ = progress_app.emit(
                    UPDATE_PROGRESS_EVENT,
                    DownloadProgress { downloaded, total },
                );
            },
            || {},
        )
        .await
        .map_err(|err| describe_error(Stage::Download, &err))?;

    // 装完会带着原来的启动参数重新打开；如果这次是开机自启的，静默启动会让窗口不出现，
    // 所以先留记号让更新后照常显示窗口（安装失败时记号留着也只是下次启动多显示一次窗口）
    startup::show_window_on_next_start(app);

    // Windows：这里会启动安装器并直接结束进程，不会返回
    update
        .install(bytes)
        .map_err(|err| describe_error(Stage::Install, &err))?;

    // macOS / Linux：安装完成后自己重启
    app.restart()
}

async fn find_update<R: Runtime>(app: &AppHandle<R>) -> AppResult<Option<Update>> {
    let exiting_app = app.clone();
    let updater = app
        .updater_builder()
        .on_before_exit(move || before_exit(&exiting_app))
        .build()
        .map_err(|err| describe_error(Stage::Check, &err))?;
    updater
        .check()
        .await
        .map_err(|err| describe_error(Stage::Check, &err))
}

/// Windows 安装前进程会被直接结束（不走正常退出），需要手动收尾：
/// 隐藏托盘图标，否则任务栏会残留一个点不动的图标；释放单实例锁，让安装器能顺利重新打开 Learnis。
fn before_exit<R: Runtime>(app: &AppHandle<R>) {
    tray::hide(app);
    tauri_plugin_single_instance::destroy(app);
}

#[derive(Clone, Copy)]
enum Stage {
    Check,
    Download,
    Install,
}

impl Stage {
    fn label(self) -> &'static str {
        match self {
            Self::Check => "检查更新",
            Self::Download => "下载更新",
            Self::Install => "安装更新",
        }
    }
}

/// 把插件的错误转成给用户看的中文提示
fn describe_error(stage: Stage, err: &UpdaterError) -> AppError {
    let message = match err {
        UpdaterError::Reqwest(_) | UpdaterError::Network(_) => {
            format!(
                "{}失败：无法连接到更新服务器，请检查网络后重试",
                stage.label()
            )
        }
        UpdaterError::ReleaseNotFound => {
            format!("{}失败：暂时获取不到版本信息，请稍后再试", stage.label())
        }
        UpdaterError::Minisign(_)
        | UpdaterError::Base64(_)
        | UpdaterError::SignatureUtf8(_)
        | UpdaterError::MissingSignedVersion
        | UpdaterError::SignedVersionMismatch { .. } => {
            "安装包签名校验未通过，已停止更新".to_string()
        }
        other => format!("{}失败：{other}", stage.label()),
    };
    AppError::Internal(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(stage: Stage, err: UpdaterError) -> String {
        match describe_error(stage, &err) {
            AppError::Internal(message) => message,
            other => panic!("unexpected error kind: {other:?}"),
        }
    }

    #[test]
    fn network_errors_ask_to_check_connection() {
        let text = message(Stage::Check, UpdaterError::Network("timeout".into()));
        assert_eq!(text, "检查更新失败：无法连接到更新服务器，请检查网络后重试");
    }

    #[test]
    fn missing_release_is_reported_plainly() {
        let text = message(Stage::Check, UpdaterError::ReleaseNotFound);
        assert_eq!(text, "检查更新失败：暂时获取不到版本信息，请稍后再试");
    }

    #[test]
    fn signature_problems_stop_the_update() {
        let text = message(Stage::Download, UpdaterError::MissingSignedVersion);
        assert_eq!(text, "安装包签名校验未通过，已停止更新");
    }

    #[test]
    fn other_errors_keep_the_stage_and_detail() {
        let text = message(Stage::Install, UpdaterError::InvalidUpdaterFormat);
        assert_eq!(text, "安装更新失败：invalid updater binary format");
    }
}
