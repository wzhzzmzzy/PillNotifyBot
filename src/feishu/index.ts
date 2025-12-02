import * as lark from "@larksuiteoapi/node-sdk";
import { DataSource } from "../db/index.js";

export class FeishuClient {
  larkClient: lark.Client;
  larkWsClient: lark.WSClient;
  dataSource: DataSource;

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

    this.initWsEvent();

    this.dataSource = dataSource;
  }

  initWsEvent() {
    this.larkWsClient.start({
      // 处理「接收消息」事件，事件类型为 im.message.receive_v1
      eventDispatcher: new lark.EventDispatcher({}).register({
        "im.message.receive_v1": (data) => {
          const {
            message: { chat_id, content },
          } = data;
          return this.sendTextMessage(chat_id, `收到消息：${content}`);
        },

        p2p_chat_create: (data) => {},
      }),
    });
  }

  close() {}

  sendTextMessage(id: string, text: string) {
    return this.larkClient.im.v1.message.create({
      params: {
        receive_id_type: "chat_id",
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
