import { describe, expect, it } from "vitest";
import { APP_NAME } from "../src/index.js";

describe("smoke", () => {
  it("exports APP_NAME", () => {
    expect(APP_NAME).toBe("ai-github-release-post-drafter");
  });
});
