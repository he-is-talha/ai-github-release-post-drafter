export type TierName = "post-worthy" | "changelog-only" | "ignore";

export type Counters = {
  duplicateDrops: number;
  tierCounts: Record<TierName, number>;
  draftSuccess: number;
  draftFailure: number;
};

export function createCounters(): Counters {
  return {
    duplicateDrops: 0,
    tierCounts: {
      "post-worthy": 0,
      "changelog-only": 0,
      ignore: 0,
    },
    draftSuccess: 0,
    draftFailure: 0,
  };
}

export function incrementDuplicateDrop(counters: Counters): void {
  counters.duplicateDrops += 1;
}

export function incrementTier(counters: Counters, tier: TierName): void {
  counters.tierCounts[tier] += 1;
}

export function incrementDraftSuccess(counters: Counters): void {
  counters.draftSuccess += 1;
}

export function incrementDraftFailure(counters: Counters): void {
  counters.draftFailure += 1;
}

export function snapshotCounters(counters: Counters): Counters {
  return {
    duplicateDrops: counters.duplicateDrops,
    tierCounts: { ...counters.tierCounts },
    draftSuccess: counters.draftSuccess,
    draftFailure: counters.draftFailure,
  };
}

export function logCounters(counters: Counters): void {
  console.log(
    JSON.stringify({
      msg: "metrics",
      ...snapshotCounters(counters),
    }),
  );
}
