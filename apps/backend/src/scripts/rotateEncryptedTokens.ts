import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  decryptStringFromBytes,
  encryptStringToBytes,
  getActiveEncryptionKeyId,
  parseEncryptedPayloadHeader,
} from "../crypto";

type Options = {
  apply: boolean;
  batchSize: number;
  provider?: string;
  userId?: string;
};

function parseOptions(argv: string[]): Options {
  const apply = argv.includes("--apply");

  const batchSizeRaw = argv.find((a) => a.startsWith("--batchSize="))?.split("=", 2)[1];
  const batchSize = batchSizeRaw ? Number(batchSizeRaw) : 200;

  const provider = argv.find((a) => a.startsWith("--provider="))?.split("=", 2)[1];
  const userId = argv.find((a) => a.startsWith("--userId="))?.split("=", 2)[1];

  return {
    apply,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 200,
    provider: provider?.trim() ? provider.trim() : undefined,
    userId: userId?.trim() ? userId.trim() : undefined,
  };
}

function needsRotation(payload: Uint8Array, activeKeyId: number): boolean {
  const header = parseEncryptedPayloadHeader(payload);
  return header.keyId !== activeKeyId;
}

async function main() {
  const opts = parseOptions(process.argv.slice(2));

  const prisma = new PrismaClient();
  const activeKeyId = getActiveEncryptionKeyId();

  let scanned = 0;
  let connectionsWithEncryptedTokens = 0;
  let connectionsNeedingRotation = 0;
  let fieldsRotated = 0;

  const where = {
    ...(opts.provider ? { provider: opts.provider } : null),
    ...(opts.userId ? { userId: opts.userId } : null),
    OR: [{ accessTokenEnc: { not: null } }, { refreshTokenEnc: { not: null } }],
  };

  try {
    console.log(
      JSON.stringify(
        {
          action: "rotate_encrypted_tokens",
          mode: opts.apply ? "apply" : "dry_run",
          activeKeyId,
          batchSize: opts.batchSize,
          filter: { provider: opts.provider ?? null, userId: opts.userId ?? null },
        },
        null,
        2,
      ),
    );

    let cursor: { id: string } | undefined;
    while (true) {
      const rows = await prisma.brokerConnection.findMany({
        where,
        select: {
          id: true,
          provider: true,
          userId: true,
          accessTokenEnc: true,
          refreshTokenEnc: true,
          updatedAt: true,
        },
        take: opts.batchSize,
        orderBy: { id: "asc" },
        ...(cursor ? { cursor, skip: 1 } : null),
      });

      if (rows.length === 0) break;
      cursor = { id: rows[rows.length - 1].id };

      for (const row of rows) {
        scanned++;

        const accessEnc = row.accessTokenEnc ?? null;
        const refreshEnc = row.refreshTokenEnc ?? null;
        if (!accessEnc && !refreshEnc) continue;
        connectionsWithEncryptedTokens++;

        const data: {
          accessTokenEnc?: Uint8Array<ArrayBuffer> | null;
          refreshTokenEnc?: Uint8Array<ArrayBuffer> | null;
        } = {};
        let rowNeedsRotation = false;

        if (accessEnc) {
          try {
            if (needsRotation(accessEnc, activeKeyId)) {
              const plaintext = decryptStringFromBytes(accessEnc);
              data.accessTokenEnc = encryptStringToBytes(plaintext);
              fieldsRotated++;
              rowNeedsRotation = true;
            }
          } catch (err) {
            console.error(
              JSON.stringify(
                {
                  level: "error",
                  msg: "failed_to_rotate_access_token",
                  brokerConnectionId: row.id,
                  provider: row.provider,
                  userId: row.userId,
                  updatedAt: row.updatedAt.toISOString(),
                  err: err instanceof Error ? err.message : String(err),
                },
                null,
                2,
              ),
            );
          }
        }

        if (refreshEnc) {
          try {
            if (needsRotation(refreshEnc, activeKeyId)) {
              const plaintext = decryptStringFromBytes(refreshEnc);
              data.refreshTokenEnc = encryptStringToBytes(plaintext);
              fieldsRotated++;
              rowNeedsRotation = true;
            }
          } catch (err) {
            console.error(
              JSON.stringify(
                {
                  level: "error",
                  msg: "failed_to_rotate_refresh_token",
                  brokerConnectionId: row.id,
                  provider: row.provider,
                  userId: row.userId,
                  updatedAt: row.updatedAt.toISOString(),
                  err: err instanceof Error ? err.message : String(err),
                },
                null,
                2,
              ),
            );
          }
        }

        if (!rowNeedsRotation) continue;
        connectionsNeedingRotation++;

        if (!opts.apply) continue;

        await prisma.brokerConnection.update({
          where: { id: row.id },
          data,
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: opts.apply ? "apply" : "dry_run",
          activeKeyId,
          scanned,
          connectionsWithEncryptedTokens,
          connectionsNeedingRotation,
          fieldsRotated,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
