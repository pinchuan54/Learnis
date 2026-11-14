//! 统一的错误类型，序列化后以 `{ code, message }` 形式返回给前端。

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("数据库错误：{0}")]
    Database(#[from] rusqlite::Error),

    #[error("{0}")]
    Invalid(String),

    #[error("找不到{0}")]
    NotFound(&'static str),

    #[error("{0}")]
    Conflict(String),

    #[error("内部错误：{0}")]
    Internal(String),
}

impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::Invalid(message.into())
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict(message.into())
    }

    /// 给前端判断错误类别用的稳定代码
    pub fn code(&self) -> &'static str {
        match self {
            Self::Database(_) => "database",
            Self::Invalid(_) => "invalid",
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::Internal(_) => "internal",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
