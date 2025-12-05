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
      const trimmedText = text.trim();

      // ============ 消息模式匹配统一管理 ============

      // 1. 修改计划消息
      if (trimmedText === "修改计划") {
        return this.createModifyPlanResult(openId);
      }

      // 2. 计划管理命令
      if (trimmedText === "清空配置" || trimmedText === "初始化配置") {
        return await this.handleClearConfiguration(openId);
      }

      // 3. 添加阶段命令：支持两种格式
      const addStageMatchHour = trimmedText.match(/^添加阶段(.+?)，提醒时间(\d{1,2})点$/);
      if (addStageMatchHour) {
        const stageName = addStageMatchHour[1].trim();
        const hour = parseInt(addStageMatchHour[2]);
        return await this.handleAddStage(openId, stageName, hour, 0);
      }

      const addStageMatchTime = trimmedText.match(/^添加阶段(.+?)，提醒时间(\d{1,2}):(\d{1,2})$/);
      if (addStageMatchTime) {
        const stageName = addStageMatchTime[1].trim();
        const hour = parseInt(addStageMatchTime[2]);
        const minute = parseInt(addStageMatchTime[3]);
        return await this.handleAddStage(openId, stageName, hour, minute);
      }

      // 4. 删除阶段命令
      const deleteStageMatch = trimmedText.match(/^删除阶段(.+)$/);
      if (deleteStageMatch) {
        const stageName = deleteStageMatch[1].trim();
        return await this.handleDeleteStage(openId, stageName);
      }

      // 5. 服药确认消息：统一模式匹配
      const medicationMatch = trimmedText.match(/^(.+?)吃了$/);
      if (medicationMatch) {
        const stageName = medicationMatch[1].trim();
        if (stageName.length > 0) {
          return await this.handleMedicationConfirmation(openId, stageName);
        }
      }

      // 6. 历史记录查询：相对日期
      if (trimmedText === "今天" || trimmedText === "昨天" || trimmedText === "前天") {
        return await this.handleHistoryQuery(openId, trimmedText);
      }

      // 7. 历史记录查询：具体日期格式 YYYY-MM-DD 或 YYYY/MM/DD
      const datePattern = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/;
      const dateMatch = trimmedText.match(datePattern);
      if (dateMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const day = parseInt(dateMatch[3]);

        // 验证日期有效性
        const inputDate = new Date(year, month - 1, day);
        if (inputDate.getFullYear() === year &&
            inputDate.getMonth() === month - 1 &&
            inputDate.getDate() === day) {
          const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          return await this.handleHistoryQuery(openId, formattedDate, formattedDate);
        }
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
   * 处理清空配置命令
   */
  private async handleClearConfiguration(openId: string): Promise<MessageProcessResult> {
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

  /**
   * 处理添加阶段命令
   */
  private async handleAddStage(openId: string, stageName: string, hour: number, minute: number): Promise<MessageProcessResult> {
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
   * 处理删除阶段命令
   */
  private async handleDeleteStage(openId: string, stageName: string): Promise<MessageProcessResult> {
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
  private async handleMedicationConfirmation(openId: string, stageName: string): Promise<MessageProcessResult> {
    // 获取用户的当前活跃计划
    const currentPlan = this.planService.getActivePlan(openId);
    if (!currentPlan || currentPlan.length === 0) {
      return {
        actions: [{
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: `❌ 您还没有配置任何服药计划，请先发送"修改计划"进行配置`
            }
          }
        }],
        success: false
      };
    }

    // 查找用户配置中是否有匹配的阶段
    const matchedStage = currentPlan.find(stage => stage.name === stageName);
    if (!matchedStage) {
      // 构建用户已配置的阶段列表
      const configuredStages = currentPlan.map(stage => stage.name).join('、');
      return {
        actions: [{
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: `❌ 您的服药计划中没有"${stageName}"阶段。\n当前已配置的阶段：${configuredStages}\n请确认阶段名称或先配置该阶段。`
            }
          }
        }],
        success: false
      };
    }

    // 找到匹配的阶段，确认服药
    const confirmResult = await this.medicationService.confirmMedication(
      openId,
      matchedStage.id,
      stageName
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
      success: confirmResult.success
    };
  }

  /**
   * 处理历史记录查询
   */
  private async handleHistoryQuery(openId: string, queryText: string, displayName?: string): Promise<MessageProcessResult> {
    // 计算日期
    let date: string;
    let actualDisplayName: string;

    if (queryText === "今天") {
      const today = new Date();
      date = today.toISOString().split('T')[0];
      actualDisplayName = "今天";
    } else if (queryText === "昨天") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split('T')[0];
      actualDisplayName = "昨天";
    } else if (queryText === "前天") {
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      date = dayBeforeYesterday.toISOString().split('T')[0];
      actualDisplayName = "前天";
    } else {
      // 具体日期格式
      date = queryText;
      actualDisplayName = displayName || queryText;
    }

    const formattedRecords = this.medicationService.formatMedicationRecords(openId, date, actualDisplayName);

    return {
      actions: [{
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.TEXT,
            content: formattedRecords
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
