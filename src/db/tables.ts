export const MEDICATION_RECORDS_TABLE = `
  CREATE TABLE IF NOT EXISTS medication_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,      -- 主键
      create_at TEXT NOT NULL,                   -- 日期格式 (如 '2023-12-01')
      stage INTEGER NOT NULL,                    -- 服药阶段
      owner TEXT NOT NULL,                  -- 归属人 open_id
      medication_time DATETIME NOT NULL           -- 服药时间 (时间戳，Unix Epoch)
                        DEFAULT (datetime('now', 'localtime'))
  );
`;

export const MEDICATION_PLAN_TABLE = `
  CREATE TABLE IF NOT EXISTS medication_stage_config (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,       -- 主键，可选
      created_at      DATETIME NOT NULL                        -- create_at，时间戳格式，默认值当前时间
                          DEFAULT (datetime('now', 'localtime')),
      stage_config    TEXT    NOT NULL,                        -- 服药阶段配置，JSON 字符串存储
      owner           TEXT    NOT NULL,                        -- 归属人 open_id
      is_active       INTEGER NOT NULL DEFAULT 0               -- 是否使用中，布尔，0 = false，1 = true
  );
`;
