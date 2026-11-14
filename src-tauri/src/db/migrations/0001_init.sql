-- Learnis 初始表结构
-- 约定：时间戳为 UTC 毫秒（INTEGER），日期为所设时区下的 'YYYY-MM-DD'（TEXT），
--      计划时长以分钟计，学习时长由学习记录的起止时间计算。

-- 应用设置：以 JSON 保存，键为设置分组名
CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
) STRICT;

-- 学习计划：总时长 + 期限 + 学习日
CREATE TABLE plans (
    id             INTEGER PRIMARY KEY,
    name           TEXT    NOT NULL,
    goal           TEXT    NOT NULL DEFAULT '',
    color          TEXT    NOT NULL DEFAULT 'blue',
    total_minutes  INTEGER NOT NULL CHECK (total_minutes > 0),
    start_date     TEXT    NOT NULL,
    end_date       TEXT    NOT NULL,
    -- 学习日位掩码：bit0 = 周一 … bit6 = 周日
    study_weekdays INTEGER NOT NULL CHECK (study_weekdays BETWEEN 1 AND 127),
    archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    CHECK (end_date >= start_date)
) STRICT;

-- 每日基础分配（均分结果），实际目标 = 基础分配 - 调出 + 调入
CREATE TABLE plan_days (
    plan_id      INTEGER NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    date         TEXT    NOT NULL,
    base_minutes INTEGER NOT NULL CHECK (base_minutes >= 0),
    PRIMARY KEY (plan_id, date)
) STRICT, WITHOUT ROWID;

-- 时长调整：把某天的时长挪到其他日子
CREATE TABLE adjustments (
    id         INTEGER PRIMARY KEY,
    plan_id    INTEGER NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    from_date  TEXT    NOT NULL,
    mode       TEXT    NOT NULL CHECK (mode IN ('spread', 'split', 'next_day')),
    -- 是否由「未达标默认处理方式」自动生成
    auto       INTEGER NOT NULL DEFAULT 0 CHECK (auto IN (0, 1)),
    created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX adjustments_plan_from ON adjustments (plan_id, from_date);

CREATE TABLE adjustment_items (
    adjustment_id INTEGER NOT NULL REFERENCES adjustments (id) ON DELETE CASCADE,
    to_date       TEXT    NOT NULL,
    minutes       INTEGER NOT NULL CHECK (minutes > 0),
    PRIMARY KEY (adjustment_id, to_date)
) STRICT, WITHOUT ROWID;

CREATE INDEX adjustment_items_to ON adjustment_items (to_date);

-- 学习记录：计时器产生或手动补录；end_at 为空表示正在计时
CREATE TABLE sessions (
    id         INTEGER PRIMARY KEY,
    plan_id    INTEGER NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    start_at   INTEGER NOT NULL,
    end_at     INTEGER,
    source     TEXT    NOT NULL CHECK (source IN ('timer', 'manual')),
    note       TEXT    NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (end_at IS NULL OR end_at > start_at),
    CHECK (source = 'timer' OR end_at IS NOT NULL)
) STRICT;

CREATE INDEX sessions_start ON sessions (start_at);
CREATE INDEX sessions_plan_start ON sessions (plan_id, start_at);
-- 同一时间最多只有一个正在进行的计时
CREATE UNIQUE INDEX sessions_one_running ON sessions ((end_at IS NULL)) WHERE end_at IS NULL;

-- 当天待办
CREATE TABLE todos (
    id         INTEGER PRIMARY KEY,
    date       TEXT    NOT NULL,
    plan_id    INTEGER REFERENCES plans (id) ON DELETE SET NULL,
    title      TEXT    NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX todos_date ON todos (date, sort_order);
