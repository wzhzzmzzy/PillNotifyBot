import { MedicationService } from './MedicationService.js';
import { PlanService } from './PlanService.js';
import { logger } from '../utils/logger.js';

/**
 * 消息处理业务逻辑服务
 */
export class MessageService {
  private medicationService: MedicationService;
  private planService: PlanService;

  constructor(medicationService: MedicationService, planService: PlanService) {
    this.medicationService = medicationService;
    this.planService = planService;
  }

  /**
   * 处理文本消息
   * @param openId 用户的 open_id
   * @param text 消息文本
   * @returns 处理结果
   */
  async handleTextMessage(openId: string, text: string): Promise<{
    type: 'modify_plan' | 'medication_confirm' | 'unknown';
    data?: any;
  }> {
    logger.info(`用户 ${openId} 发送文本消息: ${text}`);

    // 处理"修改计划"消息
    if (text === "修改计划") {
      return {
        type: 'modify_plan',
        data: this.planService.generateTemplateData(openId)
      };
    }

    // 处理服药确认消息
    const medicationResult = this.medicationService.parseMedicationConfirmation(text);
    if (medicationResult) {
      const confirmResult = await this.medicationService.confirmMedication(
        openId,
        medicationResult.stageId,
        medicationResult.stageName
      );

      return {
        type: 'medication_confirm',
        data: confirmResult
      };
    }

    logger.info(`用户 ${openId} 的消息不匹配任何处理模式: ${text}`);
    return { type: 'unknown' };
  }

  /**
   * 处理卡片交互
   * @param openId 用户的 open_id
   * @param actionData 卡片交互数据
   * @param feishuClient 飞书客户端实例
   * @returns 处理结果
   */
  async handleCardAction(openId: string, actionData: any, feishuClient: any): Promise<{
    success: boolean;
    toast: {
      type: 'success' | 'error';
      content: string;
      i18n: {
        zh_cn: string;
        en_us: string;
      };
    };
  }> {
    try {
      logger.info(`用户 ${openId} 进行了卡片交互`, actionData);

      // 处理计划更新
      if (actionData?.value) {
        const updateResult = await this.planService.updatePlan(openId, actionData.value, feishuClient);

        // 发送文本消息给用户
        await feishuClient.sendTextMessage(openId, updateResult.message);

        return {
          success: updateResult.success,
          toast: {
            type: updateResult.success ? 'success' : 'error',
            content: updateResult.success ? "配置已更新" : "配置更新失败",
            i18n: {
              zh_cn: updateResult.success ? "配置已更新" : "配置更新失败",
              en_us: updateResult.success ? "Configuration updated" : "Configuration update failed",
            },
          },
        };
      }

      return {
        success: true,
        toast: {
          type: 'success',
          content: "操作完成",
          i18n: {
            zh_cn: "操作完成",
            en_us: "Operation completed",
          },
        },
      };

    } catch (error) {
      logger.error(`处理卡片交互失败: ${error}`);
      return {
        success: false,
        toast: {
          type: 'error',
          content: "操作失败",
          i18n: {
            zh_cn: "操作失败",
            en_us: "Operation failed",
          },
        },
      };
    }
  }

  /**
   * 处理用户初次进入聊天
   * @param openId 用户的 open_id
   * @param name 用户名
   */
  async handleNewChat(openId: string, name: string): Promise<void> {
    logger.info(`用户 ${name} (${openId}) 初次进入聊天`);
    await this.planService.handleNewUser(openId, name);
  }
}