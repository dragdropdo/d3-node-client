/**
 * D3 Business API Client
 *
 * A Node.js client library for interacting with the D3 Business API.
 * Provides methods for file uploads, operations, and status checking.
 */

// Import statements - these will resolve when dependencies are installed
// @ts-ignore - Module resolution will work at runtime with installed dependencies
import axios, { AxiosInstance } from "axios";
// @ts-ignore
import * as fs from "fs";
// @ts-ignore
import * as path from "path";
import {
  DragdropdoConfig,
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
  DragdropdoError,
  D3APIError,
  D3ValidationError,
  D3UploadError,
  D3TimeoutError,
} from "./errors";

export class Dragdropdo {
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
   * const client = new Dragdropdo({
   *   apiKey: 'your-api-key',
   *   baseURL: 'https://api-dev.dragdropdo.com',
   *   timeout: 30000
   * });
   * ```
   */
  constructor(config: DragdropdoConfig) {
    if (!config.apiKey) {
      throw new D3ValidationError("API key is required");
    }

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || "https://api-dev.dragdropdo.com";
    this.timeout = config.timeout || 30000;

    // Remove trailing slash from baseURL
    this.baseURL = this.baseURL.replace(/\/$/, "");

    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
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
          throw new DragdropdoError(
            "Network error: No response received from server"
          );
        } else {
          throw new DragdropdoError(`Request error: ${error.message}`);
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
   * ```
   */
  async uploadFile(options: UploadFileOptions): Promise<UploadResponse> {
    const { file, fileName, mimeType, parts, onProgress } = options;

    if (!fileName) {
      throw new D3ValidationError("fileName is required");
    }

    // Determine file size
    let fileSize: number;

    if (typeof file !== "string") {
      throw new D3ValidationError("file must be a file path string");
    }

    if (!fs.existsSync(file)) {
      throw new D3ValidationError(`File not found: ${file}`);
    }

    const stats = fs.statSync(file);
    fileSize = stats.size;

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
      }>("/v1/biz/initiate-upload", {
        file_name: fileName,
        size: fileSize,
        mime_type: detectedMimeType,
        parts: actualParts,
      });

      const rawData = uploadResponse.data.data;
      // Transform snake_case to camelCase
      const transformed = this.toCamelCase(rawData);
      const fileKey = transformed.fileKey || transformed.file_key;
      const uploadId = transformed.uploadId || transformed.upload_id;
      const presignedUrls =
        transformed.presignedUrls || transformed.presigned_urls || [];
      const objectName = transformed.objectName || transformed.object_name;

      if (presignedUrls.length !== actualParts) {
        throw new D3UploadError(
          `Mismatch: requested ${actualParts} parts but received ${presignedUrls.length} presigned URLs`
        );
      }

      if (!uploadId) {
        throw new D3UploadError("Upload ID not received from server");
      }

      // Step 2: Upload file parts and capture ETags
      const chunkSizePerPart = Math.ceil(fileSize / actualParts);
      let bytesUploaded = 0;
      const uploadParts: Array<{ etag: string; partNumber: number }> = [];

      // Prepare file data for chunking
      // Read entire file into memory for chunking (path-only uploads supported)
      const fileBuffer = fs.readFileSync(file);

      for (let i = 0; i < actualParts; i++) {
        const start = i * chunkSizePerPart;
        const end = Math.min(start + chunkSizePerPart, fileSize);
        const partSize = end - start;

        // Extract chunk from buffer (use subarray to avoid deprecated slice)
        const chunk = fileBuffer.subarray(start, end);

        // Upload chunk and capture ETag from response headers
        const putResponse = await axios.put(presignedUrls[i], chunk, {
          headers: {
            "Content-Type": detectedMimeType,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        // Extract ETag from response (ETag may be quoted, so we'll store it as-is)
        const etag =
          putResponse.headers.etag || putResponse.headers["ETag"] || "";
        if (!etag) {
          throw new D3UploadError(`Failed to get ETag for part ${i + 1}`);
        }

        uploadParts.push({
          etag: etag.replace(/^"|"$/g, ""), // Remove quotes if present
          partNumber: i + 1,
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

      // Step 3: Complete the multipart upload
      try {
        await this.axiosInstance.post<{
          data: { message: string; file_key: string };
        }>("/v1/biz/complete-upload", {
          file_key: fileKey,
          upload_id: uploadId,
          object_name: objectName,
          parts: uploadParts.map((part) => ({
            etag: part.etag,
            part_number: part.partNumber,
          })),
        });
      } catch (completeError: any) {
        if (
          completeError instanceof DragdropdoError ||
          completeError instanceof D3APIError
        ) {
          throw new D3UploadError(
            `Failed to complete upload: ${completeError.message}`,
            completeError
          );
        }
        const message = completeError?.message || "Unknown error";
        throw new D3UploadError(
          `Failed to complete upload: ${message}`,
          completeError
        );
      }

      return {
        file_key: fileKey,
        upload_id: uploadId,
        presigned_urls: presignedUrls,
        object_name: objectName,
        // Provide camelCase aliases for backward compatibility
        fileKey: fileKey,
        uploadId: uploadId,
        presignedUrls: presignedUrls,
        objectName: objectName,
      };
    } catch (error: any) {
      if (error instanceof DragdropdoError || error instanceof D3APIError) {
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
      }>("/v1/biz/supported-operation", {
        ext: options.ext,
        action: options.action,
        parameters: options.parameters,
      });

      return response.data.data;
    } catch (error: any) {
      if (error instanceof DragdropdoError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new DragdropdoError(
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
      }>("/v1/biz/do", {
        action: options.action,
        file_keys: options.fileKeys,
        parameters: options.parameters,
        notes: options.notes,
      });

      const rawData = response.data.data;
      // Transform snake_case to camelCase
      const transformed = this.toCamelCase(rawData);
      return {
        mainTaskId: transformed.mainTaskId || transformed.main_task_id,
      };
    } catch (error: any) {
      if (error instanceof DragdropdoError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new DragdropdoError(
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
      let url = `/v1/biz/status/${options.mainTaskId}`;
      if (options.fileTaskId) {
        url += `/${options.fileTaskId}`;
      }

      const response = await this.axiosInstance.get<{ data: any }>(url);
      const rawData = response.data.data;
      // Transform snake_case to camelCase
      const transformed = this.toCamelCase(rawData);
      return {
        operationStatus:
          transformed.operationStatus || transformed.operation_status,
        filesData: (transformed.filesData || transformed.files_data || []).map(
          (file: any) => ({
            fileKey: file.fileKey || file.file_key,
            status: file.status,
            downloadLink: file.downloadLink || file.download_link,
            errorCode: file.errorCode || file.error_code,
            errorMessage: file.errorMessage || file.error_message,
          })
        ),
      };
    } catch (error: any) {
      if (error instanceof DragdropdoError || error instanceof D3APIError) {
        throw error;
      }
      const message = error?.message || "Unknown error";
      throw new DragdropdoError(
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
   * Convert snake_case object keys to camelCase
   */
  private toCamelCase(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.toCamelCase(item));
    }
    if (typeof obj === "object") {
      const camelObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
            letter.toUpperCase()
          );
          camelObj[camelKey] = this.toCamelCase(obj[key]);
          // Also keep original key for backward compatibility
          camelObj[key] = obj[key];
        }
      }
      return camelObj;
    }
    return obj;
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
