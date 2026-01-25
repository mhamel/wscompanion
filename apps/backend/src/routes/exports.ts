import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors";

const EXPORT_TYPES = ["pnl_realized_by_ticker", "option_premiums_by_year"] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

function isExportType(input: string): input is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(input);
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

export function registerExportsRoutes(app: FastifyInstance) {
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
}

