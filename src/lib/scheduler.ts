import { Cron } from "croner";

export class Scheduler {
  job: Cron;
  cronJobs: Array<() => void> = [];

  constructor() {
    this.job = new Cron("0 * * * * *", () => {
      this.cronJobs.forEach((j) => j());
    });
  }

  on(job: () => void) {
    this.cronJobs.push(job);
  }

  off(job: () => void) {
    this.cronJobs.filter((i) => i !== job);
  }

  start() {
    this.job.resume();
  }

  stop() {
    this.job.stop();
  }
}

export function startScheduler() {
  return new Cron("* * * * * *", () => {});
}
