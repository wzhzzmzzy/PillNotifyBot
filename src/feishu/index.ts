import * as lark from "@larksuiteoapi/node-sdk";
import { DataSource } from "../db/index.js";
import { registerScheduler, updateUserSchedule } from "./scheduler.js";
import { MessageService } from "../services/MessageService.js";
import { MedicationService } from "../services/MedicationService.js";
import { PlanService } from "../services/PlanService.js";
import { TaskService } from "../services/TaskService.js";
import { CardService } from "../services/CardService.js";
import { logger } from "../utils/logger.js";
import {
  MessageContext,
  MessageStateAction,
  StateActionType,
  MessageType
} from "../types/MessageState.js";

type Message = Parameters<
  NonNullable<
    Parameters<lark.EventDispatcher["register"]>[0]["im.message.receive_v1"]
  >
>[0];

export class FeishuClient {
  larkClient: lark.Client;
  larkWsClient: lark.WSClient;
  dataSource: DataSource;
  messageService: MessageService;
  cardService: CardService;

  constructor({ dataSource }: { dataSource: DataSource }) {
    this.larkClient = new lark.Client({
      appId: import.meta.env.APP_ID as string,
      appSecret: import.meta.env.APP_SECRET as string,
      appType: lark.AppType.SelfBuild,
    });
    this.larkWsClient = new lark.WSClient({
      appId: import.meta.env.APP_ID as string,
      appSecret: import.meta.env.APP_SECRET as string,
      loggerLevel: lark.LoggerLevel.info,
    });

    this.dataSource = dataSource;

    // 初始化业务服务
    const medicationService = new MedicationService(dataSource);
    const planService = new PlanService(dataSource);
    const taskService = new TaskService(dataSource);
    this.messageService = new MessageService(medicationService, planService, taskService);
    this.cardService = new CardService(medicationService, planService);

    this.initWsEvent();
  }

  initWsEvent() {
    this.larkWsClient.start({
      // 处理「接收消息」事件，事件类型为 im.message.receive_v1
      eventDispatcher: new lark.EventDispatcher({}).register({
        "card.action.trigger": (data: any) => {
          logger.info("收到卡片交互事件");
          return this.handleCardAction(data);
        },
        "im.message.receive_v1": (data) => {
          logger.info("收到新消息");
          return this.onMessage(data);
        },

        p2p_chat_create: (data) => {
          const {
            user: { open_id, name },
          } = data;

          logger.info("新用户初始化")
          // 使用业务服务处理新用户
          this.messageService.handleNewChat(open_id, name);

          return registerScheduler(open_id);
        },

        "im.chat.access_event.bot_p2p_chat_entered_v1": () => {
          logger.info("用户进入会话")

          return;
        }
      }),
    });
  }

  close() { }

  async onMessage(message: Message) {
    const { sender, message: messageData } = message;
    const open_id = sender.sender_id?.open_id;
    const { content, message_type } = messageData;

    if (!open_id) {
      logger.warn("消息中缺少发送者 open_id");
      return;
    }

    logger.info(`收到用户 ${open_id} 的消息`);

    // 只处理文本消息
    if (message_type !== "text") {
      return;
    }

    try {
      const textContent = JSON.parse(content);
      const text = textContent.text?.trim();

      if (!text) {
        return;
      }

      // 创建消息上下文
      const context: MessageContext = {
        openId: open_id,
        text,
        timestamp: Date.now()
      };

      // 使用业务服务处理消息
      const result = await this.messageService.processMessage(context);

      // 根据状态机执行相应的动作
      await this.executeActions(result.actions);

    } catch (error) {
      logger.error(`处理消息失败: ${error}`);
    }
  }

  /**
   * 执行状态机动作
   */
  public async executeActions(actions: MessageStateAction[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(action);
      } catch (error) {
        logger.error(`执行动作失败: ${error}`);
      }
    }
  }

  /**
   * 执行单个动作
   */
  private async executeAction(action: MessageStateAction): Promise<void> {
    logger.info(`执行动作：${action.type}`)
    switch (action.type) {
      case StateActionType.SEND_MESSAGE:
        await this.handleSendMessage(action.payload.openId, action.payload.message);
        break;

      case StateActionType.UPDATE_SCHEDULE:
        await this.handleUpdateSchedule(action.payload.openId, action.payload.shouldUpdate);
        break;

      case StateActionType.NO_ACTION:
        logger.debug('无需执行动作');
        break;

      default:
        logger.warn('未知的动作类型', action);
    }
  }

  /**
   * 处理发送消息动作
   */
  private async handleSendMessage(openId: string, message: any): Promise<void> {
    switch (message.type) {
      case MessageType.TEXT:
        await this.sendTextMessage(openId, message.content);
        break;

      case MessageType.CARD:
        const { templateId, templateVersion, templateVariable } = message.content;
        await this.sendCardMessageByTemplateId(
          openId,
          templateId,
          templateVersion,
          templateVariable
        );
        break;

      case MessageType.JSON_CARD:
        const { json } = message.content;
        await this.sendCardMessageByJSON(openId, json)
        break;

      default:
        logger.warn('未知的消息类型', message);
    }
  }

  /**
   * 处理更新调度动作
   */
  private async handleUpdateSchedule(openId: string, shouldUpdate: boolean): Promise<void> {
    if (shouldUpdate) {
      updateUserSchedule(openId, this.dataSource, this);
    }
  }

  /**
   * 处理卡片交互事件
   */
  private async handleCardAction(data: any) {
    try {
      const { operator, action } = data;
      const { open_id } = operator;

      // 使用业务服务处理卡片交互
      const result = await this.cardService.processCardAction(open_id, action)

      if (result.actions.length > 0) {
        await this.executeActions(result.actions);
      }
      
      return {
        success: result.success,
        toast: result.toast,
        card: result.card
      }
    } catch (error) {
      logger.error(`处理卡片交互失败: ${error}`);
      return {
        success: false,
        toast: {
          type: "error",
          content: "操作失败",
          i18n: {
            zh_cn: "操作失败",
            en_us: "Operation failed",
          },
        },
      };
    }
  }

  private sendCardMessageByJSON(id: string, json: string) {
    return this.larkClient.im.message.create({
      params: {
        receive_id_type: 'open_id',
      },
      data: {
        receive_id: id,
        msg_type: 'interactive',
        content: json
      }
    })
  }

  private sendCardMessageByTemplateId(
    id: string,
    templateId: string,
    templateVersion: string,
    templateVariable?: Record<string, any>,
  ) {
    logger.info(`发送卡片消息给 ${id}，卡片配置：${templateId}@${templateVersion}，卡片变量：${JSON.stringify(templateVariable)}`)
    return this.larkClient.im.message.create({
      params: {
        receive_id_type: "open_id",
      },
      data: {
        receive_id: id,
        msg_type: "interactive",
        content: JSON.stringify({
          type: "template",
          data: {
            template_id: templateId,
            template_version_name: templateVersion,
            template_variable: templateVariable ?? {},
          },
        }),
      },
    });
  }

  private sendTextMessage(id: string, text: string) {
    return this.larkClient.im.v1.message.create({
      params: {
        receive_id_type: "open_id",
      },
      data: {
        receive_id: id,
        msg_type: "text",
        content: JSON.stringify({
          text,
        }),
      },
    });
  }
}
