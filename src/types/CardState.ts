import { MessageStateAction } from "./MessageState.js";

export interface CardResponse {
  actions: MessageStateAction[];
  toast: {
    type: 'success' | 'error';
    content: string;
    i18n: {
      zh_cn: string;
      en_us: string;
    };
  };
  card?: {
    type: 'template',
    data: {
      template_id: string,
      template_version_name: string,
      template_variable: Record<string, string>
    }
  },
  success: boolean;
}