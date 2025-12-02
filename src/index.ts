import { DataSource } from "./db/index.js";
import { FeishuClient } from "./feishu/index.js";
import { onProcessTerm } from "./utils/process.js";

const dataSource = new DataSource();
const feishuClient = new FeishuClient({
  dataSource,
});

const server = Bun.serve({
  port: 12450,
  hostname: "0.0.0.0",
  routes: {
    "/healthy": new Response("Ok"),
  },
});

onProcessTerm({
  dataSource,
  feishuClient,
  server,
});
