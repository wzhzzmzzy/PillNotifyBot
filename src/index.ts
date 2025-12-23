import { FeishuClient } from "./lib/feishu.js";
import { updateText } from "./lib/quote.js";
import { logger } from "./utils/logger.js";
import { onProcessTerm } from "./utils/process.js";

const feishu = new FeishuClient();

logger.info("Starting server on 0.0.0.0:12450");
console.log(import.meta.env);
const server = Bun.serve({
  port: 12450,
  hostname: "0.0.0.0",
  routes: {
    "/healthy": new Response("Ok"),
    "/notify": () => {
      feishu.event?.cron.job.trigger();
      return new Response("Ok");
    },
    "/quote/updateText": async (options) => {
      const body = await options.json();
      const updateResult = await updateText(body);
      return Response.json(updateResult);
    },
  },
});

onProcessTerm({
  server,
  feishu,
});
