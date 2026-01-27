import crypto from "crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppConfig } from "../config";

export type S3ExportsClient = {
  client: S3Client;
  bucket: string;
};

export function createS3ExportsClient(config: AppConfig): S3ExportsClient | null {
  if (
    !config.S3_ENDPOINT ||
    !config.S3_REGION ||
    !config.S3_BUCKET ||
    !config.S3_ACCESS_KEY ||
    !config.S3_SECRET_KEY
  ) {
    return null;
  }

  const client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE ?? false,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });

  return { client, bucket: config.S3_BUCKET };
}

export async function uploadExportObject(input: {
  s3: S3ExportsClient;
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ storageKey: string; sizeBytes: bigint; sha256: Uint8Array<ArrayBuffer> }> {
  const digest = crypto.createHash("sha256").update(input.body).digest();
  const sha256 = new Uint8Array(new ArrayBuffer(digest.length));
  sha256.set(digest);

  await input.s3.client.send(
    new PutObjectCommand({
      Bucket: input.s3.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );

  return { storageKey: input.key, sizeBytes: BigInt(input.body.length), sha256 };
}

export async function signExportDownloadUrl(input: {
  s3: S3ExportsClient;
  key: string;
  expiresInSeconds: number;
}): Promise<string> {
  return getSignedUrl(
    input.s3.client,
    new GetObjectCommand({ Bucket: input.s3.bucket, Key: input.key }),
    { expiresIn: input.expiresInSeconds },
  );
}

export async function deleteExportObject(input: {
  s3: S3ExportsClient;
  key: string;
}): Promise<void> {
  await input.s3.client.send(new DeleteObjectCommand({ Bucket: input.s3.bucket, Key: input.key }));
}
