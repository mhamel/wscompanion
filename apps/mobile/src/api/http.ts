import { ProblemDetails } from './types';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${safePath}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem?: ProblemDetails;

  constructor(input: { status: number; message: string; problem?: ProblemDetails }) {
    super(input.message);
    this.name = 'ApiError';
    this.status = input.status;
    this.problem = input.problem;
  }
}

export async function apiFetch<T>(input: {
  baseUrl: string;
  path: string;
  init?: RequestInit;
}): Promise<T> {
  const res = await fetch(joinUrl(input.baseUrl, input.path), {
    ...input.init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(input.init?.headers ?? {}),
    },
  });

  if (res.ok) {
    return (await res.json()) as T;
  }

  let problem: ProblemDetails | undefined;
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    // ignore
  }

  throw new ApiError({
    status: res.status,
    message: problem?.message ?? `Request failed with status ${res.status}`,
    problem,
  });
}

