import { Database } from "bun:sqlite";
import { MEDICATION_PLAN_TABLE, MEDICATION_RECORDS_TABLE } from "./tables.js";
import { logger } from "../utils/logger.js";

// 服药配置的接口定义
export interface MedicationStageConfig {
  id: number;
  name: string; // 子配置名（字符串）
  time: string; // 每天的通知时间（HH:mm）
  interval: number; // 重复通知间隔（分钟数，为0则不重复通知）
}

export type MedicationPlan = MedicationStageConfig[];

// 数据库中的服药计划记录
export interface MedicationPlanRecord {
  id: number;
  created_at: string;
  stage_config: string; // JSON 字符串
  owner: string;
  is_active: number;
}

// 数据库中的服药记录
export interface MedicationRecord {
  id: number;
  create_at: string; // 日期格式 (如 '2023-12-01')
  stage: number; // 服药阶段 ID
  owner: string; // 归属人 open_id
  medication_time: string; // 服药时间 (时间戳，Unix Epoch)
}

export class DataSource {
  db: Database;

  constructor(dbPath = "pill.sqlite") {
    this.db = new Database(dbPath, { create: true });
    this.db.run("PRAGMA journal_mode = WAL;");

    this.db.run(MEDICATION_PLAN_TABLE);
    this.db.run(MEDICATION_RECORDS_TABLE);
  }

  term() {
    this.db.close();
  }

  /**
   * 查询某一用户生效中的服药计划配置
   * @param owner 用户的 open_id
   * @returns 返回用户当前生效的服药计划配置，如果没有则返回 null
   */
  getActiveMedicationPlan(owner: string): MedicationPlan | null {
    const stmt = this.db.prepare(`
      SELECT stage_config
      FROM medication_stage_config
      WHERE owner = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const result = stmt.get(owner) as { stage_config: string } | undefined;

    if (!result) {
      return null;
    }

    try {
      const config = JSON.parse(result.stage_config) as MedicationPlan;
      return config;
    } catch (error) {
      logger.error(error);
      return null;
    }
  }

  allActiveMedicationPlan(): Array<{ owner: string; plan: MedicationPlan }> {
    const stmt = this.db.prepare(`
      SELECT stage_config, owner
      FROM medication_stage_config
      WHERE is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const result = stmt.all() as { owner: string; stage_config: string }[];

    return result.map((i) => {
      return {
        owner: i.owner,
        plan: JSON.parse(i.stage_config),
      };
    });
  }

  /**
   * 查询某一用户今天的服药记录
   * @param owner 用户的 open_id
   * @returns 返回用户今天的所有服药记录
   */
  getTodayMedicationRecords(owner: string): MedicationRecord[] {
    const today = new Date().toISOString().split("T")[0]; // 格式: YYYY-MM-DD
    return this.getMedicationRecordsByDate(owner, today);
  }

  /**
   * 获取用户今天已完成的服药阶段
   * @param owner 用户的 open_id
   * @returns 返回今天已完成的服药阶段计划数组
   */
  getTodayCompletedStages(owner: string) {
    const records = this.getTodayMedicationRecords(owner);
    const plans = this.getActiveMedicationPlan(owner) ?? [];

    return records.map((record) => plans.find((i) => i.id === record.stage));
  }

  /**
   * 检查某个阶段今天是否已完成
   * @param owner 用户的 open_id
   * @param stageId 服药阶段 ID
   * @returns 如果今天已完成该阶段返回 true，否则返回 false
   */
  isStageCompletedToday(owner: string, stageId: number): boolean {
    const completedStages = this.getTodayCompletedStages(owner);
    return completedStages.some((i) => i?.id === stageId);
  }

  /**
   * 创建或更新用户的服药计划配置
   * @param owner 用户的 open_id
   * @param medicationPlan 服药计划配置
   * @returns 创建的配置记录 ID
   */
  createOrUpdateMedicationPlan(
    owner: string,
    medicationPlan: MedicationPlan,
  ): number {
    // 先将之前的配置设置为非活跃状态
    const deactivateStmt = this.db.prepare(`
      UPDATE medication_stage_config
      SET is_active = 0
      WHERE owner = ? AND is_active = 1
    `);
    deactivateStmt.run(owner);

    // 创建新的活跃配置
    const insertStmt = this.db.prepare(`
      INSERT INTO medication_stage_config (stage_config, owner, is_active)
      VALUES (?, ?, 1)
    `);

    const result = insertStmt.run(JSON.stringify(medicationPlan), owner);
    return result.lastInsertRowid as number;
  }

  /**
   * 记录用户服药
   * @param owner 用户的 open_id
   * @param stageId 服药阶段 ID
   * @returns 创建的记录 ID
   */
  recordMedication(owner: string, stageId: number): number {
    const today = new Date().toISOString().split("T")[0]; // 格式: YYYY-MM-DD

    console.log("db:", owner, stageId);
    const stmt = this.db.prepare(`
      INSERT INTO medication_records (create_at, stage, owner)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(today, stageId, owner);
    return result.lastInsertRowid as number;
  }

  /**
   * 创建一个"未服用"的记录（用于定时任务触发时）
   * @param owner 用户的 open_id
   * @param stageId 服药阶段 ID
   * @returns 创建的记录 ID
   */
  createPendingMedicationRecord(owner: string, stageId: number): number {
    const today = new Date().toISOString().split("T")[0]; // 格式: YYYY-MM-DD
    const pendingTime = new Date(0); // 使用 1970-01-01 表示未服用状态

    const stmt = this.db.prepare(`
      INSERT INTO medication_records (create_at, stage, owner, medication_time)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(today, stageId, owner, pendingTime.toISOString());
    return result.lastInsertRowid as number;
  }

  /**
   * 获取用户指定日期的服药记录
   * @param owner 用户的 open_id
   * @param date 日期字符串，格式: YYYY-MM-DD
   * @returns 返回用户指定日期的所有服药记录
   */
  getMedicationRecordsByDate(owner: string, date: string): MedicationRecord[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM medication_records
      WHERE owner = ? AND create_at = ?
      ORDER BY medication_time ASC
    `);

    return stmt.all(owner, date) as MedicationRecord[];
  }

  /**
   * 检查用户是否已存在配置
   * @param owner 用户的 open_id
   * @returns 如果用户已有配置返回 true，否则返回 false
   */
  hasUserConfiguration(owner: string): boolean {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM medication_stage_config
      WHERE owner = ?
    `);

    const result = stmt.get(owner) as { count: number };
    return result.count > 0;
  }
}
