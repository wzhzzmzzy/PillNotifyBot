import { MedicationService } from './MedicationService.js';
import { PlanService } from './PlanService.js';
import { logger } from '../utils/logger.js';
import {
  MessageContext,
  MessageProcessResult,
  MessageStateAction,
  StateActionType,
  MessageType
} from '../types/MessageState.js';

/**
 * 消息处理业务逻辑服务 - 纯函数式设计
 */
export class MessageService {
  private medicationService: MedicationService;
  private planService: PlanService;

  constructor(medicationService: MedicationService, planService: PlanService) {
    this.medicationService = medicationService;
    this.planService = planService;
  }

  /**
   * 处理消息 - 纯函数式设计
   * @param context 消息上下文
   * @returns 消息处理结果（包含要执行的动作）
   */
  async processMessage(context: MessageContext): Promise<MessageProcessResult> {
    const { openId, text } = context;

    logger.info(`用户 ${openId} 发送文本消息: ${text}`);

    try {
      // 处理"修改计划"消息
      if (text === "修改计划") {
        return this.createModifyPlanResult(openId);
      }

      // 处理计划配置命令
      const planCommandResult = await this.processPlanCommand(openId, text);
      if (planCommandResult) {
        return planCommandResult;
      }

      // 处理服药确认消息
      const medicationResult = await this.processMedicationConfirmation(openId, text);
      if (medicationResult) {
        return medicationResult;
      }

      // 未知消息类型
      logger.info(`用户 ${openId} 的消息不匹配任何处理模式: ${text}`);
      return {
        actions: [{
          type: StateActionType.NO_ACTION
        }],
        success: true
      };

    } catch (error) {
      logger.error(`处理消息失败: ${error}`);
      return {
        actions: [{
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: "❌ 处理消息时发生错误，请稍后重试"
            }
          }
        }],
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * 创建修改计划结果
   */
  private createModifyPlanResult(openId: string): MessageProcessResult {
    const templateData = this.planService.generateTemplateData(openId);

    return {
      actions: [{
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.CARD,
            content: {
              templateId: "AAqXfv48ZgpjT",
              templateVersion: "1.0.0",
              templateVariable: templateData
            }
          }
        }
      }],
      success: true
    };
  }

  /**
   * 处理计划配置命令
   */
  private async processPlanCommand(openId: string, text: string): Promise<MessageProcessResult | null> {
    const trimmedText = text.trim();

    // 清空配置或初始化配置
    if (trimmedText === "清空配置" || trimmedText === "初始化配置") {
      const result = await this.planService.clearUserConfiguration(openId);
      return {
        actions: [{
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: result.message
            }
          }
        }],
        success: result.success
      };
    }

    // 添加阶段命令：支持两种格式
    const addStageMatchHour = trimmedText.match(/^添加阶段(.+?)，提醒时间(\d{1,2})点$/);
    const addStageMatchTime = trimmedText.match(/^添加阶段(.+?)，提醒时间(\d{1,2}):(\d{1,2})$/);

    if (addStageMatchHour) {
      const stageName = addStageMatchHour[1].trim();
      const hour = parseInt(addStageMatchHour[2]);
      const minute = 0;
      return await this.createAddStageResult(openId, stageName, hour, minute);
    }

    if (addStageMatchTime) {
      const stageName = addStageMatchTime[1].trim();
      const hour = parseInt(addStageMatchTime[2]);
      const minute = parseInt(addStageMatchTime[3]);
      return await this.createAddStageResult(openId, stageName, hour, minute);
    }

    // 删除阶段命令
    const deleteStageMatch = trimmedText.match(/^删除阶段(.+)$/);
    if (deleteStageMatch) {
      const stageName = deleteStageMatch[1].trim();
      return await this.createDeleteStageResult(openId, stageName);
    }

    return null;
  }

  /**
   * 创建添加阶段结果
   */
  private async createAddStageResult(openId: string, stageName: string, hour: number, minute: number): Promise<MessageProcessResult> {
    const result = await this.planService.addStage(openId, stageName, hour, minute);

    const actions: MessageStateAction[] = [
      {
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.TEXT,
            content: result.message
          }
        }
      }
    ];

    // 如果添加成功，需要更新调度
    if (result.success) {
      actions.push({
        type: StateActionType.UPDATE_SCHEDULE,
        payload: {
          openId,
          shouldUpdate: true
        }
      });
    }

    return {
      actions,
      success: result.success
    };
  }

  /**
   * 创建删除阶段结果
   */
  private async createDeleteStageResult(openId: string, stageName: string): Promise<MessageProcessResult> {
    const result = await this.planService.deleteStage(openId, stageName);

    const actions: MessageStateAction[] = [
      {
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.TEXT,
            content: result.message
          }
        }
      }
    ];

    // 如果删除成功，需要更新调度
    if (result.success) {
      actions.push({
        type: StateActionType.UPDATE_SCHEDULE,
        payload: {
          openId,
          shouldUpdate: true
        }
      });
    }

    return {
      actions,
      success: result.success
    };
  }

  /**
   * 处理服药确认消息
   */
  private async processMedicationConfirmation(openId: string, text: string): Promise<MessageProcessResult | null> {
    const medicationResult = this.medicationService.parseMedicationConfirmation(text);
    if (!medicationResult) {
      return null;
    }

    const confirmResult = await this.medicationService.confirmMedication(
      openId,
      medicationResult.stageId,
      medicationResult.stageName
    );

    return {
      actions: [{
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.TEXT,
            content: confirmResult.message
          }
        }
      }],
      success: true
    };
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