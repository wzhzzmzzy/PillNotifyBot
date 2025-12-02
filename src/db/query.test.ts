import { expect, test, beforeEach, afterEach } from "bun:test";
import { DataSource, type MedicationPlan } from "./index.js";
import { unlink } from "fs/promises";

let dataSource: DataSource;
const testDbPath = "test-pill.sqlite";

beforeEach(() => {
  // 使用测试数据库文件
  dataSource = new DataSource(testDbPath);

  // 重新创建表
  const {
    MEDICATION_PLAN_TABLE,
    MEDICATION_RECORDS_TABLE,
  } = require("./tables.js");
  dataSource.db.run(MEDICATION_PLAN_TABLE);
  dataSource.db.run(MEDICATION_RECORDS_TABLE);
});

afterEach(async () => {
  dataSource.term();
  try {
    await unlink(testDbPath);
    await unlink(testDbPath + "-wal");
    await unlink(testDbPath + "-shm");
  } catch {
    // 忽略文件不存在的错误
  }
});

test("创建数据库表", () => {
  // 测试表是否正确创建
  const tables = dataSource.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  const tableNames = tables.map((t: any) => t.name);

  expect(tableNames).toContain("medication_stage_config");
  expect(tableNames).toContain("medication_records");
});

test("getActiveMedicationPlan - 返回生效中的服药计划", () => {
  const testOwner = "test_user_123";
  const testPlan: MedicationPlan = [
    {
      id: 1,
      name: "早晨服药",
      time: "08:00",
      repeatInterval: 0,
    },
    {
      id: 2,
      name: "晚上服药",
      time: "20:00",
      repeatInterval: 30,
    },
  ];

  // 插入测试数据
  const insertStmt = dataSource.db.prepare(`
    INSERT INTO medication_stage_config (stage_config, owner, is_active)
    VALUES (?, ?, ?)
  `);

  // 插入一个非活跃的配置
  insertStmt.run(
    JSON.stringify([
      { id: 999, name: "旧配置", time: "12:00", repeatInterval: 0 },
    ]),
    testOwner,
    0,
  );

  // 插入活跃的配置
  insertStmt.run(JSON.stringify(testPlan), testOwner, 1);

  // 测试获取活跃配置
  const result = dataSource.getActiveMedicationPlan(testOwner);

  expect(result).not.toBeNull();
  expect(result).toEqual(testPlan);
});

test("getActiveMedicationPlan - 用户没有活跃配置时返回 null", () => {
  const testOwner = "test_user_no_plan";

  const result = dataSource.getActiveMedicationPlan(testOwner);

  expect(result).toBeNull();
});

test("getActiveMedicationPlan - JSON 解析失败时返回 null", () => {
  const testOwner = "test_user_bad_json";

  // 插入无效的 JSON 数据
  const insertStmt = dataSource.db.prepare(`
    INSERT INTO medication_stage_config (stage_config, owner, is_active)
    VALUES (?, ?, ?)
  `);
  insertStmt.run("invalid json", testOwner, 1);

  const result = dataSource.getActiveMedicationPlan(testOwner);

  expect(result).toBeNull();
});

test("getTodayMedicationRecords - 返回今天的服药记录", () => {
  const testOwner = "test_user_records";
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 插入测试数据
  const insertStmt = dataSource.db.prepare(`
    INSERT INTO medication_records (create_at, stage, owner, medication_time)
    VALUES (?, ?, ?, ?)
  `);

  // 今天的记录
  insertStmt.run(today, 1, testOwner, "2023-12-01 08:00:00");
  insertStmt.run(today, 2, testOwner, "2023-12-01 20:00:00");

  // 昨天的记录（不应该被返回）
  insertStmt.run(yesterday, 1, testOwner, "2023-11-30 08:00:00");

  // 测试获取今天的记录
  const result = dataSource.getTodayMedicationRecords(testOwner);

  expect(result).toHaveLength(2);
  expect(result[0].stage).toBe(1);
  expect(result[1].stage).toBe(2);
  expect(result[0].create_at).toBe(today);
  expect(result[1].create_at).toBe(today);
});

test("getTodayCompletedStages - 返回今天完成的服药阶段", () => {
  const testOwner = "test_user_stages";
  const today = new Date().toISOString().split("T")[0];

  // 插入测试数据
  const insertStmt = dataSource.db.prepare(`
    INSERT INTO medication_records (create_at, stage, owner, medication_time)
    VALUES (?, ?, ?, ?)
  `);

  insertStmt.run(today, 1, testOwner, "2023-12-01 08:00:00");
  insertStmt.run(today, 3, testOwner, "2023-12-01 20:00:00");

  // 测试获取完成的阶段
  const result = dataSource.getTodayCompletedStages(testOwner);

  expect(result).toEqual([1, 3]);
});

test("isStageCompletedToday - 检查阶段是否今天已完成", () => {
  const testOwner = "test_user_check";
  const today = new Date().toISOString().split("T")[0];

  // 插入测试数据
  const insertStmt = dataSource.db.prepare(`
    INSERT INTO medication_records (create_at, stage, owner, medication_time)
    VALUES (?, ?, ?, ?)
  `);

  insertStmt.run(today, 1, testOwner, "2023-12-01 08:00:00");

  // 测试已完成的阶段
  expect(dataSource.isStageCompletedToday(testOwner, 1)).toBe(true);

  // 测试未完成的阶段
  expect(dataSource.isStageCompletedToday(testOwner, 2)).toBe(false);
});

test("综合测试 - 配置与记录匹配", () => {
  const testOwner = "test_user_full";
  const today = new Date().toISOString().split("T")[0];

  const testPlan: MedicationPlan = [
    { id: 1, name: "早晨服药", time: "08:00", repeatInterval: 0 },
    { id: 2, name: "中午服药", time: "12:00", repeatInterval: 15 },
    { id: 3, name: "晚上服药", time: "20:00", repeatInterval: 0 },
  ];

  // 插入配置
  const insertPlanStmt = dataSource.db.prepare(`
    INSERT INTO medication_stage_config (stage_config, owner, is_active)
    VALUES (?, ?, ?)
  `);
  insertPlanStmt.run(JSON.stringify(testPlan), testOwner, 1);

  // 插入部分服药记录
  const insertRecordStmt = dataSource.db.prepare(`
    INSERT INTO medication_records (create_at, stage, owner, medication_time)
    VALUES (?, ?, ?, ?)
  `);
  insertRecordStmt.run(today, 1, testOwner, "2023-12-01 08:00:00"); // 早晨已完成
  insertRecordStmt.run(today, 2, testOwner, "2023-12-01 12:00:00"); // 中午已完成

  // 获取配置和记录
  const plan = dataSource.getActiveMedicationPlan(testOwner);
  const completedStages = dataSource.getTodayCompletedStages(testOwner);

  expect(plan).toEqual(testPlan);
  expect(completedStages).toEqual([1, 2]);

  // 检查各阶段完成情况
  expect(dataSource.isStageCompletedToday(testOwner, 1)).toBe(true); // 早晨已完成
  expect(dataSource.isStageCompletedToday(testOwner, 2)).toBe(true); // 中午已完成
  expect(dataSource.isStageCompletedToday(testOwner, 3)).toBe(false); // 晚上未完成

  // 可以进一步分析：晚上服药(id:3)还需要提醒
  const pendingStages = plan!.filter(
    (stage) => !completedStages.includes(stage.id),
  );
  expect(pendingStages).toHaveLength(1);
  expect(pendingStages[0].id).toBe(3);
  expect(pendingStages[0].name).toBe("晚上服药");
});
