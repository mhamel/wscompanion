export const EXPORT_TYPES = ["pnl_realized_by_ticker", "option_premiums_by_year", "user_data"] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const EXPORT_FORMATS = ["csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportStatus = "queued" | "running" | "succeeded" | "failed";

export function isExportType(input: string): input is ExportType {
  return (EXPORT_TYPES as readonly string[]).includes(input);
}

export function isExportFormat(input: string): input is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(input);
}
