import type React from 'react';
import * as Sentry from 'sentry-expo';
import { config } from '../config';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  initialized = true;

  const dsn = config.sentryDsn?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: config.appEnv,
  });
}

export function wrapApp<TProps>(
  AppComponent: React.ComponentType<TProps>,
): React.ComponentType<TProps> {
  const dsn = config.sentryDsn?.trim();
  if (!dsn) return AppComponent;
  return Sentry.Native.wrap(AppComponent);
}

export { Sentry };

