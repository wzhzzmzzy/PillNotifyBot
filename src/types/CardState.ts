import { SnackCaser } from "../const/card.js";

export interface CardResponse {
  toast?: {
    type: "success" | "error" | "info" | "warning";
    content: string;
    i18n?: {
      zh_cn: string;
      en_us: string;
    };
  };
  card?: {
    type: "template";
    data: ReturnType<typeof SnackCaser>;
  };
}
