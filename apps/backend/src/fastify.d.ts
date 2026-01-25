import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { Queue } from "bullmq";
import type { RedisClientType } from "redis";

declare module "fastify" {
  interface FastifyInstance {
    prisma?: PrismaClient;
    redis?: RedisClientType;
    syncQueue?: Queue;
    analyticsQueue?: Queue;
    exportsQueue?: Queue;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; sid: string };
    user: { sub: string; sid: string };
  }
}
