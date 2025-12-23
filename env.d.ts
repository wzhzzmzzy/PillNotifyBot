// 扩展 Bun 的类型定义
declare module "bun" {
  interface Env {
    APP_ID: string;
    APP_SECRET: string;
    APP_ENV: 'dev' | 'prod';
    QUOTE_API_KEY?: string;
    QUOTE_DEVICE_ID?: string;
    DATABASE_URL: string;
  }


  // 确保 import.meta.env 也能获得同样的类型推导
  interface ImportMetaEnv extends Bun.Env { }

}
