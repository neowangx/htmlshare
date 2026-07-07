// Core error type shared across layers. Lives in lib/ so core modules (templates, styles,
// compose) don't have to reach up into the adapters layer for it (D3 layering).
export class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message || code);
    this.name = options.name || "AppError";
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}
