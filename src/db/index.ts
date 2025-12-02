import { Database } from "bun:sqlite";

const PillPlan = [{}];

export class DataSource {
  db: Database;

  constructor() {
    this.db = new Database("pill.sqlite", { create: true });
    this.db.run("PRAGMA journal_mode = WAL;");
  }

  term() {
    this.db.close();
  }
}
