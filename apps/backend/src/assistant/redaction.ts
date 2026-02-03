export function redactUserText(input: string): string {
  let text = input;

  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]");

  // Naive phone-ish redaction (keeps false positives low by requiring length).
  text = text.replace(/\b\+?\d[\d\s().-]{7,}\d\b/g, "[redacted-phone]");

  // Long token-ish sequences (API keys, JWT-ish, base64-ish)
  text = text.replace(/\b[A-Za-z0-9/_+=-]{32,}\b/g, "[redacted-token]");

  // Prevent unbounded storage.
  const maxLen = 1_000;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen) + "…";
  }

  return text;
}
