import type { ErrorDto } from "./error.dto";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorDto };
