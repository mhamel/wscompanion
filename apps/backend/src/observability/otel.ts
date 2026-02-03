import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

let sdk: NodeSDK | null = null;

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

function shouldEnableOtel(env: NodeJS.ProcessEnv): boolean {
  const sdkDisabled = parseBooleanEnv(env.OTEL_SDK_DISABLED);
  if (sdkDisabled === true) return false;

  const enabled = parseBooleanEnv(env.OTEL_ENABLED);
  if (enabled !== null) return enabled;

  return Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
}

function getOtelTraceEndpoint(env: NodeJS.ProcessEnv): string {
  const explicit = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (explicit) return explicit;

  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!base) return "http://localhost:4318/v1/traces";

  if (base.endsWith("/v1/traces")) return base;
  if (base.endsWith("/")) return `${base}v1/traces`;
  return `${base}/v1/traces`;
}

function setupDiagnostics(env: NodeJS.ProcessEnv) {
  const levelRaw = env.OTEL_DIAG_LOG_LEVEL?.trim().toUpperCase();
  const level =
    levelRaw === "ALL"
      ? DiagLogLevel.ALL
      : levelRaw === "DEBUG"
        ? DiagLogLevel.DEBUG
        : levelRaw === "INFO"
          ? DiagLogLevel.INFO
          : levelRaw === "WARN"
            ? DiagLogLevel.WARN
            : levelRaw === "ERROR"
              ? DiagLogLevel.ERROR
              : DiagLogLevel.NONE;

  if (level !== DiagLogLevel.NONE) {
    diag.setLogger(new DiagConsoleLogger(), level);
  }
}

export function initOtel(env: NodeJS.ProcessEnv = process.env) {
  if (sdk) return;
  if (!shouldEnableOtel(env)) return;

  setupDiagnostics(env);

  const serviceName = env.OTEL_SERVICE_NAME?.trim() || "justlovethestocks-backend";
  const serviceVersion = env.OTEL_SERVICE_VERSION?.trim() || undefined;
  const environment = env.NODE_ENV?.trim() || "development";

  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    ...(serviceVersion ? { [SEMRESATTRS_SERVICE_VERSION]: serviceVersion } : {}),
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  const traceExporter = new OTLPTraceExporter({ url: getOtelTraceEndpoint(env) });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      ...getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
      new PrismaInstrumentation(),
    ],
  });

  void sdk.start();
}

export async function shutdownOtel() {
  const current = sdk;
  sdk = null;
  if (!current) return;
  await current.shutdown();
}

// Preload pattern: importing this module is enough to enable OTel (if configured).
initOtel();
