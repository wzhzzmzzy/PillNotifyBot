import { DataSource } from '../db/index.js';
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
   * @returns 解析结果，包含阶段ID和名称，如果不匹配则返回null
   */
  parseMedicationConfirmation(text: string): { stageId: number; stageName: string } | null {
    const timePatterns = [
      { pattern: /早上吃了/, stageName: "早上", stageId: 1 },
      { pattern: /中午吃了/, stageName: "中午", stageId: 2 },
      { pattern: /晚上吃了/, stageName: "晚上", stageId: 3 },
      { pattern: /睡前吃了/, stageName: "睡前", stageId: 4 },
    ];

    for (const { pattern, stageName, stageId } of timePatterns) {
      if (pattern.test(text)) {
        return { stageId, stageName };
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
}