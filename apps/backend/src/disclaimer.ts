export const RISK_DISCLAIMER_VERSION = "2026-02-03";

export function getRiskDisclaimerText(): string {
  return [
    "Avertissement — pas de conseil financier.",
    "",
    "JUSTLOVETHESTOCKS fournit des informations, des agrégats et des visualisations basées sur tes données (via SnapTrade) et des sources publiques (news).",
    "Ce produit ne fournit pas de recommandations d’investissement et ne remplace pas un conseiller financier.",
    "",
    "Tu restes responsable de tes décisions d’investissement.",
  ].join("\n");
}
