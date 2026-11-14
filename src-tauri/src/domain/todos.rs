//! 当天待办。

use rusqlite::{Connection, OptionalExtension, Row, params};

use super::Ctx;
use super::model::{Todo, TodoInput, TodoPatch};
use super::plans;
use crate::error::{AppError, AppResult};
use crate::time::{format_date, parse_date};

const MAX_TITLE_CHARS: usize = 100;

const SELECT_TODO: &str = "SELECT id, date, plan_id, title, done, sort_order FROM todos";

fn map_todo(row: &Row) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        date: row.get(1)?,
        plan_id: row.get(2)?,
        title: row.get(3)?,
        done: row.get(4)?,
        sort_order: row.get(5)?,
    })
}

fn validate_title(title: &str) -> AppResult<String> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::invalid("请填写待办内容"));
    }
    if title.chars().count() > MAX_TITLE_CHARS {
        return Err(AppError::invalid(format!(
            "待办内容不能超过 {MAX_TITLE_CHARS} 个字"
        )));
    }
    Ok(title.to_string())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Todo> {
    conn.query_row(&format!("{SELECT_TODO} WHERE id = ?1"), [id], map_todo)
        .optional()?
        .ok_or(AppError::NotFound("该待办"))
}

pub fn list(conn: &Connection, date: &str) -> AppResult<Vec<Todo>> {
    let date = format_date(parse_date(date)?);
    let mut stmt = conn.prepare(&format!(
        "{SELECT_TODO} WHERE date = ?1 ORDER BY sort_order, id"
    ))?;
    let todos = stmt
        .query_map([date], map_todo)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(todos)
}

pub fn create(conn: &Connection, ctx: &Ctx, input: &TodoInput) -> AppResult<Todo> {
    let date = format_date(parse_date(&input.date)?);
    let title = validate_title(&input.title)?;
    if let Some(plan_id) = input.plan_id {
        plans::get(conn, plan_id)?;
    }
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM todos WHERE date = ?1",
        [&date],
        |row| row.get(0),
    )?;
    conn.execute(
        "INSERT INTO todos (date, plan_id, title, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![date, input.plan_id, title, next_order, ctx.now_ms],
    )?;
    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, ctx: &Ctx, id: i64, patch: &TodoPatch) -> AppResult<Todo> {
    let mut todo = get(conn, id)?;
    if let Some(title) = &patch.title {
        todo.title = validate_title(title)?;
    }
    if let Some(done) = patch.done {
        todo.done = done;
    }
    if let Some(plan_id) = patch.plan_id {
        if let Some(plan_id) = plan_id {
            plans::get(conn, plan_id)?;
        }
        todo.plan_id = plan_id;
    }
    conn.execute(
        "UPDATE todos SET title = ?1, done = ?2, plan_id = ?3, updated_at = ?4 WHERE id = ?5",
        params![todo.title, todo.done, todo.plan_id, ctx.now_ms, id],
    )?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let changed = conn.execute("DELETE FROM todos WHERE id = ?1", [id])?;
    if changed == 0 {
        return Err(AppError::NotFound("该待办"));
    }
    Ok(())
}

/// 按给定顺序重排某天的待办
pub fn reorder(conn: &mut Connection, ctx: &Ctx, date: &str, ids: &[i64]) -> AppResult<Vec<Todo>> {
    let date = format_date(parse_date(date)?);
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "UPDATE todos SET sort_order = ?1, updated_at = ?2 WHERE id = ?3 AND date = ?4",
        )?;
        for (order, id) in ids.iter().enumerate() {
            stmt.execute(params![order as i64, ctx.now_ms, id, date])?;
        }
    }
    tx.commit()?;
    list(conn, &date)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::testing::{conn, ctx_at};

    fn input(title: &str) -> TodoInput {
        TodoInput {
            date: "2026-11-14".into(),
            plan_id: None,
            title: title.into(),
        }
    }

    #[test]
    fn create_update_reorder_delete() {
        let mut conn = conn();
        let ctx = ctx_at("2026-11-14", 9);
        let first = create(&conn, &ctx, &input("看完表达式教程第 3 章")).unwrap();
        let second = create(&conn, &ctx, &input("做一个文字动画练习")).unwrap();
        assert_eq!((first.sort_order, second.sort_order), (0, 1));
        assert!(create(&conn, &ctx, &input("  ")).is_err());

        let done = update(
            &conn,
            &ctx,
            first.id,
            &TodoPatch {
                title: None,
                done: Some(true),
                plan_id: None,
            },
        )
        .unwrap();
        assert!(done.done);

        let reordered = reorder(&mut conn, &ctx, "2026-11-14", &[second.id, first.id]).unwrap();
        assert_eq!(reordered[0].id, second.id);

        delete(&conn, first.id).unwrap();
        assert_eq!(list(&conn, "2026-11-14").unwrap().len(), 1);
    }
}
