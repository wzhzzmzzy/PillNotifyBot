import pino from "pino";

export const logger = pino(
  {},
  pino.destination(
    import.meta.env.APP_ENV === "dev" ? "./logs" : "/var/log/pill",
  ),
);
