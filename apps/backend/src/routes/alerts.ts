import type { FastifyInstance, FastifyRequest } from "fastify";
import { ALERT_TEMPLATES } from "../alerts/templates";

async function alertTemplatesHandler(_req: FastifyRequest) {
  return { items: ALERT_TEMPLATES };
}

export function registerAlertsRoutes(app: FastifyInstance) {
  app.get("/alerts/templates", {
    preHandler: app.authenticate,
    schema: {
      security: [{ bearerAuth: [] }],
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
                  type: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  requiresSymbol: { type: "boolean" },
                  defaultConfig: { type: "object", additionalProperties: true },
                },
                required: ["type", "title", "description", "requiresSymbol", "defaultConfig"],
              },
            },
          },
          required: ["items"],
        },
        401: { $ref: "ProblemDetails#" },
        500: { $ref: "ProblemDetails#" },
      },
    },
    handler: alertTemplatesHandler,
  });
}

