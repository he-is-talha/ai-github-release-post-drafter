import type { JobHandler, MemoryQueue, WebhookJob } from "./types.js";

/**
 * In-process fire-and-forget queue. Redis is for idempotency keys only —
 * not a job broker in Project 3.
 */
export function createMemoryQueue(handler: JobHandler): MemoryQueue {
  return {
    enqueue(job: WebhookJob): void {
      setImmediate(() => {
        Promise.resolve()
          .then(() => handler(job))
          .catch((err) => {
            console.error(
              JSON.stringify({
                level: "error",
                msg: "webhook job failed",
                deliveryId: job.deliveryId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          });
      });
    },
  };
}
