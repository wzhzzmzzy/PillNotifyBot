import * as lark from "@larksuiteoapi/node-sdk";
import { logger } from "../utils/logger.js";
import { CardAction, FeishuMessage } from "../types/Feishu.js";
import { EventHandler } from "./event.js";
import { MenuActions } from "../const/menu.js";

export class FeishuClient {
  private larkClient: lark.Client;
  private larkWsClient: lark.WSClient;

  constructor() {
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

    this.initWsEvent();
  }

  initWsEvent() {
    const event = new EventHandler({ feishu: this });
    this.larkWsClient.start({
      // 处理「接收消息」事件，事件类型为 im.message.receive_v1
      eventDispatcher: new lark.EventDispatcher({}).register({
        "card.action.trigger": (data: CardAction) => {
          logger.info("收到卡片交互事件");
          logger.info(data);
          const response = event.handler(event.card(data));
          logger.info("发送卡片回执");
          logger.info(response);
          return response;
        },
        "application.bot.menu_v6": (data) => {
          logger.info("收到机器人菜单事件");
          logger.info(data);
          event.handler(event.menu(data.event_key as MenuActions, data));
        },
        "im.message.receive_v1": (data) => {
          logger.info("收到新消息");
          logger.info(data);
          event.handler(event.message(data));
        },
        p2p_chat_create: (data) => {
          logger.info("新用户初始化");
          logger.info(data);
          event.handler(event.bot("init", data));
        },
        "im.chat.access_event.bot_p2p_chat_entered_v1": (data) => {
          logger.info("用户进入会话");
          logger.info(data);
          event.handler(event.bot("enter", data));
        },
        "im.message.message_read_v1": (data) => {
          logger.info("用户已读消息");
          logger.info(data);
          event.handler(event.bot("read", data));
        },
      }),
    });
  }

  sendMessage(messagePayload: FeishuMessage) {
    logger.info("给用户发送消息");
    logger.info(messagePayload);
    return this.larkClient.im.v1.message.create({
      params: {
        receive_id_type: "open_id",
      },
      data: {
        ...messagePayload,
      },
    });
  }
}
