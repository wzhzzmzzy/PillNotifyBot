import { DataSource, MedicationPlan } from '../db/index.js';
import { updateUserSchedule } from '../feishu/scheduler.js';
import { logger } from '../utils/logger.js';

/**
 * 计划相关业务逻辑服务
 */
export class PlanService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * 处理新用户初始化
   * @param openId 用户的 open_id
   * @param name 用户名
   */
  async handleNewUser(openId: string, name: string): Promise<void> {
    try {
      // 检查用户是否已有配置
      const hasConfig = this.dataSource.hasUserConfiguration(openId);

      if (!hasConfig) {
        // 为新用户创建默认的空配置
        this.dataSource.createOrUpdateMedicationPlan(openId, []);
        logger.info(`为新用户 ${name} (${openId}) 创建了默认配置`);
      }
    } catch (error) {
      logger.error(`处理新用户 ${openId} 失败: ${error}`);
      throw error;
    }
  }

  /**
   * 处理计划更新
   * @param openId 用户的 open_id
   * @param planData 新的计划数据
   * @param feishuClient 飞书客户端实例
   * @returns 处理结果
   */
  async updatePlan(openId: string, planData: any, feishuClient: any): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      logger.info(`用户 ${openId} 更新计划配置`, planData);

      // 示例：解析计划数据并更新数据库
      // 实际实现需要根据卡片模板的具体返回格式调整
      if (planData && Array.isArray(planData)) {
        // 更新数据库中的计划配置
        this.dataSource.createOrUpdateMedicationPlan(openId, planData);

        // 更新定时任务
        updateUserSchedule(openId, this.dataSource, feishuClient);

        logger.info(`用户 ${openId} 的计划配置和定时任务已更新`);

        return {
          success: true,
          message: "✅ 您的服药计划已更新，定时提醒已生效！"
        };
      } else {
        return {
          success: false,
          message: "计划数据格式不正确，请重新配置"
        };
      }

    } catch (error) {
      logger.error(`更新用户 ${openId} 计划失败: ${error}`);
      return {
        success: false,
        message: "计划更新失败，请稍后重试"
      };
    }
  }

  /**
   * 获取用户当前的活跃计划
   * @param openId 用户的 open_id
   * @returns 用户的活跃计划配置
   */
  getActivePlan(openId: string): MedicationPlan | null {
    return this.dataSource.getActiveMedicationPlan(openId);
  }

  /**
   * 检查用户是否有配置
   * @param openId 用户的 open_id
   * @returns 是否有配置
   */
  hasUserConfiguration(openId: string): boolean {
    return this.dataSource.hasUserConfiguration(openId);
  }

  /**
   * 生成计划配置的模板数据
   * @param openId 用户的 open_id
   * @returns 用于卡片模板的数据
   */
  generateTemplateData(openId: string): Record<string, any> {
    const currentPlan = this.getActivePlan(openId);

    // 这里可以根据当前计划生成更丰富的模板数据
    // 目前使用简单的示例数据
    return {
      "Input": currentPlan && currentPlan.length > 0
        ? `当前有 ${currentPlan.length} 个服药提醒`
        : "Hello?"
    };
  }
}