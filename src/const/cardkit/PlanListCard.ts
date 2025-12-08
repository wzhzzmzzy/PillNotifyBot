const PLAN_LIST_CARD = {
  schema: "2.0",
  config: {
    update_multi: true,
    style: {
      text_size: {
        normal_v2: {
          default: "normal",
          pc: "normal",
          mobile: "heading",
        },
      },
    },
  },
  body: {
    direction: "vertical",
    elements: [
      {
        tag: "repeat",
        variable: "plan_list",
        elements: [
          {
            tag: "column_set",
            flex_mode: "stretch",
            horizontal_spacing: "12px",
            horizontal_align: "left",
            columns: [
              {
                tag: "column",
                width: "weighted",
                elements: [
                  {
                    tag: "markdown",
                    content:
                      "计划${plan_list.id}：${plan_list.name}，提醒时间${plan_list.time}，间隔${plan_list.interval}分钟",
                    text_align: "left",
                    text_size: "normal_v2",
                  },
                ],
                direction: "vertical",
                horizontal_spacing: "8px",
                vertical_spacing: "8px",
                horizontal_align: "center",
                vertical_align: "center",
                weight: 5,
              },
              {
                tag: "column",
                width: "weighted",
                elements: [
                  {
                    tag: "column_set",
                    flex_mode: "bisect",
                    horizontal_spacing: "8px",
                    horizontal_align: "right",
                    columns: [
                      {
                        tag: "column",
                        width: "auto",
                        elements: [
                          {
                            tag: "button",
                            text: {
                              tag: "plain_text",
                              content: "修改",
                            },
                            type: "default",
                            width: "default",
                            behaviors: [
                              {
                                type: "callback",
                                value: {
                                  event: "PlanList",
                                  action: "edit",
                                  name: "${plan_list.name}",
                                },
                              },
                            ],
                            margin: "4px 0px 4px 0px",
                          },
                        ],
                        vertical_spacing: "8px",
                        horizontal_align: "left",
                        vertical_align: "top",
                      },
                      {
                        tag: "column",
                        width: "auto",
                        elements: [
                          {
                            tag: "button",
                            text: {
                              tag: "plain_text",
                              content: "删除",
                            },
                            type: "danger",
                            width: "default",
                            behaviors: [
                              {
                                type: "callback",
                                value: {
                                  action: "delete",
                                  name: "${plan_list.name}",
                                  event: "PlanList",
                                },
                              },
                            ],
                            margin: "4px 0px 4px 0px",
                          },
                        ],
                        vertical_spacing: "8px",
                        horizontal_align: "left",
                        vertical_align: "top",
                      },
                    ],
                  },
                ],
                vertical_spacing: "8px",
                horizontal_align: "left",
                vertical_align: "top",
                weight: 2,
              },
            ],
            margin: "0px 0px 0px 0px",
          },
        ],
      },
    ],
  },
  header: {
    title: {
      tag: "plain_text",
      content: "计划列表",
    },
    subtitle: {
      tag: "plain_text",
      content: "",
    },
    template: "blue",
    padding: "12px 8px 12px 8px",
  },
};
