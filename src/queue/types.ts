export type WebhookJob = {
  deliveryId: string;
  eventName: string | undefined;
  payload: unknown;
};

export type JobHandler = (job: WebhookJob) => void | Promise<void>;

export type MemoryQueue = {
  enqueue(job: WebhookJob): void;
};
