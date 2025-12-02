import pino from "pino";

export const logger = pino(
  {
    levelComparison: (c, e) => {
      return c > e;
    },
  },
  pino.destination(
    import.meta.env.APP_ENV === "dev" ? "./logs" : "/var/log/pill",
  ),
);
