export type LlmEnv = {
  llmProvider: string;
  ollamaHost: string;
  ollamaModel: string;
};

export type AppEnv = LlmEnv & {
  githubWebhookSecret: string;
  port: number;
  host: string;
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
  return {
    ...loadLlmEnv(env),
    githubWebhookSecret: secret,
    port: Number(readEnv(env, "PORT", "3000")),
    host: readEnv(env, "HOST", "0.0.0.0"),
  };
}
