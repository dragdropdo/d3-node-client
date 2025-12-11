/**
 * D3 Business API Client
 *
 * A Node.js client library for interacting with the D3 Business API.
 * Provides methods for file uploads, operations, and status checking.
 */

// Type declarations for Node.js globals
declare const Buffer:
  | {
      isBuffer(obj: any): boolean;
    }
  | undefined;

// Import statements - these will resolve when dependencies are installed
// @ts-ignore - Module resolution will work at runtime with installed dependencies
import axios, { AxiosInstance } from "axios";
// @ts-ignore
import * as fs from "fs";
// @ts-ignore
import * as path from "path";
import {
  D3ClientConfig,
  UploadFileOptions,
  UploadResponse,
  SupportedOperationOptions,
  SupportedOperationResponse,
  OperationOptions,
  OperationResponse,
  StatusOptions,
  StatusResponse,
  PollStatusOptions,
  FileTaskStatus,
} from "./types";
import {
  D3ClientError,
  D3APIError,
  D3ValidationError,
  D3UploadError,
  D3TimeoutError,
} from "./errors";

export class D3Client {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;
  private axiosInstance: AxiosInstance;

  /**
   * Create a new D3 Client instance
   *
   * @param config - Client configuration
   * @example
   * ```typescript
   * const client = new D3Client({
   *   apiKey: 'your-api-key',
   *   baseURL: 'https://api.d3.com',
   *   timeout: 30000
   * });
   * ```
   */
  constructor(config: D3ClientConfig) {
    if (!config.apiKey) {
      throw new D3ValidationError("API key is required");
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || "https://api.d3.com";
    this.timeout = config.timeout || 30000;

    // Remove trailing slash from baseURL
    this.baseURL = this.baseURL.replace(/\/$/, "");

    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...config.headers,
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        if (error.response) {
          const { status, data } = error.response;
          const message =
            data?.message ||
            data?.error ||
            error.message ||
            "API request failed";
          const code = data?.code;
          throw new D3APIError(message, status, code, data);
        } else if (error.request) {
          throw new D3ClientError(
            "Network error: No response received from server"
          );
        } else {
          throw new D3ClientError(`Request error: ${error.message}`);
        }
      }
    );
  }

  /**
   * Upload a file to D3 storage
   *
   * This method handles the complete upload flow:
   * 1. Request presigned URLs from the API
   * 2. Upload file parts to presigned URLs
   * 3. Return the file key for use in operations
   *
   * @param options - Upload options
   * @returns Promise resolving to upload response with file key
   *
   * @example
   * ```typescript
   * // Upload from file path
   * const result = await client.uploadFile({
   *   file: '/path/to/file.pdf',
   *   fileName: 'document.pdf',
   *   mimeType: 'application/pdf',
   *   onProgress: (progress) => {
   *     console.log(`Upload: ${progress.percentage}%`);
   *   }
   * });
   * console.log('File key:', result.fileKey);
   *
   * // Upload from Buffer
   * const buffer = fs.readFileSync('/path/to/file.pdf');
   * const result = await client.uploadFile({
   *   file: buffer,
   *   fileName: 'document.pdf',
   *   mimeType: 'application/pdf'
   * });
   * ```
   */
  async uploadFile(options: UploadFileOptions): Promise<UploadResponse> {
    const { file, fileName, mimeType, parts, onProgress } = options;

    if (!fileName) {
      throw new D3ValidationError("fileName is required");
    }

    // Determine file size
    let fileSize: number;

    if (typeof file === "string") {
      // File path
      if (!fs.existsSync(file)) {
        throw new D3ValidationError(`File not found: ${file}`);
      }
      const stats = fs.statSync(file);
      fileSize = stats.size;
    } else if (
      typeof Buffer !== "undefined" &&
      Buffer.isBuffer &&
      Buffer.isBuffer(file)
    ) {
      // Buffer
      fileSize = (file as any).length;
    } else {
      // Streams not directly supported - need to buffer first
      throw new D3ValidationError(
        "Stream uploads are not supported. Please use file path or Buffer."
      );
    }

    // Calculate parts if not provided
    const chunkSize = 5 * 1024 * 1024; // 5MB per part
    const calculatedParts = parts || Math.ceil(fileSize / chunkSize);
    const actualParts = Math.max(1, Math.min(calculatedParts, 100)); // Limit to 100 parts

    // Detect MIME type if not provided
    let detectedMimeType = mimeType;
    if (!detectedMimeType) {
      const ext = path.extname(fileName).toLowerCase();
      detectedMimeType = this.getMimeType(ext) || "application/octet-stream";
    }

    try {
      // Step 1: Request presigned URLs
      const uploadResponse = await this.axiosInstance.post<{
        data: UploadResponse;
      }>("/v1/external/upload", {
        file_name: fileName,
        size: fileSize,
        mime_type: detectedMimeType,
        parts: actualParts,
      });

      const { fileKey, presignedUrls } = uploadResponse.data.data;

      if (presignedUrls.length !== actualParts) {
        throw new D3UploadError(
          `Mismatch: requested ${actualParts} parts but received ${presignedUrls.length} presigned URLs`
        );
      }

      // Step 2: Upload file parts
      const chunkSizePerPart = Math.ceil(fileSize / actualParts);
      let bytesUploaded = 0;

      // Prepare file data for chunking
      let fileBuffer: any; // Buffer type from Node.js
      if (typeof file === "string") {
        // Read entire file into buffer for chunking
        fileBuffer = fs.readFileSync(file);
      } else if (
        typeof Buffer !== "undefined" &&
        Buffer.isBuffer &&
        Buffer.isBuffer(file)
      ) {
        fileBuffer = file;
      } else {
        throw new D3ValidationError(
          "Stream uploads are not supported. Please use file path or Buffer."
        );
      }

      for (let i = 0; i < actualParts; i++) {
        const start = i * chunkSizePerPart;
        const end = Math.min(start + chunkSizePerPart, fileSize);
        const partSize = end - start;

        // Extract chunk from buffer
        const chunk = fileBuffer.slice(start, end);

        // Upload chunk
        await axios.put(presignedUrls[i], chunk, {
          headers: {
            "Content-Type": detectedMimeType,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        bytesUploaded += partSize;

        // Report progress
        if (onProgress) {
          onProgress({
            currentPart: i + 1,
            totalParts: actualParts,
            bytesUploaded,
            totalBytes: fileSize,
            percentage: Math.round((bytesUploaded / fileSize) * 100),
          });
        }
      }

      return { fileKey, presignedUrls };
    } catch (error: any) {
      if (error instanceof D3ClientError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new D3UploadError(`Upload failed: ${message}`, error);
    }
  }

  /**
   * Check if an operation is supported for a file extension
   *
   * @param options - Supported operation options
   * @returns Promise resolving to supported operation response
   *
   * @example
   * ```typescript
   * // Check all available actions for PDF
   * const result = await client.checkSupportedOperation({
   *   ext: 'pdf'
   * });
   * console.log('Available actions:', result.availableActions);
   *
   * // Check if convert to PNG is supported
   * const result = await client.checkSupportedOperation({
   *   ext: 'pdf',
   *   action: 'convert',
   *   parameters: { convert_to: 'png' }
   * });
   * console.log('Supported:', result.supported);
   *
   * // Get available compression levels
   * const result = await client.checkSupportedOperation({
   *   ext: 'pdf',
   *   action: 'compress'
   * });
   * console.log('Compression levels:', result.parameters?.compression_value);
   * ```
   */
  async checkSupportedOperation(
    options: SupportedOperationOptions
  ): Promise<SupportedOperationResponse> {
    if (!options.ext) {
      throw new D3ValidationError("Extension (ext) is required");
    }

    try {
      const response = await this.axiosInstance.post<{
        data: SupportedOperationResponse;
      }>("/v1/external/supported-operation", {
        ext: options.ext,
        action: options.action,
        parameters: options.parameters,
      });

      return response.data.data;
    } catch (error: any) {
      if (error instanceof D3ClientError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new D3ClientError(
        `Failed to check supported operation: ${message}`,
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Create a file operation (convert, compress, merge, zip, etc.)
   *
   * @param options - Operation options
   * @returns Promise resolving to operation response with main task ID
   *
   * @example
   * ```typescript
   * // Convert PDF to PNG
   * const result = await client.createOperation({
   *   action: 'convert',
   *   fileKeys: ['file-key-123'],
   *   parameters: { convert_to: 'png' }
   * });
   *
   * // Compress PDF
   * const result = await client.createOperation({
   *   action: 'compress',
   *   fileKeys: ['file-key-123'],
   *   parameters: { compression_value: 'recommended' }
   * });
   *
   * // Merge multiple PDFs
   * const result = await client.createOperation({
   *   action: 'merge',
   *   fileKeys: ['file-key-1', 'file-key-2', 'file-key-3']
   * });
   *
   * // Lock PDF with password
   * const result = await client.createOperation({
   *   action: 'lock',
   *   fileKeys: ['file-key-123'],
   *   parameters: { password: 'secure-password' }
   * });
   * ```
   */
  async createOperation(options: OperationOptions): Promise<OperationResponse> {
    if (!options.action) {
      throw new D3ValidationError("Action is required");
    }
    if (!options.fileKeys || options.fileKeys.length === 0) {
      throw new D3ValidationError("At least one file key is required");
    }

    try {
      const response = await this.axiosInstance.post<{
        data: OperationResponse;
      }>("/v1/external/do", {
        action: options.action,
        file_keys: options.fileKeys,
        parameters: options.parameters,
        notes: options.notes,
      });

      return response.data.data;
    } catch (error: any) {
      if (error instanceof D3ClientError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new D3ClientError(
        `Failed to create operation: ${message}`,
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Convenience methods for specific operations
   */

  /**
   * Convert files to a different format
   */
  async convert(
    fileKeys: string[],
    convertTo: string,
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "convert",
      fileKeys,
      parameters: { convert_to: convertTo },
      notes,
    });
  }

  /**
   * Compress files
   */
  async compress(
    fileKeys: string[],
    compressionValue: string = "recommended",
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "compress",
      fileKeys,
      parameters: { compression_value: compressionValue },
      notes,
    });
  }

  /**
   * Merge multiple files
   */
  async merge(
    fileKeys: string[],
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "merge",
      fileKeys,
      notes,
    });
  }

  /**
   * Create a ZIP archive from files
   */
  async zip(
    fileKeys: string[],
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "zip",
      fileKeys,
      notes,
    });
  }

  /**
   * Share files (generate shareable links)
   */
  async share(
    fileKeys: string[],
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "share",
      fileKeys,
      notes,
    });
  }

  /**
   * Lock PDF with password
   */
  async lockPdf(
    fileKeys: string[],
    password: string,
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "lock",
      fileKeys,
      parameters: { password },
      notes,
    });
  }

  /**
   * Unlock PDF with password
   */
  async unlockPdf(
    fileKeys: string[],
    password: string,
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "unlock",
      fileKeys,
      parameters: { password },
      notes,
    });
  }

  /**
   * Reset PDF password
   */
  async resetPdfPassword(
    fileKeys: string[],
    oldPassword: string,
    newPassword: string,
    notes?: Record<string, string>
  ): Promise<OperationResponse> {
    return this.createOperation({
      action: "reset_password",
      fileKeys,
      parameters: {
        old_password: oldPassword,
        new_password: newPassword,
      },
      notes,
    });
  }

  /**
   * Get operation status
   *
   * @param options - Status options
   * @returns Promise resolving to status response
   *
   * @example
   * ```typescript
   * // Get main task status
   * const status = await client.getStatus({
   *   mainTaskId: 'task-123'
   * });
   *
   * // Get specific file task status
   * const status = await client.getStatus({
   *   mainTaskId: 'task-123',
   *   fileTaskId: 'file-task-456'
   * });
   * ```
   */
  async getStatus(options: StatusOptions): Promise<StatusResponse> {
    if (!options.mainTaskId) {
      throw new D3ValidationError("mainTaskId is required");
    }

    try {
      let url = `/v1/external/status/${options.mainTaskId}`;
      if (options.fileTaskId) {
        url += `/${options.fileTaskId}`;
      }

      const response = await this.axiosInstance.get<{ data: StatusResponse }>(
        url
      );
      return response.data.data;
    } catch (error: any) {
      if (error instanceof D3ClientError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new D3ClientError(
        `Failed to get status: ${message}`,
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Poll operation status until completion or failure
   *
   * @param options - Poll status options
   * @returns Promise resolving to final status response
   *
   * @example
   * ```typescript
   * const status = await client.pollStatus({
   *   mainTaskId: 'task-123',
   *   interval: 2000, // Check every 2 seconds
   *   timeout: 300000, // 5 minutes max
   *   onUpdate: (status) => {
   *     console.log('Status:', status.operationStatus);
   *   }
   * });
   *
   * if (status.operationStatus === 'completed') {
   *   console.log('Download links:', status.filesData.map(f => f.downloadLink));
   * }
   * ```
   */
  async pollStatus(options: PollStatusOptions): Promise<StatusResponse> {
    const {
      mainTaskId,
      fileTaskId,
      interval = 2000,
      timeout = 300000,
      onUpdate,
    } = options;

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new D3TimeoutError(`Polling timed out after ${timeout}ms`));
            return;
          }

          // Get status
          const status = await this.getStatus({ mainTaskId, fileTaskId });

          // Call update callback
          if (onUpdate) {
            onUpdate(status);
          }

          // Check if completed or failed
          if (
            status.operationStatus === "completed" ||
            status.operationStatus === "failed"
          ) {
            resolve(status);
            return;
          }

          // Continue polling
          // setTimeout is available globally in Node.js
          // @ts-ignore - setTimeout is available in Node.js runtime
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(ext: string): string | null {
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".zip": "application/zip",
      ".txt": "text/plain",
      ".mp4": "video/mp4",
      ".mp3": "audio/mpeg",
    };

    return mimeTypes[ext.toLowerCase()] || null;
  }
}
