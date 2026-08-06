import { z } from "zod";

export const DraftTierSchema = z.enum(["post-worthy", "changelog-only", "ignore"]);

export const PlatformSchema = z.enum(["linkedin", "x"]);

export const DraftSchema = z.object({
    hook: z.string().min(1).max(200),
    body: z.string().min(1),
    tags: z.array(z.string().min(1)).max(8),
    tier: DraftTierSchema,
    ruleId: z.string().min(1),
    platform: PlatformSchema
});

export type Draft = z.infer<typeof DraftSchema>;

export function parseDraft(input: unknown) {
    return DraftSchema.safeParse(input);
}

export function draftJsonSchema() {
    return z.toJSONSchema(DraftSchema);
}