import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../errors";
import { parseLimit } from "../pagination";
import { convertMinorAmount, createEnvFxRateProvider } from "../analytics/fx";
import type { Prisma } from "@prisma/client";

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function absBigInt(v: bigint): bigint {
  return v < 0n ? -v : v;
}

function money(amountMinor: bigint, currency: string) {
  return { amountMinor: amountMinor.toString(), currency: normalizeCurrency(currency) };
}

async function getUserBaseCurrency(req: FastifyRequest): Promise<string> {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const prefs = await prisma.userPreferences.findUnique({ where: { userId: req.user.sub } });
  return normalizeCurrency(prefs?.baseCurrency ?? "USD");
}

async function createWheelAuditEvent(input: {
  prisma: {
    wheelAuditEvent: {
      create: (args: Prisma.WheelAuditEventCreateArgs) => PromiseLike<unknown>;
    };
  };
  userId: string;
  wheelCycleId: string;
  action: string;
  payload?: Prisma.InputJsonValue;
}) {
  await input.prisma.wheelAuditEvent.create({
    data: {
      userId: input.userId,
      wheelCycleId: input.wheelCycleId,
      action: input.action,
      payload: input.payload ?? undefined,
    },
  });
}

async function wheelDetectHandler(req: FastifyRequest) {
  const queue = req.server.analyticsQueue;
  if (!queue) {
    throw new AppError({
      code: "QUEUE_NOT_CONFIGURED",
      message: "Analytics queue is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { symbol?: unknown };
  const symbolRaw = typeof body.symbol === "string" ? body.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";

  if (body.symbol !== undefined && !symbol) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid symbol",
      statusCode: 400,
    });
  }

  const jobId = `wheel-detect:${req.user.sub}:${symbol || "all"}`;
  const job = await queue.add(
    "wheel-detect",
    { userId: req.user.sub, ...(symbol ? { symbol } : {}) },
    { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
  );

  return { ok: true, jobId: job.id ? String(job.id) : jobId };
}

async function wheelCyclesHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const query = req.query as { symbol?: unknown; status?: unknown; limit?: unknown };
  const symbolRaw = typeof query.symbol === "string" ? query.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (query.symbol !== undefined && !symbol) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid symbol", statusCode: 400 });
  }

  const statusRaw = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  const status = statusRaw === "open" || statusRaw === "closed" ? statusRaw : "";
  if (query.status !== undefined && !status) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid status", statusCode: 400 });
  }

  const limit = parseLimit(query.limit, { defaultValue: 50, max: 100 });

  const rows = await prisma.wheelCycle.findMany({
    where: {
      userId: req.user.sub,
      ...(symbol ? { symbol } : {}),
      ...(status ? { status } : {}),
    },
    include: { _count: { select: { legs: true } } },
    orderBy: { openedAt: "desc" },
    take: limit,
  });

  return {
    items: rows.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      status: c.status,
      openedAt: c.openedAt.toISOString(),
      closedAt: c.closedAt ? c.closedAt.toISOString() : undefined,
      baseCurrency: c.baseCurrency,
      netPnl: c.netPnlMinor !== null ? money(c.netPnlMinor, c.baseCurrency) : undefined,
      autoDetected: c.autoDetected,
      tags: c.tags ?? [],
      legCount: c._count.legs,
    })),
  };
}

