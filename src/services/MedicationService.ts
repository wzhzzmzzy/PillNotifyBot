import { DataSource, MedicationRecord } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * 服药相关业务逻辑服务
 */
export class MedicationService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * 解析服药确认消息
   * @param text 用户发送的文本消息
   * @returns 解析结果，包含阶段名称，如果不匹配则返回null
   */
  parseMedicationConfirmation(text: string): { stageName: string } | null {
    // 匹配 "XX吃了" 的模式，提取阶段名称
    const match = text.match(/^(.+?)吃了$/);
    if (match) {
      const stageName = match[1].trim();
      if (stageName.length > 0) {
        return { stageName };
      }
    }

    return null;
  }

  /**
   * 确认用户服药
   * @param openId 用户的 open_id
   * @param stageId 服药阶段 ID
   * @param stageName 阶段名称
   * @returns 处理结果
   */
  async confirmMedication(openId: string, stageId: number, stageName: string): Promise<{
    success: boolean;
    message: string;
    isDuplicate?: boolean;
  }> {
    try {
      // 检查今天是否已经记录过这个阶段
      const isCompleted = this.dataSource.isStageCompletedToday(openId, stageId);

      if (isCompleted) {
        return {
          success: false,
          message: `您今天已经记录过${stageName}的服药了！`,
          isDuplicate: true
        };
      }

      // 记录服药
      this.dataSource.recordMedication(openId, stageId);

      logger.info(`用户 ${openId} 确认了${stageName}的服药`);

      return {
        success: true,
        message: `✅ 已记录您${stageName}的服药情况`
      };

    } catch (error) {
      logger.error(`记录用户 ${openId} 服药失败: ${error}`);
      return {
        success: false,
        message: "记录服药失败，请稍后重试"
      };
    }
  }

  /**
   * 检查用户今天的服药完成情况
   * @param openId 用户的 open_id
   * @returns 今天已完成的阶段列表
   */
  getTodayCompletedStages(openId: string): number[] {
    return this.dataSource.getTodayCompletedStages(openId);
  }

  /**
   * 获取用户今天的服药记录
   * @param openId 用户的 open_id
   * @returns 今天的服药记录
   */
  getTodayMedicationRecords(openId: string) {
    return this.dataSource.getTodayMedicationRecords(openId);
  }

  /**
   * 获取用户指定日期的服药记录
   * @param openId 用户的 open_id
   * @param date 日期字符串，格式: YYYY-MM-DD
   * @returns 指定日期的服药记录
   */
  getMedicationRecordsByDate(openId: string, date: string): MedicationRecord[] {
    return this.dataSource.getMedicationRecordsByDate(openId, date);
  }

  /**
   * 格式化服药记录为显示文本
   * @param openId 用户的 open_id
   * @param date 日期字符串，格式: YYYY-MM-DD
   * @param dateDisplayName 日期显示名称（如"今天"、"昨天"、"2025-10-30"）
   * @returns 格式化的记录文本
   */
  formatMedicationRecords(openId: string, date: string, dateDisplayName: string): string {
    // 获取用户的当前活跃计划
    const currentPlan = this.dataSource.getActiveMedicationPlan(openId);
    if (!currentPlan || currentPlan.length === 0) {
      return `❌ 您还没有配置任何服药计划，无法查看历史记录`;
    }

    // 获取指定日期的服药记录
    const records = this.getMedicationRecordsByDate(openId, date);

    if (records.length === 0) {
      return `${dateDisplayName}\n暂无服药记录`;
    }

    // 构建记录映射
    const recordMap = new Map<number, boolean>();
    records.forEach(record => {
      recordMap.set(record.stage, true);
    });

    // 按照用户配置的阶段顺序构建输出
    const lines = [`${dateDisplayName}`];
    currentPlan.forEach(stage => {
      const isCompleted = recordMap.has(stage.id);
      const status = isCompleted ? "已服药" : "未服药";
      lines.push(`- ${stage.name}：${status}`);
    });

    return lines.join('\n');
  }
}