import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Códigos estables que el cliente (Expo) puede usar para decidir qué hacer. */
export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "internal_error";

/** Forma única de error de la API v1. */
export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

export function errorBody(code: ApiErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function apiError(c: Context, status: ContentfulStatusCode, code: ApiErrorCode, message: string) {
  return c.json(errorBody(code, message), status);
}

/** Lanzable desde cualquier handler; `onError` la convierte en JSON uniforme. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  429: "rate_limited",
};

/** Para `app.onError`: nunca filtra stack ni mensajes internos en 500. */
export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) return apiError(c, err.status, err.code, err.message);
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return apiError(c, status, CODE_BY_STATUS[status] ?? "internal_error", err.message || "Error");
  }
  console.error("[granola/api] error no controlado", err);
  return apiError(c, 500, "internal_error", "Ocurrió un error inesperado");
}

export function handleNotFound(c: Context) {
  return apiError(c, 404, "not_found", "Ruta no encontrada");
}
