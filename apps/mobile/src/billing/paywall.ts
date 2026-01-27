import { ApiError } from '../api/http';

export function isPaywallError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.problem?.code === 'PAYWALL';
}

