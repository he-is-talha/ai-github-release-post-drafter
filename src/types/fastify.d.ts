/**
 * Local Fastify typings for the IDE when node_modules is not indexed.
 * CLI `tsc` still prefers the real `fastify` package when it resolves.
 */
declare module "fastify" {
  export type FastifyServerOptions = {
    logger?: boolean | object;
  };

  export interface FastifyRequest {
    headers: Record<string, string | string[] | undefined>;
    log: {
      info: (obj: object | string, msg?: string) => void;
    };
    rawBody?: Buffer;
  }

  export interface FastifyReply {
    code(statusCode: number): FastifyReply;
    send(payload?: unknown): unknown;
  }

  export type RouteHandler = (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => unknown | Promise<unknown>;

  export type FastifyPluginAsync<Options = Record<string, never>> = (
    instance: FastifyInstance,
    opts: Options,
  ) => void | Promise<void>;

  export type InjectOptions = {
    method: string;
    url: string;
    headers?: Record<string, string>;
    payload?: Buffer | string | object;
  };

  export type InjectResponse = {
    statusCode: number;
    json: () => unknown;
  };

  export interface FastifyInstance {
    post(path: string, handler: RouteHandler): FastifyInstance;
    register<Options>(
      plugin: FastifyPluginAsync<Options>,
      opts?: Options,
    ): PromiseLike<FastifyInstance>;
    addContentTypeParser(
      contentType: string,
      opts: { parseAs: "buffer" | "string" },
      parser: (
        request: FastifyRequest,
        body: Buffer | string,
        done: (err: Error | null, body?: unknown) => void,
      ) => void,
    ): void;
    inject(opts: InjectOptions): Promise<InjectResponse>;
    close(): Promise<void>;
    listen(opts: { port: number; host: string }): Promise<string>;
  }

  export default function fastify(
    opts?: FastifyServerOptions,
  ): FastifyInstance;
}
