import { ApiError } from "../api/http";

export function isDisclaimerRequiredError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.problem?.code === "DISCLAIMER_REQUIRED";
}

