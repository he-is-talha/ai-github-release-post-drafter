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
  githubToken?: string;
  /** When true and token present, open a draft PR after writing the file. */
  openPr: boolean;
  /** owner/name — used when opening a PR if payload repo is unavailable. */
  githubRepo?: string;
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

function readBool(env: EnvMap, name: string, fallback: boolean): boolean {
  const value = env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
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

  const githubToken = env.GITHUB_TOKEN;
  const githubRepo = env.GITHUB_REPO;
  return {
    ...loadLlmEnv(env),
    githubWebhookSecret: secret,
    port: Number(readEnv(env, "PORT", "3000")),
    host: readEnv(env, "HOST", "0.0.0.0"),
    idempotencyBackend: backendRaw,
    redisUrl: redisUrl || undefined,
    githubToken:
      githubToken === undefined || githubToken === ""
        ? undefined
        : githubToken,
    openPr: readBool(env, "OPEN_PR", false),
    githubRepo:
      githubRepo === undefined || githubRepo === "" ? undefined : githubRepo,
  };
}
