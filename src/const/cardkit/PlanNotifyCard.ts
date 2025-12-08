const PLAN_NOTIFY_CARD = {
  schema: "2.0",
  config: {
    update_multi: true,
  },
  body: {
    direction: "vertical",
    padding: "12px 12px 12px 12px",
    elements: [
      {
        tag: "column_set",
        horizontal_align: "left",
        columns: [
          {
            tag: "column",
            width: "auto",
            elements: [
              {
                tag: "button",
                text: {
                  tag: "plain_text",
                  content: "吃好了点这里",
                },
                type: "primary_filled",
                width: "default",
                size: "medium",
                disabled: "${finish}",
                disabled_tips: {
                  tag: "plain_text",
                  content: "已经吃过药啦",
                },
                behaviors: [
                  {
                    type: "callback",
                    value: {
                      event: "NotifyDone",
                      name: "${name}",
                    },
                  },
                ],
              },
              {
                tag: "button",
                text: {
                  tag: "plain_text",
                  content: "忘了吃哪些药吗？",
                },
                type: "default",
                width: "default",
                size: "medium",
                disabled: true,
                disabled_tips: {
                  tag: "plain_text",
                  content: "暂时不支持",
                },
                behaviors: [
                  {
                    type: "callback",
                    value: {
                      action: "query",
                    },
                  },
                ],
              },
            ],
            direction: "horizontal",
            vertical_spacing: "8px",
            horizontal_align: "left",
            vertical_align: "top",
          },
        ],
      },
    ],
  },
  header: {
    title: {
      tag: "plain_text",
      content: "${title}",
    },
    subtitle: {
      tag: "plain_text",
      content: "",
    },
    template: "blue",
    padding: "12px 12px 12px 12px",
  },
};
