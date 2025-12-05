import { DataSource } from '../db/index.js';
import { logger } from '../utils/logger.js';
import {
  MessageStateAction,
  StateActionType,
  MessageType
} from '../types/MessageState.js';

/**
 * 定时任务业务逻辑服务
 * 将定时任务的核心逻辑从 scheduler 中抽取出来，提高可测性
 */
export class TaskService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * 执行定时任务的核心逻辑
   * @param openId 用户的 open_id
   * @param stageId 服药阶段 ID
   * @param stageName 阶段名称
   * @returns 需要执行的 Actions 数组
   */
  async run(openId: string, stageId: number, stageName: string): Promise<MessageStateAction[]> {
    const actions: MessageStateAction[] = [];

    try {
      logger.info(`定时任务开始执行 - 用户: ${openId}, 阶段: ${stageName} (ID: ${stageId})`);

      // 获取用户当前的计划配置，确保该阶段仍然存在
      const currentPlan = this.dataSource.getActiveMedicationPlan(openId);
      if (!currentPlan || !currentPlan.find(s => s.id === stageId)) {
        logger.info(`定时任务结束 - 用户 ${openId} 的阶段 ${stageName} 已被删除，中止执行`);
        return actions;
      }

      // 检查用户今天是否已经服用过这个阶段的药
      const isCompleted = this.dataSource.isStageCompletedToday(openId, stageId);

      if (!isCompleted) {
        // 检查是否已经有未服用记录存在
        const todayRecords = this.dataSource.getTodayMedicationRecords(openId);
        const existingPendingRecord = todayRecords.find(
          record => record.stage === stageId && record.medication_time === new Date(0).toISOString()
        );

        if (!existingPendingRecord) {
          // 如果不存在记录，创建一个"未服用"的记录
          this.dataSource.createPendingMedicationRecord(openId, stageId);
        }

        // 创建发送提醒消息的 Action
        const sendMessageAction: MessageStateAction = {
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.CARD,
              content: {
                templateId: "AAqXfv48ZgpjT",
                templateVersion: "1.0.2",
                templateVariable: {
                    title: `准点报时来啦，${stageName}记得吃药哦`
                }
              }
            }
          }
        };

        actions.push(sendMessageAction);

        logger.info(`定时任务结束 - 用户 ${openId} 阶段 ${stageName}: 未服用-发送消息`);
      } else {
        logger.info(`定时任务结束 - 用户 ${openId} 阶段 ${stageName}: 已服用-中止发送`);
      }

      return actions;

    } catch (error) {
      logger.error(`定时任务执行失败 - 用户: ${openId}, 阶段: ${stageName}: ${error}`);
      return actions;
    }
  }

  /**
   * Debug模式：强制执行任务逻辑（忽略是否已服药的检查）
   * @param openId 用户的 open_id
   * @param stageName 阶段名称
   * @returns 需要执行的 Actions 数组
   */
  async debugRun(openId: string, stageName: string): Promise<MessageStateAction[]> {
    const actions: MessageStateAction[] = [];

    try {
      logger.info(`Debug模式 - 强制发送通知 - 用户: ${openId}, 阶段: ${stageName}`);

      // 获取用户当前的计划配置
      const currentPlan = this.dataSource.getActiveMedicationPlan(openId);
      if (!currentPlan || currentPlan.length === 0) {
        // 没有配置时的提示
        const errorAction: MessageStateAction = {
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: `❌ Debug失败：您还没有配置任何服药计划\n请先发送"修改计划"进行配置`
            }
          }
        };
        actions.push(errorAction);
        return actions;
      }

      // 查找指定的阶段
      const targetStage = currentPlan.find(stage => stage.name === stageName);
      if (!targetStage) {
        // 阶段不存在时的提示
        const configuredStages = currentPlan.map(stage => stage.name).join('、');
        const errorAction: MessageStateAction = {
          type: StateActionType.SEND_MESSAGE,
          payload: {
            openId,
            message: {
              type: MessageType.TEXT,
              content: `❌ Debug失败：未找到"${stageName}"阶段\n当前已配置的阶段：${configuredStages}`
            }
          }
        };
        actions.push(errorAction);
        return actions;
      }

      // 创建发送提醒消息的 Action
      const sendMessageAction: MessageStateAction = {
        type: StateActionType.SEND_MESSAGE,
        payload: {
            openId,
            message: {
            type: MessageType.CARD,
            content: {
                templateId: "AAqXfv48ZgpjT",
                templateVersion: "1.0.4",
                templateVariable: {
                    title: `准点报时来啦，${stageName}记得吃药哦`,
                    sub_title: 'Debug通知'
                }
            }
            }
        }
      };

      actions.push(sendMessageAction);

      logger.info(`Debug模式完成 - 用户 ${openId} 阶段 ${stageName}: 强制发送提醒`);
      return actions;

    } catch (error) {
      logger.error(`Debug模式执行失败 - 用户: ${openId}, 阶段: ${stageName}: ${error}`);

      // 发送错误消息
      const errorAction: MessageStateAction = {
        type: StateActionType.SEND_MESSAGE,
        payload: {
          openId,
          message: {
            type: MessageType.TEXT,
            content: `❌ Debug执行失败：${error}`
          }
        }
      };
      actions.push(errorAction);
      return actions;
    }
  }
}
