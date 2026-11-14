//! SQLite 连接与表结构迁移。

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};

/// 按顺序排列的迁移脚本；第 n 个脚本执行后 `user_version` 为 n。
/// 只能在末尾追加，已发布的脚本不可修改。
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

/// 应用唯一的数据库连接。命令之间通过互斥锁串行访问。
pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> AppResult<Self> {
        let mut conn = Connection::open(path)?;
        configure(&conn)?;
        migrate(&mut conn)?;
        Ok(Self(Mutex::new(conn)))
    }

    #[cfg(test)]
    pub fn open_in_memory() -> AppResult<Self> {
        Ok(Self(Mutex::new(open_test_connection())))
    }

    /// 取得连接执行操作（同一时间只有一个操作持有连接）
    pub fn with<T>(&self, f: impl FnOnce(&mut Connection) -> AppResult<T>) -> AppResult<T> {
        let mut conn = self
            .0
            .lock()
            .map_err(|_| AppError::Internal("数据库连接锁已损坏".into()))?;
        f(&mut conn)
    }
}

fn configure(conn: &Connection) -> AppResult<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    Ok(())
}

/// 测试用：已完成配置和迁移的内存数据库
#[cfg(test)]
pub fn open_test_connection() -> Connection {
    let mut conn = Connection::open_in_memory().expect("打开内存数据库失败");
    configure(&conn).expect("配置数据库失败");
    migrate(&mut conn).expect("迁移失败");
    conn
}

/// 依次执行尚未执行的迁移脚本，每个脚本一个事务
pub fn migrate(conn: &mut Connection) -> AppResult<()> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let latest = MIGRATIONS.len() as i64;
    if current > latest {
        return Err(AppError::Internal(format!(
            "数据库版本（{current}）比当前程序支持的版本（{latest}）新，请升级 Learnis"
        )));
    }
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    /// 迁移后版本号等于脚本数量，且可以重复执行
    fn migrations_are_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();
        migrate(&mut conn).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    /// 同一时间只能有一个正在进行的计时
    fn only_one_running_session_allowed() {
        let db = Db::open_in_memory().unwrap();
        db.with(|conn| {
            conn.execute(
                "INSERT INTO plans (name, total_minutes, start_date, end_date, study_weekdays, created_at, updated_at)
                 VALUES ('AE', 600, '2026-01-01', '2026-01-31', 127, 0, 0)",
                [],
            )?;
            conn.execute(
                "INSERT INTO sessions (plan_id, start_at, source, created_at, updated_at) VALUES (1, 1000, 'timer', 0, 0)",
                [],
            )?;
            let second = conn.execute(
                "INSERT INTO sessions (plan_id, start_at, source, created_at, updated_at) VALUES (1, 2000, 'timer', 0, 0)",
                [],
            );
            assert!(second.is_err());
            // 已结束的记录不受限制
            conn.execute(
                "INSERT INTO sessions (plan_id, start_at, end_at, source, created_at, updated_at) VALUES (1, 10, 20, 'manual', 0, 0)",
                [],
            )?;
            Ok(())
        })
        .unwrap();
    }
}
