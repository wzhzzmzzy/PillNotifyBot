import {
  CardContent,
  CardMessage,
  CardToast,
  PlainText,
} from "../../const/card.js";
import { MenuActions } from "../../const/menu.js";
import { DataSource } from "../../db/index.js";
import { CardResponse } from "../../types/CardState.js";
import {
  FeishuEvent,
  MenuEvent,
  MessageEvent,
  BotEvent,
  EventPayload,
  CardAction,
  CardEvent,
  CronEvent,
} from "../../types/Feishu.js";
import { logger } from "../../utils/logger.js";
import { FeishuClient } from "../feishu.js";
import { Scheduler } from "../scheduler.js";

type BotEventMap = {
  [K in BotEvent["key"]]: Extract<BotEvent, { key: K }>["value"];
};

type MenuEventMap = {
  [K in MenuEvent["key"]]: Extract<MenuEvent, { key: K }>["value"];
};

export class EventHandler {
  feishu: FeishuClient;
  db: DataSource;
  cron: Scheduler;

  constructor({ feishu }: { feishu: FeishuClient }) {
    this.feishu = feishu;
    this.db = new DataSource();
    this.cron = new Scheduler();

    this.cron.on(() => {
      this.handler({
        type: "Cron",
        key: "notify",
      });
    });
  }

  stop() {
    this.db.term();
  }

  cronHandler(event: CronEvent) {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const minuteOfDay = hour * 60 + minute;

    const plans = this.db.allActiveMedicationPlan();

    plans.forEach(({ owner, plan }) => {
      const planMinuteOfDayList = plan
        .map((i) => {
          const [hour, minute] = i.time.split(":");
          return {
            ...i,
            minuteOfDay: Number(hour) * 60 + Number(minute),
          };
        })
        .sort((a, b) => a.minuteOfDay - b.minuteOfDay);

      const hitTime: typeof planMinuteOfDayList = [];
      planMinuteOfDayList.forEach((i, j) => {
        let minuteOfDay = i.minuteOfDay;
        const loopTillFirst = j + 1 >= planMinuteOfDayList.length;
        while (
          minuteOfDay <
          (loopTillFirst
            ? planMinuteOfDayList[0].minuteOfDay + 24 * 60
            : planMinuteOfDayList[j + 1].minuteOfDay)
        ) {
          hitTime.push({
            ...i,
            minuteOfDay:
              minuteOfDay > 24 * 60 ? minuteOfDay - 24 * 60 : minuteOfDay,
          });
          minuteOfDay += i.interval;
        }
      });

      const hitPlan = hitTime.find((m) => m.minuteOfDay === minuteOfDay);
      if (!hitPlan) {
        logger.info("当前时间 %s, 无计划命中", minuteOfDay);
        return;
      }

      logger.info("定时任务命中用户 %s 计划 %o", owner, hitPlan);
      const completed = this.db
        .getTodayCompletedStages(owner)
        .some((i) => i?.name === hitPlan.name);
      if (completed) {
        logger.info("用户已服药，跳过计划 %o", hitPlan);
        return;
      }

      this.feishu.sendMessage(
        CardMessage(owner, "notify", {
          title: `${hitPlan.name}记得吃药哦～`,
          name: hitPlan.name,
        }),
      );
    });
  }

