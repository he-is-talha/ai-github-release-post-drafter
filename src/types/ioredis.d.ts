declare module "ioredis" {
  export type RedisOptions = {
    maxRetriesPerRequest?: number | null;
    lazyConnect?: boolean;
  };

  export class Redis {
    constructor(path?: string, options?: RedisOptions);
    status: string;
    connect(): Promise<void>;
    set(
      key: string,
      value: string,
      expiryMode: "EX",
      seconds: number,
      setMode: "NX",
    ): Promise<"OK" | null>;
    quit(): Promise<"OK">;
  }
}
