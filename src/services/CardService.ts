import { MedicationService } from './MedicationService.js';
import { PlanService } from './PlanService.js';
import { logger } from '../utils/logger.js';
import {
  MessageStateAction,
  StateActionType,
  MessageType
} from '../types/MessageState.js';

/**
 * 卡片交互业务逻辑服务
 */
export class CardService {
  private medicationService: MedicationService;
  private planService: PlanService;

  constructor(medicationService: MedicationService, planService: PlanService) {
    this.medicationService = medicationService;
    this.planService = planService;
  }

  /**
   * 处理卡片交互 - 使用状态机模式
   * @param openId 用户的 open_id
   * @param actionData 卡片交互数据
   * @returns 处理结果（Actions和Toast）
   */
  async processCardAction(openId: string, actionData: any): Promise<{
    actions: MessageStateAction[];
    toast: {
      type: 'success' | 'error';
      content: string;
      i18n: {
        zh_cn: string;
        en_us: string;
      };
    };
    success: boolean;
  }> {
    try {
      logger.info(`用户 ${openId} 进行了卡片交互 ${JSON.stringify(actionData)}`);

      // 检查是否是服药完成操作
      if (actionData?.value?.action === 'done' && actionData?.value?.stageId) {
        return await this.handleMedicationDone(openId, Number(actionData.value.stageId));
      }

      // 处理计划更新（保持原有逻辑）
      if (actionData?.value) {
        return await this.handlePlanUpdate(openId, actionData.value);
      }

      // 默认成功响应
      return {
        actions: [],
        toast: {
          type: 'success',
          content: "操作完成",
          i18n: {
            zh_cn: "操作完成",
            en_us: "Operation completed",
          },
        },
        success: true
      };

    } catch (error) {
      logger.error(`处理卡片交互失败: ${error}`);
      return {
        actions: [],
        toast: {
          type: 'error',
          content: "操作失败",
          i18n: {
            zh_cn: "操作失败",
            en_us: "Operation failed",
          },
        },
        success: false
      };
    }
  }

  /**
   * 处理服药完成操作
   */
  private async handleMedicationDone(openId: string, stageId: number): Promise<{
    actions: MessageStateAction[];
    toast: {
      type: 'success' | 'error';
      content: string;
      i18n: {
        zh_cn: string;
        en_us: string;
      };
    };
    success: boolean;
  }> {
    try {
      logger.info(`用户 ${openId} 触发卡片记录：已服用`)
      // 检查今天这个阶段是否已经有记录且为已服用
      console.log(this.medicationService.getTodayCompletedStages(openId), stageId)
      const isCompleted = this.medicationService.getTodayCompletedStages(openId).includes(stageId);

      if (isCompleted) {
        return {
          actions: [{
            type: StateActionType.SEND_MESSAGE,
            payload: {
              openId,
              message: {
                type: MessageType.TEXT,
                content: "已经服过药啦"
              }
            }
          }],
          toast: {
            type: 'success',
            content: "已经服过药啦",
            i18n: {
              zh_cn: "已经服过药啦",
              en_us: "Already taken",
            },
          },
          success: true
        };
      }

      // 获取阶段名称
      const currentPlan = this.planService.getActivePlan(openId);
      const stage = currentPlan?.find(s => s.id === stageId);
      const stageName = stage?.name || `阶段${stageId}`;

      // 记录服药
      const confirmResult = await this.medicationService.confirmMedication(openId, stageId, stageName);

      return {
        actions: [{
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: "已更新记录"
            }
          }
        }],
        toast: {
          type: confirmResult.success ? 'success' : 'error',
          content: confirmResult.success ? "已更新记录" : "更新失败",
          i18n: {
            zh_cn: confirmResult.success ? "已更新记录" : "更新失败",
            en_us: confirmResult.success ? "Record updated" : "Update failed",
          },
        },
        success: confirmResult.success
      };

    } catch (error) {
      logger.error(`处理服药完成操作失败: ${error}`);
      return {
        actions: [],
        toast: {
          type: 'error',
          content: "操作失败",
          i18n: {
            zh_cn: "操作失败",
            en_us: "Operation failed",
          },
        },
        success: false
      };
    }
  }

  /**
   * 处理计划更新操作
   */
  private async handlePlanUpdate(openId: string, value: any): Promise<{
    actions: MessageStateAction[];
    toast: {
      type: 'success' | 'error';
      content: string;
      i18n: {
        zh_cn: string;
        en_us: string;
      };
    };
    success: boolean;
  }> {
    try {
      // 简化的计划更新逻辑，避免依赖外部客户端
      let updateResult: { success: boolean; message: string };

      updateResult = {
          success: false,
          message: "❌ 格式不正确"
      };

      const actions: MessageStateAction[] = [{
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.TEXT,
            content: updateResult.message
          }
        }
      }];

      // 如果更新成功，需要更新调度
      if (updateResult.success) {
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
        toast: {
          type: updateResult.success ? 'success' : 'error',
          content: updateResult.success ? "配置已更新" : "配置更新失败",
          i18n: {
            zh_cn: updateResult.success ? "配置已更新" : "配置更新失败",
            en_us: updateResult.success ? "Configuration updated" : "Configuration update failed",
          },
        },
        success: updateResult.success
      };

    } catch (error) {
      logger.error(`处理计划更新失败: ${error}`);
      return {
        actions: [],
        toast: {
          type: 'error',
          content: "更新失败",
          i18n: {
            zh_cn: "更新失败",
            en_us: "Update failed",
          },
        },
        success: false
      };
    }
  }
}
