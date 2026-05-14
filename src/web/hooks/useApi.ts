import { useCallback, useMemo } from "react";
import { authFetch } from "./useAuth";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message = `HTTP ${status}`) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function useApi() {
  const request = useCallback(async function request<T>(
    input: RequestInfo | URL,
    init?: RequestInit,
  ) {
    const res = await authFetch(input, init);
    if (!res.ok) {
      throw new ApiError(res.status);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
  }, []);

  return useMemo(() => ({ request }), [request]);
}
