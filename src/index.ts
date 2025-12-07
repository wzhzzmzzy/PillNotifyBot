import { FeishuClient } from "./lib/feishu.js";
import { logger } from "./utils/logger.js";
import { onProcessTerm } from "./utils/process.js";

const feishu = new FeishuClient();

logger.info("Starting server on 0.0.0.0:12450");
const server = Bun.serve({
  port: 12450,
  hostname: "0.0.0.0",
  routes: {
    "/healthy": new Response("Ok"),
  },
});

onProcessTerm({
  server,
});