  handler(event: FeishuEvent): CardResponse | undefined {
    if (event.type === "Cron") {
      this.cronHandler(event);
      return;
    }
    if (event.type === "Menu") {
      if (!event.value.operator?.operator_id?.open_id) {
        logger.error("No OpenId");
        return;
      }

      const id = event.value.operator?.operator_id?.open_id;
      if (event.key === MenuActions.PlanAddition) {
        this.feishu.sendMessage(
          CardMessage(id, event.key, {
            time: "10:00",
          }),
        );
        return;
      }

      if (event.key === MenuActions.PlanList) {
        const planList = this.db.getActiveMedicationPlan(id);
        if (!planList?.length) {
          this.feishu.sendMessage(
            PlainText(id, "还没有配置计划，如需配置可以点击下方“添加计划”"),
          );
          return;
        }
        this.feishu.sendMessage(
          CardMessage(id, event.key, {
            plan_list: planList,
          }),
        );
        return;
      }

      if (event.key === MenuActions.TodayRecords) {
        const stages = this.db.getTodayCompletedStages(id);
        const planList = this.db.getActiveMedicationPlan(id);
        const todoList = planList
          ?.filter((i) => !stages.some((s) => s?.id === i.id))
          .map((i) => i.name)
          .join(",");
        const hasEaten = stages.map((i) => i?.name).join(",");
        let msg = hasEaten ? `今天吃了：${hasEaten}。\n` : "";
        if (todoList) msg += `还没有吃：${todoList}。`;
        if (!msg) msg = "还没有配置计划哦";
        this.feishu.sendMessage(PlainText(id, msg));
        return;
      }

      this.feishu.sendMessage(PlainText(id, "TODO"));
    }

    if (event.type === "Message") {
      const id = event.payload.sender.sender_id?.open_id;
      if (!id) {
        logger.error("No OpenId");
        return;
      }

      const planList = this.db.getActiveMedicationPlan(id) || [];
      const plan = planList.find(
        (i) => i.name === JSON.parse(event.payload.message.content).text,
      );
      if (plan) {
        this.feishu.sendMessage(
          CardMessage(id, "notify", {
            title: `${plan.name}记得吃药哦～`,
            name: plan.name,
          }),
        );
        return;
      }
      this.feishu.sendMessage(
        PlainText(id, "收到信息：" + event.payload.message.content),
      );
      return;
    }

    if (event.type === "Card") {
      const { operator, action } = event.payload;
      const id = operator.open_id;

      if (action.value?.event === MenuActions.PlanAddition) {
        const plan = this.db.getActiveMedicationPlan(id) ?? [];
        if (plan.some((i) => i.name === action.form_value?.name)) {
          return {
            toast: CardToast("warning", "存在重名的提醒计划"),
          };
        }
        plan.push({
          id: plan.length + 1,
          name: action.form_value?.name as string,
          time: (action.form_value?.time as string).split(" ")[0],
          interval: (action.form_value?.interval as number) || 60,
        });
        this.db.createOrUpdateMedicationPlan(id, plan);
        console.log("saved", id, plan);

        return {
          toast: CardToast("success", "保存成功"),
          card: CardContent(MenuActions.PlanAddition, {
            event: MenuActions.PlanAddition,
            save: true,
            // FIXME: 添加这两个参数之后，新增保存会出问题
            // name: action.form_value?.name,
            // time: action.form_value?.time,
          }),
        };
      }

      if (action.value?.event === MenuActions.PlanEdit) {
        const planList = this.db.getActiveMedicationPlan(id) ?? [];
        const planIndex = planList.findIndex(
          (i) => i.name === (action.value as any).name,
        );

        if (planIndex === -1) {
          return {
            toast: CardToast(
              "warning",
              `找不到计划 ${(action.value as any).name}`,
            ),
          };
        }

        const nameChanged =
          planList[planIndex].name !== action.form_value?.name;

        if (
          nameChanged &&
          planList.some((i) => i.name === action.form_value?.name)
        ) {
          return {
            toast: CardToast("warning", "存在重名的提醒计划"),
          };
        }

        planList[planIndex].name = action.form_value?.name as string;
        planList[planIndex].time = (action.form_value?.time as string).split(
          " ",
        )[0];
        this.db.createOrUpdateMedicationPlan(id, planList);

        return {
          toast: CardToast("success", "保存成功"),
          card: CardContent(MenuActions.PlanEdit, {
            event: MenuActions.PlanEdit,
            name: planList[planIndex].name,
            time: planList[planIndex].time,
            save: true,
          }),
        };
      }

      if (action.value?.event === MenuActions.PlanList) {
        const payload = action.value as unknown as {
          action: "delete" | "edit";
          name: string;
        };
        const planList = this.db.getActiveMedicationPlan(id) ?? [];
        const planIndex = planList.findIndex((i) => i.name === payload.name);

        if (planIndex === -1) {
          return {
            toast: CardToast("warning", `找不到这个阶段-${payload.name}`),
          };
        }

        if (payload.action === "edit") {
          this.feishu.sendMessage(
            CardMessage(id, MenuActions.PlanEdit, {
              event: MenuActions.PlanEdit,
              name: payload.name,
              time: planList[planIndex].time,
            }),
          );
          return {};
        }

        if (payload.action === "delete") {
          planList.splice(planIndex, 1);
          this.db.createOrUpdateMedicationPlan(id, planList);
          return {
            toast: CardToast("info", `已删除阶段-${payload.name}`),
            card: CardContent(MenuActions.PlanList, {
              plan_list: planList,
            }),
          };
        }

        return {
          toast: CardToast("info", "未知事件"),
        };
      }

      if (action.value?.event === MenuActions.NotifyDone) {
        const payload = action.value as unknown as {
          name: string;
        };
        const plans = this.db.getActiveMedicationPlan(id) || [];
        const today = this.db.getTodayCompletedStages(id);
        if (today.some((i) => i?.name === payload.name)) {
          return {
            toast: CardToast("info", "已经记录过这顿啦，不用再点了"),
            card: CardContent("notify", {
              title: `${payload.name}打卡记录完成，不需要重复记录～`,
              name: payload.name,
              finish: true,
            }),
          };
        }

        const stageId = plans.find((i) => i?.name === payload.name)?.id;
        if (!stageId) {
          return {
            toast: CardToast(
              "info",
              `奇怪，找不到${payload.name}的计划了，检查一下配置吧`,
            ),
          };
        }

        this.db.recordMedication(id, stageId);

        return {
          card: CardContent("notify", {
            title: `${payload.name}打卡记录完成，真不错～`,
            name: payload.name,
            finish: true,
          }),
        };
      }
    }
  }

  menu<K extends keyof MenuEventMap>(
    k: K,
    v: EventPayload<"application.bot.menu_v6">,
  ): MenuEvent {
    return {
      type: "Menu",
      key: k,
      value: v,
    } as MenuEvent;
  }

  bot<K extends keyof BotEventMap>(k: K, v: BotEventMap[K]): BotEvent {
    return {
      type: "Bot",
      key: k,
      value: v,
    } as BotEvent;
  }

  message(payload: MessageEvent["payload"]): MessageEvent {
    return {
      type: "Message",
      payload,
    };
  }

  card(payload: CardAction): CardEvent {
    return {
      type: "Card",
      payload,
    };
  }
}

export function event(type: FeishuEvent["type"]) {
  return {
    type,
  };
}
