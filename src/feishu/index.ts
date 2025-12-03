import * as lark from "@larksuiteoapi/node-sdk";
import { DataSource } from "../db/index.js";
import { registerScheduler } from "./scheduler.js";
import { MessageService } from "../services/MessageService.js";
import { MedicationService } from "../services/MedicationService.js";
import { PlanService } from "../services/PlanService.js";
import { logger } from "../utils/logger.js";

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
    this.messageService = new MessageService(medicationService, planService);

    this.initWsEvent();
  }

  initWsEvent() {
    this.larkWsClient.start({
      // 处理「接收消息」事件，事件类型为 im.message.receive_v1
      eventDispatcher: new lark.EventDispatcher({}).register({
        "card.action.trigger": (data: any) => {
          logger.info("收到卡片交互事件", data);
          return this.handleCardAction(data);
        },
        "im.message.receive_v1": (data) => {
          logger.info(data);
          return this.onMessage(data);
        },

        p2p_chat_create: (data) => {
          const {
            user: { open_id, name },
          } = data;

          // 使用业务服务处理新用户
          this.messageService.handleNewChat(open_id, name);

          return registerScheduler(open_id);
        },
      }),
    });
  }

  close() {}

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

      // 使用业务服务处理消息
      const result = await this.messageService.handleTextMessage(open_id, text, this);

      // 根据处理结果发送响应
      switch (result.type) {
        case 'modify_plan':
          await this.sendCardMessageByTemplateId(
            open_id,
            "AAqXfv48ZgpjT",
            "1.0.0",
            result.data
          );
          break;

        case 'medication_confirm':
          await this.sendTextMessage(open_id, result.data.message);
          break;

        case 'plan_command':
          await this.sendTextMessage(open_id, result.data.message);
          break;

        case 'unknown':
          // 对于未知消息类型，可以选择不响应或发送帮助信息
          break;
      }

    } catch (error) {
      logger.error(`处理消息失败: ${error}`);
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
      const result = await this.messageService.handleCardAction(open_id, action, this);

      return result;
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

  sendCardMessageByTemplateId(
    id: string,
    templateId: string,
    templateVersion: string,
    templateVariable?: Record<string, any>,
  ) {
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

  sendTextMessage(id: string, text: string) {
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
