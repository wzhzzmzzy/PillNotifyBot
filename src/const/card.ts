import { MedicationStageConfig } from "../db/index.js";
import { CardResponse } from "../types/CardState.js";
import { FeishuMessage } from "../types/Feishu.js";
import { MenuActions } from "./menu.js";

export const PillPlanListCard = (params?: {
  plan_list: MedicationStageConfig[];
}) => ({
  templateId: "AAqX1qI4FLrt1",
  templateVersion: "1.0.2",
  templateVariable: params,
});

export const PillNotifyCard = (params?: { title: string }) => ({
  templateId: "AAqXfv48ZgpjT",
  templateVersion: "1.0.6",
  templateVariable: params,
});

type PillPlanAdditionCardVariable = {
  event: MenuActions;
  title: string;
  name?: string;
  time?: string;
  save?: boolean;
};

export const PillPlanAdditionCard = (
  params?: PillPlanAdditionCardVariable,
) => ({
  templateId: "AAqXibjpaXkjl",
  templateVersion: "1.0.6",
  templateVariable: params,
});

export const SnackCaser = (card: {
  templateId: string;
  templateVersion: string;
  templateVariable: any;
}) => {
  return {
    template_id: card.templateId,
    template_version_name: card.templateVersion,
    template_variable: card.templateVariable,
  };
};

export const CardMessage = (
  id: string,
  cardName: "notify" | MenuActions,
  params: any = {},
) => ({
  receive_id: id,
  msg_type: "interactive",
  content: JSON.stringify(CardContent(cardName, params)),
});

export const CardContent = (
  cardName: "notify" | MenuActions,
  params: any = {},
) => {
  const card = (data: ReturnType<typeof SnackCaser>) => ({
    type: "template" as "template",
    data,
  });

  if (cardName === "notify") {
    return card(SnackCaser(PillNotifyCard(params)));
  }

  if (
    cardName === MenuActions.PlanAddition ||
    cardName === MenuActions.PlanEdit
  ) {
    return card(
      SnackCaser(
        PillPlanAdditionCard({
          event: cardName,
          title:
            cardName === MenuActions.PlanAddition
              ? "添加提醒计划"
              : "修改提醒计划：" + params.name,
          // name: params.name,
          // time: params.time,
          save: params.save,
        }),
      ),
    );
  }

  if (cardName === MenuActions.PlanList) {
    return card(SnackCaser(PillPlanListCard(params)));
  }

  throw new Error("Unknown Card");
};

export const CardToast = (
  type: NonNullable<CardResponse["toast"]>["type"],
  content: string,
  en?: string,
) =>
  ({
    type: type,
    content,
    i18n: {
      zh_cn: content,
      en_us: en,
    },
  }) as CardResponse["toast"];

export const PlainText = (id: string, text: string) =>
  ({
    receive_id: id,
    msg_type: "text",
    content: JSON.stringify({
      text,
    }),
  }) as FeishuMessage;
