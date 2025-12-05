import { DataSource } from "../db/index.js";
import { FeishuClient } from "../feishu/index.js";
import { MedicationScheduler } from "../feishu/scheduler.js";
import { logger } from "./logger.js";

export function onProcessTerm({
  dataSource,
  feishuClient,
  server,
  scheduler
}: {
  dataSource: DataSource;
  server: Bun.Server<unknown>;
  feishuClient?: FeishuClient;
  scheduler?: MedicationScheduler;
}) {
  function safeTerm() {
    dataSource.term();
    server.stop();
    feishuClient?.close();
    scheduler?.stopAll();

    logger.info("[Server] 清理完成，退出任务")
    process.exit();
  }

  process.on("SIGINT", () => {
    safeTerm();
  });

  process.on("SIGTERM", () => {
    safeTerm();
  });
}
