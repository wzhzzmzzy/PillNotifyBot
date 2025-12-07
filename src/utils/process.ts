import { DataSource } from "../db/index.js";
import { logger } from "./logger.js";

export function onProcessTerm({
  dataSource,
  server,
}: {
  server: Bun.Server<unknown>;
  dataSource?: DataSource;
}) {
  function safeTerm() {
    server.stop();
    dataSource?.term();

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
