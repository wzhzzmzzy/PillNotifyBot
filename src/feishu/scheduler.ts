import { Cron } from 'croner';
import { DataSource, MedicationPlan } from '../db/index.js';
import { logger } from '../utils/logger.js';
import {
  MessageStateAction,
  StateActionType,
  MessageType
} from '../types/MessageState.js';

// 定时任务管理器，用于管理每个用户的服药提醒任务
export class MedicationScheduler {
  private static instance: MedicationScheduler;
  private jobs: Map<string, Cron[]> = new Map(); // key: openId, value: 该用户的所有定时任务
  private dataSource?: DataSource;
  private feishuClient?: any; // 将在 registerScheduler 中设置

  private constructor() { }

  static getInstance(): MedicationScheduler {
    if (!MedicationScheduler.instance) {
      MedicationScheduler.instance = new MedicationScheduler();
    }
    return MedicationScheduler.instance;
  }

  setDataSource(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  setFeishuClient(client: any) {
    this.feishuClient = client;
  }

  /**
   * 为用户创建定时任务
   * @param openId 用户的 open_id
   * @param medicationPlan 用户的服药计划
   */
  createScheduleForUser(openId: string, medicationPlan: MedicationPlan) {
    // 先清除该用户之前的所有定时任务
    this.clearUserSchedules(openId);

    const userJobs: Cron[] = [];

    medicationPlan.forEach((stage) => {
      const { id: stageId, name, time } = stage;

      // 解析时间格式 HH:mm
      const [hour, minute] = time.split(':').map(num => parseInt(num, 10));

      // 创建 cron 表达式：每天的指定时间执行
      const cronExpression = `${minute} ${hour} * * *`;

      logger.info(`为用户 ${openId} 创建定时任务: ${name} (${time}), cron: ${cronExpression}`);

      const job = new Cron(cronExpression, async () => {
        logger.info(`定时任务开始执行 - 用户: ${openId}, 阶段: ${name} (${time})`);

        try {
          if (!this.dataSource || !this.feishuClient) {
            logger.error(`数据源或飞书客户端未初始化`);
            return;
          }

          // 获取用户当前的计划配置，确保该阶段仍然存在
          const currentPlan = this.dataSource.getActiveMedicationPlan(openId);
          if (!currentPlan || !currentPlan.find(s => s.id === stageId)) {
            logger.info(`定时任务结束 - 用户 ${openId} 的阶段 ${name} 已被删除，中止执行`);
            return;
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

            // 发送提醒消息
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
                      title: `准点报时来了，现在是${time}，${name}记得吃药哦~`
                    }
                  }
                }
              }
            };
            await this.feishuClient.executeActions([sendMessageAction]);

            logger.info(`定时任务结束 - 用户 ${openId} 阶段 ${name}: 未服用-发送消息`);
          } else {
            logger.info(`定时任务结束 - 用户 ${openId} 阶段 ${name}: 已服用-中止发送`);
          }
        } catch (error) {
          logger.error(`定时任务执行失败 - 用户: ${openId}, 阶段: ${name}: ${error}`);
        }
      });

      userJobs.push(job);
    });

    // 保存该用户的所有定时任务
    this.jobs.set(openId, userJobs);

    logger.info(`用户 ${openId} 的定时任务已创建，共 ${userJobs.length} 个任务`);
  }

  /**
   * 清除指定用户的所有定时任务
   * @param openId 用户的 open_id
   */
  clearUserSchedules(openId: string) {
    const existingJobs = this.jobs.get(openId);
    if (existingJobs) {
      existingJobs.forEach(job => {
        job.stop();
      });
      this.jobs.delete(openId);
      logger.info(`已清除用户 ${openId} 的所有定时任务`);
    }
  }

  /**
   * 获取指定用户当前的定时任务数量
   * @param openId 用户的 open_id
   * @returns 定时任务数量
   */
  getUserScheduleCount(openId: string): number {
    const jobs = this.jobs.get(openId);
    return jobs ? jobs.length : 0;
  }

  /**
   * 停止所有定时任务
   */
  stopAll() {
    this.jobs.forEach((jobs, openId) => {
      jobs.forEach(job => job.stop());
      logger.info(`已停止用户 ${openId} 的所有定时任务`);
    });
    this.jobs.clear();
    logger.info('所有定时任务已停止');
  }
}

/**
 * 注册调度器 - 为用户设置定时提醒任务
 * @param openId 用户的 open_id
 */
export function registerScheduler(openId: string) {
  logger.info(`开始为用户 ${openId} 注册调度器`);
  // 这个函数会在 p2p_chat_create 事件中被调用
  // 实际的定时任务创建会在用户配置更新时进行
}

/**
 * 更新用户的定时任务
 * @param openId 用户的 open_id
 * @param dataSource 数据源
 * @param feishuClient 飞书客户端
 */
export function updateUserSchedule(openId: string, dataSource: DataSource, feishuClient: any) {
  const scheduler = MedicationScheduler.getInstance();
  scheduler.setDataSource(dataSource);
  scheduler.setFeishuClient(feishuClient);

  // 获取用户当前的活跃配置
  const medicationPlan = dataSource.getActiveMedicationPlan(openId);

  if (medicationPlan && medicationPlan.length > 0) {
    scheduler.createScheduleForUser(openId, medicationPlan);
    logger.info(`用户 ${openId} 的定时任务已更新`);
  } else {
    // 如果没有配置，清除所有定时任务
    scheduler.clearUserSchedules(openId);
    logger.info(`用户 ${openId} 没有活跃配置，已清除所有定时任务`);
  }
}

/**
 * 获取调度器实例（用于测试或其他需要的场合）
 */
export function getSchedulerInstance(): MedicationScheduler {
  return MedicationScheduler.getInstance();
}
