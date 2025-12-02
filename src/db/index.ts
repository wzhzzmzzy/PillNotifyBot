import { Database } from "bun:sqlite";
import { MEDICATION_PLAN_TABLE, MEDICATION_RECORDS_TABLE } from "./tables.js";

// 服药配置的接口定义
export interface MedicationStageConfig {
  id: number; // ID（必填，数字）
  name: string; // 子配置名（字符串）
  time: string; // 每天的通知时间（HH:mm）
  repeatInterval: number; // 重复通知间隔（分钟数，为0则不重复通知）
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
      console.error("Failed to parse stage_config JSON:", error);
      return null;
    }
  }

  /**
   * 查询某一用户今天的服药记录
   * @param owner 用户的 open_id
   * @returns 返回用户今天的所有服药记录
   */
  getTodayMedicationRecords(owner: string): MedicationRecord[] {
    const today = new Date().toISOString().split("T")[0]; // 格式: YYYY-MM-DD

    const stmt = this.db.prepare(`
      SELECT *
      FROM medication_records
      WHERE owner = ? AND create_at = ?
      ORDER BY medication_time ASC
    `);

    return stmt.all(owner, today) as MedicationRecord[];
  }

  /**
   * 获取用户今天已完成的服药阶段
   * @param owner 用户的 open_id
   * @returns 返回今天已完成的服药阶段 ID 数组
   */
  getTodayCompletedStages(owner: string): number[] {
    const records = this.getTodayMedicationRecords(owner);
    return records.map((record) => record.stage);
  }

  /**
   * 检查某个阶段今天是否已完成
   * @param owner 用户的 open_id
   * @param stageId 服药阶段 ID
   * @returns 如果今天已完成该阶段返回 true，否则返回 false
   */
  isStageCompletedToday(owner: string, stageId: number): boolean {
    const completedStages = this.getTodayCompletedStages(owner);
    return completedStages.includes(stageId);
  }
}
