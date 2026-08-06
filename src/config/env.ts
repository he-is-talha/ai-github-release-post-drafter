export type LlmEnv = {
  llmProvider: string;
  ollamaHost: string;
  ollamaModel: string;
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
