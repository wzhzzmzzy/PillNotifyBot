import { DataSource } from "../db/index.js";
import { FeishuClient } from "../feishu/index.js";

export function onProcessTerm({
  dataSource,
  feishuClient,
  server,
}: {
  dataSource: DataSource;
  server: Bun.Server<unknown>;
  feishuClient?: FeishuClient;
}) {
  function safeTerm() {
    dataSource.term();
    feishuClient?.close();
    server.stop();

    console.log("Bye~");
    process.exit();
  }

  process.on("SIGINT", () => {
    safeTerm();
  });

  process.on("SIGTERM", () => {
    safeTerm();
  });
}
