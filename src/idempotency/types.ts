export type ClaimResult = "claimed" | "duplicate";

export type IdempotencyStore = {
  tryClaim(deliveryId: string): Promise<ClaimResult>;
  close?: () => Promise<void>;
};

export const DELIVERY_KEY_PREFIX = "gh:delivery:";
/** 30 days */
export const DELIVERY_TTL_SECONDS = 30 * 24 * 60 * 60;

export function deliveryKey(deliveryId: string): string {
  return `${DELIVERY_KEY_PREFIX}${deliveryId}`;
}
