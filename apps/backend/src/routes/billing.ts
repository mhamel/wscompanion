import type { FastifyInstance, FastifyRequest } from "fastify";
import { getEntitlement } from "../entitlements";

async function billingEntitlementHandler(req: FastifyRequest) {
  const entitlement = await getEntitlement(req);
  return {
    plan: entitlement.plan,
    expiresAt: entitlement.expiresAt ? entitlement.expiresAt.toISOString() : undefined,
  };
}

export function registerBillingRoutes(app: FastifyInstance) {
  app.get("/billing/entitlement", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          properties: {
            plan: { type: "string", enum: ["free", "pro"] },
            expiresAt: { type: "string", format: "date-time" },
          },
          required: ["plan"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: billingEntitlementHandler,
  });
}
