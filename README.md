## 吃药提醒飞书机器人

定时给用户发送飞书消息，提醒吃药

### Requirements

本地运行环境变量（`.env.local`）

- `APP_ID`: 飞书机器人 ID
- `APP_SECRET`: 飞书机器人密钥
- `APP_ENV`: 值为 dev 时，日志文件输出到当前目录下
- `DATABASE_URL`: Drizzle Sqlite 文件位置

使用 Bun >= 1.3 运行，所有数据存储在本地 SQLite

需要的卡片配置参考 `src/const/cardkit` 目录下的卡片 JSON

### Usage

```
bun run src/index.ts
```

### TODO

- [ ] 支持通过卡片修改提醒间隔
- [ ] 支持 Drizzle ORM
- [ ] 区分开发、生产环境 DB 位置
