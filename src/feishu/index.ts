import * as lark from "@larksuiteoapi/node-sdk";
import Router from "@koa/router";

export class FeishuClient {
  larkClient: lark.Client;
  larkWsClient: lark.WSClient;
  koaRouter: Router;

  constructor() {
    this.larkClient = new lark.Client({
      appId: import.meta.env.APP_ID as string,
      appSecret: import.meta.env.APP_SECRET as string,
      appType: lark.AppType.SelfBuild,
    });

    this.larkWsClient = new lark.WSClient({
      appId: import.meta.env.APP_ID as string,
      appSecret: import.meta.env.APP_SECRET as string,
      loggerLevel: lark.LoggerLevel.debug,
    });

    this.koaRouter = new Router();

    this.initWsEvent();
  }

  routes() {
    return this.koaRouter.routes;
  }

  initWsEvent() {
    this.larkWsClient.start({
      // 处理「接收消息」事件，事件类型为 im.message.receive_v1
      eventDispatcher: new lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data) => {
          const {
            message: { chat_id, content },
          } = data;
          this.sendTextMessage(chat_id, `收到消息：${content}`);
        },
      }),
    });
  }

  initWebhookListener() {
    // https://open.feishu.cn/document/server-side-sdk/nodejs-sdk/handling-events#b8ccabc5
    this.koaRouter.post("/webhook", lark.adaptKoaRouter(this.onMessage()));
  }

  onMessage() {
    return new lark.EventDispatcher({
      encryptKey: import.meta.env.ENCRYPT_KEY,
    }).register({
      "im.message.receive_v1": async (data) => {
        const open_chat_id = data.message.chat_id;
        return this.sendTextMessage(open_chat_id, "Reply");
      },
    });
  }

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
