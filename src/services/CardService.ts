import { MedicationService } from './MedicationService.js';
import { PlanService } from './PlanService.js';
import { logger } from '../utils/logger.js';
import {
  MessageStateAction,
  StateActionType,
  MessageType
} from '../types/MessageState.js';
import { CardResponse } from '../types/CardState.js';
import { PillNotifyCard, SnackCaser } from '../const/card.js';

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
  async processCardAction(openId: string, actionData: any): Promise<CardResponse> {
    try {
      logger.info(`用户 ${openId} 进行了卡片交互 ${JSON.stringify(actionData)}`);

      // 检查是否是服药完成操作
      if (actionData?.value?.action === 'done' && actionData?.value?.stageId) {
        const { stageId } = actionData.value;
        return await this.handleMedicationDone(openId, stageId);
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
  private async handleMedicationDone(openId: string, stageId: number): Promise<CardResponse> {
    try {
      logger.info(`用户 ${openId} 触发卡片记录：已服用`)
      // 检查今天这个阶段是否已经有记录且为已服用
      const isCompleted = this.medicationService.getTodayCompletedStages(openId).includes(stageId);
      // 获取阶段名称
      const currentPlan = this.planService.getActivePlan(openId);
      const stage = currentPlan?.find(s => s.id === stageId);
      const stageName = stage?.name || `阶段${stageId}`;

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
          card: {
            type: 'template',
            data: SnackCaser(PillNotifyCard({
              title: `已经吃过${stageName}这顿啦`,
              stageId: String(stageId),
              okBtnText: '已经吃过这顿啦',
              finish: true
            }))
          },
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


      // 记录服药
      const confirmResult = await this.medicationService.confirmMedication(openId, stageId, stageName);

      return {
        actions: [],
        toast: {
          type: confirmResult.success ? 'success' : 'error',
          content: confirmResult.success ? "已更新记录" : "更新失败，" + confirmResult.message,
          i18n: {
            zh_cn: confirmResult.success ? "已更新记录" : "更新失败，" + confirmResult.message,
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
}
