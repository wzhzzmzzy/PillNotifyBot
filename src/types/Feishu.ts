import type { Client } from "@larksuiteoapi/node-sdk";
import { EventDispatcher } from "@larksuiteoapi/node-sdk";
import { MenuActions } from "../const/menu.js";

export type FeishuMessage = NonNullable<
  Parameters<Client["im"]["v1"]["message"]["create"]>[0]
>["data"];

export type EventPayload<
  K extends keyof Parameters<EventDispatcher["register"]>[0],
> = Parameters<NonNullable<Parameters<EventDispatcher["register"]>[0][K]>>[0];

export type FeishuEvent =
  | MessageEvent
  | BotEvent
  | MenuEvent
  | CardEvent
  | CronEvent;

type EventKV<K, V> = {
  key: K;
  value: V;
};

export type CronEvent = {
  type: "Cron";
  key: "notify";
};

export type MessageEvent = {} & {
  type: "Message";
  payload: EventPayload<"im.message.receive_v1">;
};

export type BotEvent = (
  | EventKV<"init", EventPayload<"p2p_chat_create">>
  | EventKV<"read", EventPayload<"im.message.message_read_v1">>
  | EventKV<
      "enter",
      EventPayload<"im.chat.access_event.bot_p2p_chat_entered_v1">
    >
) & {
  type: "Bot";
};

export type MenuEvent = EventKV<
  MenuActions,
  EventPayload<"application.bot.menu_v6">
> & {
  type: "Menu";
};

export type CardEvent = {
  type: "Card";
  payload: CardAction;
};

export interface CardAction {
  schema: string; // 通常是协议版本，例如 "2.0"

  // 事件核心字段
  event_id: string; // 事件唯一 ID
  token: string; // 用于校验事件来源的 token
  create_time: string; // 事件创建时间（通常是精确到微秒的字符串时间戳）
  event_type: "card.action.trigger"; // 事件类型，固定为卡片动作触发
  tenant_key: string; // 租户 Key
  app_id: string; // 应用 ID

  /**
   * 执行卡片操作的用户信息。
   */
  operator: {
    tenant_key: string;
    user_id: string; // 用户的内部 ID
    open_id: string; // 用户的 Open ID
    union_id: string; // 用户的 Union ID
  };

  /**
   * 触发的具体卡片动作信息。
   */
  action: {
    value?: {
      event: MenuActions;
    };
    tag?: string; // 动作组件的标签，例如 "button"
    timezone?: string; // 操作用户所在的时区，例如 "Asia/Shanghai"
    name?: string; // 动作组件的名称 (name)
    /**
     * 卡片中的表单数据，键值对形式。
     * 这里的键 (name) 对应卡片元素中的 name 属性，值是用户输入或选择的值。
     */
    form_value?: {
      [key: string]: string | number | boolean; // 表单值类型可能多样，这里使用联合类型
      // 示例中是: { "name": "早上", "time": "10:00 +0800" }
    };
  };

  /**
   * 卡片所在的上下文环境。
   */
  context: {
    host: string; // 卡片所在的主机/平台，例如 "im_message" (即 IM 消息中)
    open_message_id: string; // 卡片所在消息的 Open Message ID
    open_chat_id: string; // 卡片所在的群聊/单聊的 Open Chat ID
  };
}