async function wheelCycleByIdHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const cycle = await prisma.wheelCycle.findFirst({
    where: { id, userId: req.user.sub },
    include: {
      legs: {
        include: {
          transaction: { include: { instrument: true, optionContract: true } },
        },
        orderBy: { occurredAt: "asc" },
      },
    },
  });

  if (!cycle) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const fx = createEnvFxRateProvider();
  let optionPremiumsMinor = 0n;
  let stockCashflowMinor = 0n;

  for (const leg of cycle.legs) {
    const tx = leg.transaction;
    if (!tx || tx.grossAmountMinor === null) continue;

    const grossMinor = absBigInt(tx.grossAmountMinor);
    const currency = normalizeCurrency(
      tx.priceCurrency ??
        tx.instrument?.currency ??
        tx.optionContract?.currency ??
        cycle.baseCurrency,
    );

    const converted = convertMinorAmount({
      amountMinor: grossMinor,
      fromCurrency: currency,
      toCurrency: cycle.baseCurrency,
      asOf: tx.executedAt,
      fx,
    });
    if (!converted.ok) continue;

    if (leg.kind === "sold_put" || leg.kind === "sold_call") {
      optionPremiumsMinor += absBigInt(converted.amountMinor);
    } else if (leg.kind === "bought_put") {
      optionPremiumsMinor -= absBigInt(converted.amountMinor);
    } else if (leg.kind === "stock_buy") {
      stockCashflowMinor -= absBigInt(converted.amountMinor);
    } else if (leg.kind === "stock_sell") {
      stockCashflowMinor += absBigInt(converted.amountMinor);
    }
  }

  return {
    id: cycle.id,
    symbol: cycle.symbol,
    status: cycle.status,
    openedAt: cycle.openedAt.toISOString(),
    closedAt: cycle.closedAt ? cycle.closedAt.toISOString() : undefined,
    baseCurrency: cycle.baseCurrency,
    netPnl: cycle.netPnlMinor !== null ? money(cycle.netPnlMinor, cycle.baseCurrency) : undefined,
    autoDetected: cycle.autoDetected,
    tags: cycle.tags ?? [],
    notes: cycle.notes ?? undefined,
    aggregates: {
      optionPremiums: money(optionPremiumsMinor, cycle.baseCurrency),
      stockPnl:
        cycle.status === "closed" ? money(stockCashflowMinor, cycle.baseCurrency) : undefined,
    },
    legs: cycle.legs.map((leg) => ({
      id: leg.id,
      kind: leg.kind,
      occurredAt: leg.occurredAt.toISOString(),
      transactionId: leg.transactionId ?? undefined,
      linkedTransactionIds: leg.linkedTransactionIds ?? [],
      pnl: leg.pnlMinor !== null ? money(leg.pnlMinor, cycle.baseCurrency) : undefined,
    })),
  };
}

async function wheelCycleCreateHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as {
    symbol?: unknown;
    openedAt?: unknown;
    baseCurrency?: unknown;
    notes?: unknown;
    tags?: unknown;
  };

  const symbolRaw = typeof body.symbol === "string" ? body.symbol : "";
  const symbol = symbolRaw ? normalizeSymbol(symbolRaw) : "";
  if (!symbol) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "symbol is required",
      statusCode: 400,
    });
  }

  const openedAtRaw = typeof body.openedAt === "string" ? body.openedAt : "";
  const openedAt = openedAtRaw ? new Date(openedAtRaw) : new Date();
  if (openedAtRaw && !Number.isFinite(openedAt.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid openedAt", statusCode: 400 });
  }

  const baseCurrencyRaw = typeof body.baseCurrency === "string" ? body.baseCurrency : "";
  const baseCurrency = baseCurrencyRaw
    ? normalizeCurrency(baseCurrencyRaw)
    : await getUserBaseCurrency(req);

  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const tags =
    Array.isArray(body.tags) && body.tags.every((t) => typeof t === "string")
      ? (body.tags as string[]).map((t) => t.trim()).filter(Boolean)
      : [];

  const cycle = await prisma.wheelCycle.create({
    data: {
      userId: req.user.sub,
      symbol,
      status: "open",
      openedAt,
      baseCurrency,
      autoDetected: false,
      notes,
      tags,
    },
  });

  await createWheelAuditEvent({
    prisma,
    userId: req.user.sub,
    wheelCycleId: cycle.id,
    action: "cycle_create",
    payload: { symbol, openedAt: openedAt.toISOString(), baseCurrency, notes, tags },
  });

  return { ok: true, id: cycle.id };
}

async function wheelCyclePatchHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const body = req.body as { notes?: unknown; tags?: unknown };
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const tags =
    Array.isArray(body.tags) && body.tags.every((t) => typeof t === "string")
      ? (body.tags as string[]).map((t) => t.trim()).filter(Boolean)
      : undefined;

  if (body.notes === undefined && body.tags === undefined) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Nothing to update",
      statusCode: 400,
    });
  }

  const cycle = await prisma.wheelCycle.findFirst({ where: { id, userId: req.user.sub } });
  if (!cycle) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const updated = await prisma.wheelCycle.update({
    where: { id },
    data: {
      ...(body.notes !== undefined ? { notes } : {}),
      ...(tags !== undefined ? { tags } : {}),
      autoDetected: false,
    },
  });

  await createWheelAuditEvent({
    prisma,
    userId: req.user.sub,
    wheelCycleId: updated.id,
    action: "cycle_patch",
    payload: {
      before: { notes: cycle.notes ?? null, tags: cycle.tags },
      after: { notes: updated.notes ?? null, tags: updated.tags },
    },
  });

  return { ok: true };
}

