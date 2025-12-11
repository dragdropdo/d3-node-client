/**
 * Custom error classes for D3 Client
 */

import { D3Error } from "./types";

export class D3ClientError extends Error implements D3Error {
  statusCode?: number;
  code?: number;
  details?: any;

  constructor(
    message: string,
    statusCode?: number,
    code?: number,
    details?: any
  ) {
    super(message);
    this.name = "D3ClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Capture stack trace if available (Node.js)
    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

export class D3APIError extends D3ClientError {
  constructor(
    message: string,
    statusCode: number,
    code?: number,
    details?: any
  ) {
    super(message, statusCode, code, details);
    this.name = "D3APIError";
  }
}

export class D3ValidationError extends D3ClientError {
  constructor(message: string, details?: any) {
    super(message, 400, undefined, details);
    this.name = "D3ValidationError";
  }
}

export class D3UploadError extends D3ClientError {
  constructor(message: string, details?: any) {
    super(message, undefined, undefined, details);
    this.name = "D3UploadError";
  }
}

export class D3TimeoutError extends D3ClientError {
  constructor(message: string = "Operation timed out") {
    super(message);
    this.name = "D3TimeoutError";
  }
}
