/**
 * 消息处理状态机的类型定义
 */

// 消息类型枚举
export enum MessageType {
  TEXT = 'text',
  CARD = 'card',
  JSON_CARD = 'json_card'
}

// 基础消息接口
export interface BaseMessage {
  type: MessageType;
  content: string | object;
}

// 文本消息
export interface TextMessage extends BaseMessage {
  type: MessageType.TEXT;
  content: string;
}

// 卡片消息
export interface CardMessage extends BaseMessage {
  type: MessageType.CARD;
  content: {
    templateId: string;
    templateVersion: string;
    templateVariable?: Record<string, any>;
  };
}

// 联合类型
export type Message = TextMessage | CardMessage;

// 状态机操作类型
export enum StateActionType {
  SEND_MESSAGE = 'send_message',
  UPDATE_SCHEDULE = 'update_schedule',
  NO_ACTION = 'no_action'
}

// 状态机动作接口
export interface StateAction {
  type: StateActionType;
  payload?: any;
}

// 发送消息动作
export interface SendMessageAction extends StateAction {
  type: StateActionType.SEND_MESSAGE;
  payload: {
    openId: string;
    message: Message;
  };
}

// 更新调度动作
export interface UpdateScheduleAction extends StateAction {
  type: StateActionType.UPDATE_SCHEDULE;
  payload: {
    openId: string;
    shouldUpdate: boolean;
  };
}

// 无动作
export interface NoAction extends StateAction {
  type: StateActionType.NO_ACTION;
}

// 联合动作类型
export type MessageStateAction = SendMessageAction | UpdateScheduleAction | NoAction;

// 消息处理结果
export interface MessageProcessResult {
  actions: MessageStateAction[];
  success: boolean;
  error?: string;
}

// 消息处理的输入上下文
export interface MessageContext {
  openId: string;
  text: string;
  timestamp?: number;
}