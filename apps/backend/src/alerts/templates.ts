export type AlertTemplate = {
  type: string;
  title: string;
  description: string;
  requiresSymbol: boolean;
  defaultConfig: Record<string, unknown>;
};

export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    type: "earnings",
    title: "Earnings",
    description: "Alerte avant la prochaine publication de résultats (MVP: template seulement).",
    requiresSymbol: true,
    defaultConfig: { daysBefore: 3 },
  },
  {
    type: "expiry",
    title: "Expiration options",
    description: "Alerte avant une expiration importante (MVP: template seulement).",
    requiresSymbol: true,
    defaultConfig: { daysBefore: 2 },
  },
  {
    type: "price_move",
    title: "Mouvement de prix",
    description: "Alerte si le prix bouge au-delà d'un seuil (MVP: template seulement).",
    requiresSymbol: true,
    defaultConfig: { thresholdPct: 5, windowHours: 24, direction: "both" },
  },
  {
    type: "news_spike",
    title: "Spike de news",
    description: "Alerte si le volume d'articles dépasse un seuil (MVP: RSS/Atom).",
    requiresSymbol: true,
    defaultConfig: { lookbackHours: 12, minArticles: 5 },
  },
] as const;

export function getAlertTemplate(type: string): AlertTemplate | undefined {
  return ALERT_TEMPLATES.find((t) => t.type === type);
}
