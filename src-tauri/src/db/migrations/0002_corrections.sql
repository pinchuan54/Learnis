-- 手动修正：在计时器上拖动调整的学习时长（#36）
-- 不改学习记录；每个计划每天一笔净值（秒，可正可负），统计学习时长时与学习记录相加。
CREATE TABLE corrections (
    plan_id    INTEGER NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    date       TEXT    NOT NULL,
    seconds    INTEGER NOT NULL CHECK (seconds != 0),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (plan_id, date)
) STRICT, WITHOUT ROWID;

CREATE INDEX corrections_date ON corrections (date);
