import Koa from "koa";
import koaBody from "koa-body";
import { FeishuClient } from "./feishu/index.js";

const server = new Koa();
server.use(koaBody());

const feishuClient = new FeishuClient();

server.use(feishuClient.routes());

server.listen(12450, "0.0.0.0");