async function wheelCycleCloseHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const body = req.body as { closedAt?: unknown };
  const closedAtRaw = typeof body.closedAt === "string" ? body.closedAt : "";
  const closedAt = closedAtRaw ? new Date(closedAtRaw) : new Date();
  if (closedAtRaw && !Number.isFinite(closedAt.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid closedAt", statusCode: 400 });
  }

  const cycle = await prisma.wheelCycle.findFirst({ where: { id, userId: req.user.sub } });
  if (!cycle) {
    throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
  }

  const updated = await prisma.wheelCycle.update({
    where: { id },
    data: { status: "closed", closedAt, autoDetected: false },
  });

  await createWheelAuditEvent({
    prisma,
    userId: req.user.sub,
    wheelCycleId: updated.id,
    action: "cycle_close",
    payload: { closedAt: closedAt.toISOString() },
  });

  return { ok: true };
}

async function wheelCyclesMergeHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const body = req.body as { intoCycleId?: unknown; fromCycleId?: unknown };
  const intoCycleId = typeof body.intoCycleId === "string" ? body.intoCycleId : "";
  const fromCycleId = typeof body.fromCycleId === "string" ? body.fromCycleId : "";

  if (!intoCycleId || !fromCycleId || intoCycleId === fromCycleId) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "intoCycleId and fromCycleId are required",
      statusCode: 400,
    });
  }

  const result = await prisma.$transaction(async (db) => {
    const [into, from] = await Promise.all([
      db.wheelCycle.findFirst({ where: { id: intoCycleId, userId: req.user.sub } }),
      db.wheelCycle.findFirst({ where: { id: fromCycleId, userId: req.user.sub } }),
    ]);

    if (!into || !from) {
      throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
    }
    if (into.symbol !== from.symbol) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Cycles must have the same symbol to merge",
        statusCode: 400,
      });
    }

    const moved = await db.wheelLeg.updateMany({
      where: { wheelCycleId: from.id },
      data: { wheelCycleId: into.id },
    });

    await db.wheelCycle.update({ where: { id: into.id }, data: { autoDetected: false } });
    await db.wheelCycle.delete({ where: { id: from.id } });

    await createWheelAuditEvent({
      prisma: db,
      userId: req.user.sub,
      wheelCycleId: into.id,
      action: "cycle_merge",
      payload: {
        fromCycleId: from.id,
        movedLegs: moved.count,
      },
    });

    return { intoId: into.id, movedLegs: moved.count };
  });

  return { ok: true, intoCycleId: result.intoId, movedLegs: result.movedLegs };
}

async function wheelCycleSplitHandler(req: FastifyRequest) {
  const prisma = req.server.prisma;
  if (!prisma) {
    throw new AppError({
      code: "PRISMA_NOT_CONFIGURED",
      message: "Database is not configured",
      statusCode: 500,
    });
  }

  const params = req.params as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid id", statusCode: 400 });
  }

  const body = req.body as {
    legIds?: unknown;
    notes?: unknown;
    tags?: unknown;
    openedAt?: unknown;
  };
  const legIds =
    Array.isArray(body.legIds) && body.legIds.every((l) => typeof l === "string")
      ? (body.legIds as string[]).map((l) => l.trim()).filter(Boolean)
      : [];

  if (legIds.length === 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "legIds is required",
      statusCode: 400,
    });
  }

  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const tags =
    Array.isArray(body.tags) && body.tags.every((t) => typeof t === "string")
      ? (body.tags as string[]).map((t) => t.trim()).filter(Boolean)
      : [];

  const openedAtRaw = typeof body.openedAt === "string" ? body.openedAt : "";
  const openedAtParsed = openedAtRaw ? new Date(openedAtRaw) : null;
  if (openedAtRaw && !Number.isFinite(openedAtParsed?.getTime())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid openedAt", statusCode: 400 });
  }

  const result = await prisma.$transaction(async (db) => {
    const source = await db.wheelCycle.findFirst({
      where: { id, userId: req.user.sub },
    });
    if (!source) {
      throw new AppError({ code: "NOT_FOUND", message: "Not found", statusCode: 404 });
    }

    const legs = await db.wheelLeg.findMany({
      where: { wheelCycleId: source.id, id: { in: legIds } },
      orderBy: { occurredAt: "asc" },
    });

    if (legs.length !== legIds.length) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Some legs were not found on this cycle",
        statusCode: 400,
      });
    }

    const openedAt = openedAtParsed ?? legs[0].occurredAt;

    const created = await db.wheelCycle.create({
      data: {
        userId: req.user.sub,
        symbol: source.symbol,
        status: "open",
        openedAt,
        baseCurrency: source.baseCurrency,
        autoDetected: false,
        notes,
        tags,
      },
    });

    await db.wheelLeg.updateMany({
      where: { id: { in: legIds } },
      data: { wheelCycleId: created.id },
    });

    await db.wheelCycle.update({ where: { id: source.id }, data: { autoDetected: false } });

    await createWheelAuditEvent({
      prisma: db,
      userId: req.user.sub,
      wheelCycleId: source.id,
      action: "cycle_split",
      payload: { newCycleId: created.id, legIds },
    });

    await createWheelAuditEvent({
      prisma: db,
      userId: req.user.sub,
      wheelCycleId: created.id,
      action: "cycle_split_created",
      payload: { fromCycleId: source.id, legIds },
    });

    return { sourceId: source.id, newId: created.id };
  });

  return { ok: true, fromCycleId: result.sourceId, newCycleId: result.newId };
}

