import * as Sentry from "@sentry/node";

export type SentryCaptureContext = {
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
  user?: Sentry.User;
};

let sentryEnabled = false;

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function rewriteFilename(filename: string): string {
  const normalizedFilename = normalizePath(filename);
  const normalizedCwd = normalizePath(process.cwd());

  if (!normalizedFilename.startsWith(normalizedCwd)) return normalizedFilename;

  const relative = normalizedFilename.slice(normalizedCwd.length).replace(/^\/+/, "");
  return `app:///${relative}`;
}

function rewriteEventStacktraces(event: Sentry.Event): Sentry.Event {
  const exceptions = event.exception?.values ?? [];
  for (const exception of exceptions) {
    const frames = exception.stacktrace?.frames ?? [];
    for (const frame of frames) {
      if (!frame.filename) continue;
      frame.filename = rewriteFilename(frame.filename);
    }
  }

  return event;
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  if (sentryEnabled) return;

  const environment =
    process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development";
  const release = process.env.SENTRY_RELEASE?.trim() || process.env.GITHUB_SHA?.trim();
  const serverName = process.env.SENTRY_SERVER_NAME?.trim();

  Sentry.init({
    dsn,
    environment,
    release: release || undefined,
    serverName: serverName || undefined,
    beforeSend: (event) => rewriteEventStacktraces(event),
  });

  Sentry.setTag("service", "backend");
  sentryEnabled = true;
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export function captureException(error: unknown, context: SentryCaptureContext = {}): void {
  if (!sentryEnabled) return;

  Sentry.withScope((scope) => {
    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value);
      }
    }

    if (context.extras) {
      for (const [key, value] of Object.entries(context.extras)) {
        scope.setExtra(key, value);
      }
    }

    if (context.user) {
      scope.setUser(context.user);
    }

    Sentry.captureException(error);
  });
}

export async function closeSentry(timeoutMs = 2000): Promise<boolean> {
  if (!sentryEnabled) return false;
  return await Sentry.close(timeoutMs);
}
