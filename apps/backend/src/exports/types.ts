export const EXPORT_TYPES = ["pnl_realized_by_ticker", "option_premiums_by_year"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export type ExportFormat = "csv";
export type ExportStatus = "queued" | "running" | "succeeded" | "failed";

export function isExportType(input: string): input is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(input);
}

