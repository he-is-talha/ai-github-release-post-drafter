export type LlmEnv = {
  llmProvider: string;
  ollamaHost: string;
  ollamaModel: string;
};

export type IdempotencyBackend = "memory" | "redis";

export type AppEnv = LlmEnv & {
  githubWebhookSecret: string;
  port: number;
  host: string;
  idempotencyBackend: IdempotencyBackend;
  redisUrl?: string;
};

/** String env map — avoids depending on the NodeJS namespace in callers/tests. */
export type EnvMap = Record<string, string | undefined>;

function readEnv(env: EnvMap, name: string, fallback: string): string {
  const value = env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

export function loadLlmEnv(env: EnvMap = process.env): LlmEnv {
  return {
    llmProvider: (env.LLM_PROVIDER ?? "ollama").toLowerCase(),
    ollamaHost: readEnv(env, "OLLAMA_HOST", "http://127.0.0.1:11434").replace(
      /\/$/,
      "",
    ),
    ollamaModel: readEnv(env, "OLLAMA_MODEL", "gemma3:4b"),
  };
}

export function loadAppEnv(env: EnvMap = process.env): AppEnv {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  if (secret === undefined || secret === "") {
    throw new Error("Missing required env var: GITHUB_WEBHOOK_SECRET");
  }

  const backendRaw = (env.IDEMPOTENCY_BACKEND ?? "memory").toLowerCase();
  if (backendRaw !== "memory" && backendRaw !== "redis") {
    throw new Error(
      `IDEMPOTENCY_BACKEND must be "memory" or "redis", got "${backendRaw}"`,
    );
  }

  const redisUrl = env.REDIS_URL;
  if (backendRaw === "redis" && (redisUrl === undefined || redisUrl === "")) {
    throw new Error("REDIS_URL is required when IDEMPOTENCY_BACKEND=redis");
  }

  return {
    ...loadLlmEnv(env),
    githubWebhookSecret: secret,
    port: Number(readEnv(env, "PORT", "3000")),
    host: readEnv(env, "HOST", "0.0.0.0"),
    idempotencyBackend: backendRaw,
    redisUrl: redisUrl || undefined,
  };
}
