//! 运行记录：启动、退出、出错（panic）、窗口被销毁时记一行，查偶发闪退用（#64）。
//!
//! 写在应用日志目录的 `learnis.log`，超过 256 KB 就把旧的改名成 `learnis.old.log` 重新记。
//! 被系统或别的程序直接结束时来不及记，那样的话最后一行就停在退出之前。

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

const LIMIT: u64 = 256 * 1024;
static FILE: OnceLock<PathBuf> = OnceLock::new();

/// 定下记录文件的位置，接管 panic：先记下来，再交给默认处理（发布版随后直接结束程序）
pub fn init(dir: PathBuf) {
    let _ = fs::create_dir_all(&dir);
    let _ = FILE.set(dir.join("learnis.log"));
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        write(&format!("出错：{info}"));
        default(info);
    }));
}

/// 记一行（带本地时间）；还没 `init` 或写不了就算了
pub fn write(message: &str) {
    let Some(path) = FILE.get() else {
        return;
    };
    if fs::metadata(path).is_ok_and(|meta| meta.len() > LIMIT) {
        let _ = fs::rename(path, path.with_extension("old.log"));
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let _ = writeln!(file, "{now} {message}");
    }
}
