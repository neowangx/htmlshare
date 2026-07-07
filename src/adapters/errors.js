import { AppError } from "../lib/errors.js";

export class AdapterError extends AppError {
  constructor(code, message, options = {}) {
    super(code, message, { ...options, name: "AdapterError" });
  }
}
