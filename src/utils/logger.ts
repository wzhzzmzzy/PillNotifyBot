import pino from "pino";

export const logger = pino(
  {},
  pino.destination(
    import.meta.env.APP_ENV === "dev" ? "./logs" : "/var/log/pill",
  ),
);

// export const logger = {
//     info: console.log,
//     warn: console.warn,
//     error: console.error
// }