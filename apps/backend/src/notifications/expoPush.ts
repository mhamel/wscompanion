export type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

export type ExpoPushTicket =
  | { status: "ok"; id?: string }
  | { status: "error"; message?: string; details?: { error?: string } };

export type ExpoPushSendResult = {
  tickets: ExpoPushTicket[];
  invalidTokens: string[];
};

const DEFAULT_EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const MAX_MESSAGES_PER_REQUEST = 100;
const DEFAULT_TIMEOUT_MS = 10_000;

const PERMANENT_TOKEN_ERRORS = new Set(["DeviceNotRegistered", "InvalidPushToken"]);

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function isTicketError(ticket: ExpoPushTicket): ticket is Extract<ExpoPushTicket, { status: "error" }> {
  return ticket.status === "error";
}

export async function sendExpoPushMessages(input: {
  messages: ExpoPushMessage[];
  accessToken?: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
}): Promise<ExpoPushSendResult> {
  const messages = input.messages.filter((m) => typeof m.to === "string" && m.to.trim().length > 0);
  if (messages.length === 0) return { tickets: [], invalidTokens: [] };

  const fetchImpl = input.fetchImpl ?? fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available to send Expo push notifications");
  }

  const endpoint = input.endpoint ?? DEFAULT_EXPO_PUSH_ENDPOINT;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const allTickets: ExpoPushTicket[] = [];
  const invalidTokens = new Set<string>();

  for (const batch of chunk(messages, MAX_MESSAGES_PER_REQUEST)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (input.accessToken) {
        headers.Authorization = `Bearer ${input.accessToken}`;
      }

      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
        signal: controller.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `Expo push send failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`,
        );
      }

      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expo push send returned invalid JSON");
      }

      const obj = parsed as Record<string, unknown>;
      const data = obj.data;
      if (!Array.isArray(data)) {
        throw new Error("Expo push send response missing data");
      }

      const tickets = data as ExpoPushTicket[];
      allTickets.push(...tickets);

      for (let i = 0; i < tickets.length && i < batch.length; i += 1) {
        const ticket = tickets[i];
        if (!ticket) continue;
        if (!isTicketError(ticket)) continue;
        const errorCode = ticket.details?.error;
        if (errorCode && PERMANENT_TOKEN_ERRORS.has(errorCode)) {
          invalidTokens.add(batch[i]!.to);
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { tickets: allTickets, invalidTokens: Array.from(invalidTokens) };
}