export function registerWheelRoutes(app: FastifyInstance) {
  const wheelLegSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      kind: { type: "string" },
      occurredAt: { type: "string", format: "date-time" },
      transactionId: { type: "string" },
      linkedTransactionIds: { type: "array", items: { type: "string" } },
      pnl: { $ref: "Money#" },
    },
    required: ["id", "kind", "occurredAt", "linkedTransactionIds"],
  } as const;

  app.post("/wheel/detect", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            jobId: { type: "string" },
          },
          required: ["ok", "jobId"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelDetectHandler,
  });

  app.get("/wheel/cycles", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          status: { type: "string", enum: ["open", "closed"] },
          limit: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: "string" },
                  symbol: { type: "string" },
                  status: { type: "string" },
                  openedAt: { type: "string", format: "date-time" },
                  closedAt: { type: "string", format: "date-time" },
                  baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
                  netPnl: { $ref: "Money#" },
                  autoDetected: { type: "boolean" },
                  tags: { type: "array", items: { type: "string" } },
                  legCount: { type: "integer" },
                },
                required: [
                  "id",
                  "symbol",
                  "status",
                  "openedAt",
                  "baseCurrency",
                  "autoDetected",
                  "tags",
                  "legCount",
                ],
              },
            },
          },
          required: ["items"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCyclesHandler,
  });

  app.get("/wheel/cycles/:id", {
    preHandler: [app.authenticate, app.requirePro],
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
            id: { type: "string" },
            symbol: { type: "string" },
            status: { type: "string" },
            openedAt: { type: "string", format: "date-time" },
            closedAt: { type: "string", format: "date-time" },
            baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
            netPnl: { $ref: "Money#" },
            autoDetected: { type: "boolean" },
            tags: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
            aggregates: {
              type: "object",
              additionalProperties: false,
              properties: {
                optionPremiums: { $ref: "Money#" },
                stockPnl: { $ref: "Money#" },
              },
              required: ["optionPremiums"],
            },
            legs: { type: "array", items: wheelLegSchema },
          },
          required: [
            "id",
            "symbol",
            "status",
            "openedAt",
            "baseCurrency",
            "autoDetected",
            "tags",
            "aggregates",
            "legs",
          ],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCycleByIdHandler,
  });

  app.post("/wheel/cycles", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          openedAt: { type: "string", format: "date-time" },
          baseCurrency: { type: "string", pattern: "^[A-Z]{3}$" },
          notes: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["symbol"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" }, id: { type: "string" } },
          required: ["ok", "id"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCycleCreateHandler,
  });

  app.patch("/wheel/cycles/:id", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          notes: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCyclePatchHandler,
  });

  app.post("/wheel/cycles/:id/close", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: { closedAt: { type: "string", format: "date-time" } },
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCycleCloseHandler,
  });

  app.post("/wheel/cycles/merge", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          intoCycleId: { type: "string" },
          fromCycleId: { type: "string" },
        },
        required: ["intoCycleId", "fromCycleId"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            intoCycleId: { type: "string" },
            movedLegs: { type: "integer" },
          },
          required: ["ok", "intoCycleId", "movedLegs"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCyclesMergeHandler,
  });

  app.post("/wheel/cycles/:id/split", {
    preHandler: [app.authenticate, app.requirePro],
    schema: {
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          legIds: { type: "array", items: { type: "string" } },
          openedAt: { type: "string", format: "date-time" },
          notes: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["legIds"],
      },
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            fromCycleId: { type: "string" },
            newCycleId: { type: "string" },
          },
          required: ["ok", "fromCycleId", "newCycleId"],
        },
        400: { $ref: "ProblemDetails#" },
        401: { $ref: "ProblemDetails#" },
        403: { $ref: "ProblemDetails#" },
        404: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: wheelCycleSplitHandler,
  });
}
