import {
  SpanKind,
  SpanStatusCode,
  context,
  propagation,
  trace,
  type Context,
} from "@opentelemetry/api";
import type { Job, JobsOptions, Queue } from "bullmq";

type TraceCarrier = Record<string, string>;

const TRACE_FIELD = "__otel";

function getJobTraceCarrier(data: unknown): TraceCarrier | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const carrier = (data as Record<string, unknown>)[TRACE_FIELD];
  if (!carrier || typeof carrier !== "object" || Array.isArray(carrier)) return null;

  const out: TraceCarrier = {};
  for (const [key, value] of Object.entries(carrier as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

function attachJobTraceCarrier<T extends Record<string, unknown>>(data: T): T {
  const carrier: TraceCarrier = {};
  propagation.inject(context.active(), carrier);
  return {
    ...(data as unknown as Record<string, unknown>),
    [TRACE_FIELD]: carrier,
  } as unknown as T;
}

export async function enqueueWithTrace<T extends Record<string, unknown>>(
  queue: Queue,
  name: string,
  data: T,
  opts?: JobsOptions,
) {
  const span = trace.getTracer("backend").startSpan("bullmq.enqueue", {
    kind: SpanKind.PRODUCER,
    attributes: {
      "messaging.system": "bullmq",
      "messaging.destination": queue.name,
      "messaging.operation": "enqueue",
      "bullmq.job.name": name,
    },
  });

  try {
    const tracedData = attachJobTraceCarrier(data);
    return await queue.add(name, tracedData, opts);
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
}

export async function withJobTracing<T>(job: Job, fn: (ctx: Context) => Promise<T>): Promise<T> {
  const carrier = getJobTraceCarrier(job.data);
  const parent = carrier ? propagation.extract(context.active(), carrier) : context.active();

  return await context.with(parent, async () => {
    const span = trace.getTracer("backend").startSpan(
      "bullmq.process",
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          "messaging.system": "bullmq",
          "messaging.destination": job.queueName,
          "messaging.operation": "process",
          "bullmq.job.name": job.name,
          "bullmq.job.id": job.id ? String(job.id) : "",
          "bullmq.job.attempt": job.attemptsMade,
        },
      },
      parent,
    );

    const ctxWithSpan = trace.setSpan(parent, span);
    try {
      const result = await context.with(ctxWithSpan, () => fn(ctxWithSpan));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
