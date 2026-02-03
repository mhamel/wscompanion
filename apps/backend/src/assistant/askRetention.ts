export function getAskRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.ASK_RETENTION_DAYS?.trim();
  if (!raw) return 180;

  const n = Number(raw);
  if (!Number.isFinite(n)) return 180;

  const days = Math.trunc(n);
  return days < 0 ? 0 : days;
}

export function computeAskRetentionCutoff(now: Date, retentionDays: number): Date | null {
  const days = Number.isFinite(retentionDays) ? Math.trunc(retentionDays) : 0;
  if (days <= 0) return null;

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
