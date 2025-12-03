import { DataSource, MedicationPlan } from '../db/index.js';
import { updateUserSchedule, getSchedulerInstance } from '../feishu/scheduler.js';
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
   * 清空用户配置
   * @param openId 用户的 open_id
   * @returns 处理结果
   */
  async clearUserConfiguration(openId: string): Promise<{
    message: string;
    success: boolean;
  }> {
    try {
      logger.info(`用户 ${openId} 请求清空配置`);

      // 将现有配置设置为不活跃
      this.dataSource.createOrUpdateMedicationPlan(openId, []);

      // 清空定时任务
      const scheduler = getSchedulerInstance();
      scheduler.clearUserSchedules(openId);

      logger.info(`用户 ${openId} 的配置已清空`);

      return {
        success: true,
        message: "✅ 配置已清空，所有定时提醒已停止"
      };

    } catch (error) {
      logger.error(`清空用户 ${openId} 配置失败: ${error}`);
      return {
        success: false,
        message: "❌ 清空配置失败，请稍后重试"
      };
    }
  }

  /**
   * 添加服药阶段
   * @param openId 用户的 open_id
   * @param stageName 阶段名称
   * @param hour 提醒小时（24小时制）
   * @param minute 提醒分钟（0-59）
   * @param feishuClient 飞书客户端实例
   * @returns 处理结果
   */
  async addStage(openId: string, stageName: string, hour: number, minute: number, feishuClient?: any): Promise<{
    message: string;
    success: boolean;
  }> {
    try {
      logger.info(`用户 ${openId} 请求添加阶段: ${stageName}，时间: ${hour}:${minute.toString().padStart(2, '0')}`);

      // 验证输入参数
      if (!stageName || stageName.length === 0) {
        return {
          success: false,
          message: "❌ 阶段名称不能为空"
        };
      }

      if (hour < 0 || hour > 23) {
        return {
          success: false,
          message: "❌ 提醒小时必须在0-23之间"
        };
      }

      if (minute < 0 || minute > 59) {
        return {
          success: false,
          message: "❌ 提醒分钟必须在0-59之间"
        };
      }

      // 获取当前活跃配置
      const currentPlan = this.getActivePlan(openId) || [];

      // 检查阶段名称是否已存在
      const existingStage = currentPlan.find(stage => stage.name === stageName);
      if (existingStage) {
        return {
          success: false,
          message: `❌ 阶段"${stageName}"已存在，请使用不同的名称`
        };
      }

      // 生成新的阶段ID（使用当前最大ID+1）
      const maxId = currentPlan.length > 0 ? Math.max(...currentPlan.map(s => s.id)) : 0;
      const newStageId = maxId + 1;

      // 创建新阶段
      const newStage = {
        id: newStageId,
        name: stageName,
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        repeatInterval: 60 // 默认1小时重复间隔
      };

      // 添加到计划中
      const updatedPlan = [...currentPlan, newStage];

      // 更新数据库
      this.dataSource.createOrUpdateMedicationPlan(openId, updatedPlan);

      // 更新定时任务
      if (feishuClient) {
        updateUserSchedule(openId, this.dataSource, feishuClient);
      }

      logger.info(`用户 ${openId} 成功添加阶段: ${stageName}`);

      return {
        success: true,
        message: `✅ 已添加阶段"${stageName}"，提醒时间为每天${hour}:${minute.toString().padStart(2, '0')}`
      };

    } catch (error) {
      logger.error(`用户 ${openId} 添加阶段失败: ${error}`);
      return {
        success: false,
        message: "❌ 添加阶段失败，请稍后重试"
      };
    }
  }

  /**
   * 删除服药阶段
   * @param openId 用户的 open_id
   * @param stageName 要删除的阶段名称
   * @param feishuClient 飞书客户端实例
   * @returns 处理结果
   */
  async deleteStage(openId: string, stageName: string, feishuClient?: any): Promise<{
    message: string;
    success: boolean;
  }> {
    try {
      logger.info(`用户 ${openId} 请求删除阶段: ${stageName}`);

      // 获取当前活跃配置
      const currentPlan = this.getActivePlan(openId) || [];

      // 查找要删除的阶段
      const stageIndex = currentPlan.findIndex(stage => stage.name === stageName);
      if (stageIndex === -1) {
        return {
          success: false,
          message: `❌ 未找到阶段"${stageName}"`
        };
      }

      // 移除阶段
      const updatedPlan = currentPlan.filter(stage => stage.name !== stageName);

      // 更新数据库
      this.dataSource.createOrUpdateMedicationPlan(openId, updatedPlan);

      // 清空并重新创建定时任务
      if (feishuClient) {
        updateUserSchedule(openId, this.dataSource, feishuClient);
      }

      logger.info(`用户 ${openId} 成功删除阶段: ${stageName}`);

      return {
        success: true,
        message: `✅ 已删除阶段"${stageName}"，相关定时提醒已停止`
      };

    } catch (error) {
      logger.error(`用户 ${openId} 删除阶段失败: ${error}`);
      return {
        success: false,
        message: "❌ 删除阶段失败，请稍后重试"
      };
    }
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