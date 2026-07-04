export class AdapterError extends Error {
  constructor(code, message, options = {}) {
    super(message || code);
    this.name = "AdapterError";
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}
