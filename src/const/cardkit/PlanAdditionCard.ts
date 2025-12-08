const PLAN_ADDITION_CARD = {
  schema: "2.0",
  config: {
    update_multi: true,
  },
  body: {
    direction: "horizontal",
    horizontal_spacing: "8px",
    vertical_spacing: "8px",
    horizontal_align: "left",
    vertical_align: "top",
    elements: [
      {
        tag: "form",
        elements: [
          {
            tag: "input",
            placeholder: {
              tag: "plain_text",
              content: "计划名字",
            },
            default_value: "${rawName}",
            width: "200px",
            disabled: "${save}",
            required: true,
            name: "name",
          },
          {
            tag: "picker_time",
            placeholder: {
              tag: "plain_text",
              content: "",
            },
            width: "100px",
            disabled: "${save}",
            initial_time: "${rawTime}",
            required: true,
            name: "time",
          },
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "保存",
            },
            type: "primary_filled",
            width: "default",
            disabled: "${save}",
            disabled_tips: {
              tag: "plain_text",
              content: "已保存",
            },
            behaviors: [
              {
                type: "callback",
                value: {
                  event: "${event}",
                  name: "${rawName}",
                },
              },
            ],
            form_action_type: "submit",
            name: "submit_button",
            margin: "0px 0px 4px 0px",
          },
        ],
        direction: "horizontal",
        horizontal_spacing: "8px",
        vertical_spacing: "8px",
        horizontal_align: "left",
        vertical_align: "top",
        padding: "12px 12px 12px 12px",
        margin: "0px 0px 0px 0px",
        name: "form",
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
    padding: "12px 8px 12px 8px",
  },
};
