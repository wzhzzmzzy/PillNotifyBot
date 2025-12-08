import { FeishuClient } from "../lib/feishu.js";
import { logger } from "./logger.js";

export function onProcessTerm({
  server,
  feishu,
}: {
  server: Bun.Server<unknown>;
  feishu: FeishuClient;
}) {
  function safeTerm() {
    server.stop();
    feishu.stop();

    logger.info("[Server] 清理完成，退出任务");
    process.exit();
  }

  process.on("SIGINT", () => {
    safeTerm();
  });

  process.on("SIGTERM", () => {
    safeTerm();
  });
}
