import { DataSource } from "../db/index.js";
import { FeishuClient } from "../feishu/index.js";

export function onProcessTerm({
  dataSource,
  feishuClient,
  server,
}: {
  dataSource: DataSource;
  feishuClient: FeishuClient;
  server: Bun.Server<unknown>;
}) {
  function safeTerm() {
    dataSource.term();
    feishuClient.close();
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
