import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors";
import { EXPORT_TYPES, isExportType } from "../exports/types";
import { signExportDownloadUrl } from "../exports/s3";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";

type ExportJobsCursor = { createdAt: string; id: string };

async function exportsListHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as { cursor?: unknown; limit?: unknown };
  const limit = parseLimit(query.limit, { defaultValue: 20, max: 50 });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : "";
  const cursor = cursorRaw ? decodeCursor<ExportJobsCursor>(cursorRaw) : null;
  if (cursorRaw && (!cursor || typeof cursor.createdAt !== "string" || typeof cursor.id !== "string")) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const createdAtCursor = cursor ? new Date(cursor.createdAt) : null;
  if (cursor && !Number.isFinite(createdAtCursor?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid cursor", statusCode: 400 });
  }

  const rows = await prisma.exportJob.findMany({
    where: {
      userId: req.user.sub,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: createdAtCursor! } },
              { createdAt: createdAtCursor!, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: { file: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;

  return {
    items: page.map((j) => ({
      id: j.id,
      type: j.type,
      format: j.format,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt ? j.completedAt.toISOString() : undefined,
      error: j.error ?? undefined,
      file: j.file
        ? {
            fileName: j.file.storageKey.split("/").pop() ?? j.file.storageKey,
            contentType: j.file.contentType,
            sizeBytes: j.file.sizeBytes.toString(),
          }
        : undefined,
    })),
    nextCursor: next ? encodeCursor({ createdAt: next.createdAt.toISOString(), id: next.id }) : undefined,
  };
}

async function exportCreateHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const exportsQueue = req.server.exportsQueue;
  if (!exportsQueue) {
    throw new AppError({
      code: "QUEUE_NOT_CONFIGURED",
      message: "Exports queue is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { type?: unknown; format?: unknown; params?: unknown };

  const typeRaw = typeof body.type === "string" ? body.type.trim() : "";
  if (!typeRaw || !isExportType(typeRaw)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid export type", statusCode: 400 });
  }

  const format = typeof body.format === "string" ? body.format.trim() : "";
  if (!format || format !== "csv") {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid export format", statusCode: 400 });
  }

  const params =
    body.params === undefined
      ? ({} as Prisma.InputJsonValue)
      : body.params && typeof body.params === "object" && !Array.isArray(body.params)
        ? (body.params as Prisma.InputJsonValue)
        : undefined;

  if (!params) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid params", statusCode: 400 });
  }

  const created = await prisma.exportJob.create({
    data: {
      userId: req.user.sub,
      type: typeRaw,
      format,
      params,
      status: "queued",
    },
  });

  try {
    await exportsQueue.add(
      "export-run",
      { exportJobId: created.id },
      { jobId: created.id, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
    );
  } catch {
    await prisma.exportJob.update({
      where: { id: created.id },
      data: { status: "failed", completedAt: new Date(), error: "ENQUEUE_FAILED" },
    });

    throw new AppError({
      code: "ENQUEUE_FAILED",
      message: "Failed to enqueue export job",
      statusCode: 500,
    });
  }

  return { exportJobId: created.id, status: created.status };
}

async function exportDownloadHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const s3 = req.server.s3Exports;
  if (!s3) {
    throw new AppError({
      code: "S3_NOT_CONFIGURED",
      message: "S3 is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const job = await prisma.exportJob.findFirst({
    where: { id, userId: req.user.sub },
    include: { file: true },
  });
  if (!job) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  if (job.status !== "succeeded" || !job.file) {
    throw new AppError({ code: "EXPORT_NOT_READY", message: "Export not ready", statusCode: 409 });
  }

  const expiresInSeconds = 600;
  const url = await signExportDownloadUrl({ s3, key: job.file.storageKey, expiresInSeconds });

  return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}

export function registerExportsRoutes(app: FastifyInstance) {
  const exportJobSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      type: { type: "string" },
      format: { type: "string" },
      status: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      completedAt: { type: "string", format: "date-time" },
      error: { type: "string" },
      file: {
        type: "object",
        additionalProperties: false,
        properties: {
          fileName: { type: "string" },
          contentType: { type: "string" },
          sizeBytes: { type: "string" },
        },
        required: ["fileName", "contentType", "sizeBytes"],
      },
    },
    required: ["id", "type", "format", "status", "createdAt"],
  } as const;

  app.get("/exports", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          cursor: { $ref: "PaginationCursor#" },
          limit: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: { type: "array", items: exportJobSchema },
            nextCursor: { $ref: "PaginationCursor#" },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: exportsListHandler,
  });

  app.post("/exports", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: [...EXPORT_TYPES] },
          format: { type: "string", enum: ["csv"] },
          params: { type: "object" },
        },
        required: ["type", "format"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            exportJobId: { type: "string" },
            status: { type: "string" },
          },
          required: ["exportJobId", "status"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: exportCreateHandler,
  });

  app.get("/exports/:id/download", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            url: { type: "string" },
            expiresAt: { type: "string", format: "date-time" },
          },
          required: ["url", "expiresAt"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        409: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: exportDownloadHandler,
  });
}
