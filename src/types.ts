/**
 * Type definitions for D3 Business API Client
 */

export interface D3ClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL of the D3 API (e.g., 'https://api.d3.com') */
  baseURL?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
}

export interface UploadFileOptions {
  /** File path (absolute or relative) */
  file: string;
  /** Original file name */
  fileName: string;
  /** MIME type of the file */
  mimeType?: string;
  /** Number of parts for multipart upload (default: calculated automatically) */
  parts?: number;
  /** Optional progress callback */
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  /** Current part being uploaded (1-indexed) */
  currentPart: number;
  /** Total number of parts */
  totalParts: number;
  /** Bytes uploaded so far */
  bytesUploaded: number;
  /** Total file size in bytes */
  totalBytes: number;
  /** Upload percentage (0-100) */
  percentage: number;
}

export interface UploadResponse {
  /** File key for use in operations */
  fileKey: string;
  /** Presigned URLs for multipart upload */
  presignedUrls: string[];
}

export interface SupportedOperationOptions {
  /** File extension (e.g., 'pdf', 'jpg') */
  ext: string;
  /** Optional action to check (e.g., 'convert', 'compress') */
  action?: string;
  /** Optional parameters for validation (e.g., { convert_to: 'png' }) */
  parameters?: Record<string, any>;
}

export interface SupportedOperationResponse {
  /** Whether the operation is supported */
  supported: boolean;
  /** Normalized extension */
  ext: string;
  /** Action name (if provided) */
  action?: string;
  /** Available actions for this extension */
  availableActions?: string[];
  /** Action-specific parameters (e.g., available convert_to targets) */
  parameters?: Record<string, any>;
}

export interface OperationOptions {
  /** Action to perform: 'convert', 'compress', 'merge', 'zip', 'share', 'lock', 'unlock', 'reset_password' */
  action:
    | "convert"
    | "compress"
    | "merge"
    | "zip"
    | "create_zip"
    | "share"
    | "lock"
    | "unlock"
    | "reset_password";
  /** Array of file keys from upload */
  fileKeys: string[];
  /** Action-specific parameters */
  parameters?: OperationParameters;
  /** Optional user metadata */
  notes?: Record<string, string>;
}

export interface OperationParameters {
  /** For convert: target format (e.g., 'pdf', 'png') */
  convert_to?: string;
  /** For compress: compression level (e.g., 'recommended', 'high', 'low') */
  compression_value?: string;
  /** For lock/unlock/reset_password: password */
  password?: string;
  /** For reset_password: old password */
  old_password?: string;
  /** For reset_password: new password */
  new_password?: string;
}

export interface OperationResponse {
  /** Main task ID for tracking the operation */
  mainTaskId: string;
}

export interface StatusOptions {
  /** Main task ID */
  mainTaskId: string;
  /** Optional file task ID for specific file status */
  fileTaskId?: string;
}

export interface FileTaskStatus {
  /** File key */
  fileKey: string;
  /** Status: 'queued' | 'running' | 'completed' | 'failed' */
  status: "queued" | "running" | "completed" | "failed";
  /** Download link (when completed) */
  downloadLink?: string;
  /** Error code (when failed) */
  errorCode?: string;
  /** Error message (when failed) */
  errorMessage?: string;
}

export interface StatusResponse {
  /** Overall operation status */
  operationStatus: "queued" | "running" | "completed" | "failed";
  /** Array of file task statuses */
  filesData: FileTaskStatus[];
}

export interface PollStatusOptions extends StatusOptions {
  /** Polling interval in milliseconds (default: 2000) */
  interval?: number;
  /** Maximum polling duration in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Callback for each status update */
  onUpdate?: (status: StatusResponse) => void;
}

export interface D3Error extends Error {
  /** HTTP status code */
  statusCode?: number;
  /** Error code from API */
  code?: number;
  /** Error message */
  message: string;
  /** Additional error details */
  details?: any;
}
