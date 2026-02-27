# D3 Node.js Client - Methods Reference

This document provides a quick reference for all methods available in the D3 Node.js Client.

## Table of Contents

- [Initialization](#initialization)
- [File Upload](#file-upload)
- [Operation Support](#operation-support)
- [Create Operations](#create-operations)
- [Convenience Methods](#convenience-methods)
- [Status Checking](#status-checking)
- [Error Handling](#error-handling)

---

## Initialization

### `new D3Client(config)`

Create a new D3 client instance.

**Parameters:**

```typescript
{
  apiKey: string;           // Required: Your D3 API key
  baseURL?: string;          // Optional: API base URL (default: 'https://api.d3.com')
  timeout?: number;          // Optional: Request timeout in ms (default: 30000)
  headers?: Record<string, string>; // Optional: Custom headers
}
```

**Example:**

```typescript
const client = new D3Client({
  apiKey: "your-api-key",
  baseURL: "https://api.d3.com",
  timeout: 30000,
});
```

---

## File Upload

### `uploadFile(options)`

Upload a file to D3 storage with automatic multipart handling.

**Parameters:**

```typescript
{
  file: string;              // Required: File path
  fileName: string;           // Required: Original file name
  mimeType?: string;         // Optional: MIME type (auto-detected if not provided)
  parts?: number;            // Optional: Number of parts (auto-calculated if not provided)
  onProgress?: (progress: UploadProgress) => void; // Optional: Progress callback
}
```

**Returns:** `Promise<UploadResponse>`

```typescript
{
  fileKey: string;           // File key for use in operations
  presignedUrls: string[];   // Presigned URLs used for upload
}
```

**Example:**

```typescript
const result = await client.uploadFile({
  file: "/path/to/file.pdf",
  fileName: "document.pdf",
  onProgress: (progress) => {
    console.log(`${progress.percentage}%`);
  },
});
```

---

## Operation Support

### `checkSupportedOperation(options)`

Check which operations are supported for a file extension.

**Parameters:**

```typescript
{
  ext: string;               // Required: File extension (e.g., 'pdf', 'jpg')
  action?: string;           // Optional: Specific action to check
  parameters?: Record<string, any>; // Optional: Parameters for validation
}
```

**Returns:** `Promise<SupportedOperationResponse>`

```typescript
{
  supported: boolean;        // Whether operation is supported
  ext: string;               // Normalized extension
  action?: string;           // Action name (if provided)
  availableActions?: string[]; // Available actions (when only ext provided)
  parameters?: Record<string, any>; // Action-specific parameters
}
```

**Examples:**

```typescript
// Get all available actions
const all = await client.checkSupportedOperation({ ext: "pdf" });

// Check specific operation
const check = await client.checkSupportedOperation({
  ext: "pdf",
  action: "convert",
  parameters: { convert_to: "png" },
});

// Get compression levels
const compress = await client.checkSupportedOperation({
  ext: "pdf",
  action: "compress",
});
```

---

## Create Operations

### `createOperation(options)`

Create a file processing operation.

**Parameters:**

```typescript
{
  action: 'convert' | 'compress' | 'merge' | 'zip' | 'create_zip' |
          'share' | 'lock' | 'unlock' | 'reset_password'; // Required
  fileKeys: string[];        // Required: Array of file keys
  parameters?: {             // Optional: Action-specific parameters
    convert_to?: string;
    compression_value?: string;
    password?: string;
    old_password?: string;
    new_password?: string;
  };
  notes?: Record<string, string>; // Optional: User metadata
}
```

**Returns:** `Promise<OperationResponse>`

```typescript
{
  mainTaskId: string; // Main task ID for tracking
}
```

**Example:**

```typescript
const result = await client.createOperation({
  action: "convert",
  fileKeys: ["file-key-123"],
  parameters: { convert_to: "png" },
  notes: { userId: "user-123" },
});
```

---

## Convenience Methods

### `convert(fileKeys, convertTo, notes?)`

Convert files to a different format.

**Parameters:**

- `fileKeys: string[]` - Array of file keys
- `convertTo: string` - Target format (e.g., 'png', 'pdf', 'docx')
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.convert(["file-key-123"], "png");
```

---

### `compress(fileKeys, compressionValue?, notes?)`

Compress files to reduce size.

**Parameters:**

- `fileKeys: string[]` - Array of file keys
- `compressionValue?: string` - Compression level (default: 'recommended')
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.compress(["file-key-123"], "recommended");
```

---

### `merge(fileKeys, notes?)`

Merge multiple files into one.

**Parameters:**

- `fileKeys: string[]` - Array of file keys to merge
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.merge(["file-key-1", "file-key-2", "file-key-3"]);
```

---

### `zip(fileKeys, notes?)`

Create a ZIP archive from multiple files.

**Parameters:**

- `fileKeys: string[]` - Array of file keys
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.zip(["file-key-1", "file-key-2"]);
```

---

### `share(fileKeys, notes?)`

Generate shareable links for files.

**Parameters:**

- `fileKeys: string[]` - Array of file keys
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.share(["file-key-123"]);
```

---

### `lockPdf(fileKeys, password, notes?)`

Protect PDF with password.

**Parameters:**

- `fileKeys: string[]` - Array of PDF file keys
- `password: string` - Password to protect the PDF
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.lockPdf(["file-key-123"], "secure-password");
```

---

### `unlockPdf(fileKeys, password, notes?)`

Remove password protection from PDF.

**Parameters:**

- `fileKeys: string[]` - Array of PDF file keys
- `password: string` - Current password
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.unlockPdf(["file-key-123"], "password");
```

---

### `resetPdfPassword(fileKeys, oldPassword, newPassword, notes?)`

Change PDF password.

**Parameters:**

- `fileKeys: string[]` - Array of PDF file keys
- `oldPassword: string` - Current password
- `newPassword: string` - New password
- `notes?: Record<string, string>` - Optional user metadata

**Returns:** `Promise<OperationResponse>`

**Example:**

```typescript
await client.resetPdfPassword(["file-key-123"], "old", "new");
```

---

## Status Checking

### `getStatus(options)`

Get current status of an operation.

**Parameters:**

```typescript
{
  mainTaskId: string;        // Required: Main task ID
  fileTaskId?: string;       // Optional: Specific file task ID
}
```

**Returns:** `Promise<StatusResponse>`

```typescript
{
  operationStatus: "queued" | "running" | "completed" | "failed";
  filesData: Array<{
    fileKey: string;
    status: "queued" | "running" | "completed" | "failed";
    downloadLink?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
}
```

**Example:**

```typescript
const status = await client.getStatus({
  mainTaskId: "task-123",
  fileTaskId: "file-task-456", // optional
});
```

---

### `pollStatus(options)`

Poll operation status until completion or failure.

**Parameters:**

```typescript
{
  mainTaskId: string;        // Required: Main task ID
  fileTaskId?: string;       // Optional: Specific file task ID
  interval?: number;         // Optional: Polling interval in ms (default: 2000)
  timeout?: number;          // Optional: Max duration in ms (default: 300000)
  onUpdate?: (status: StatusResponse) => void; // Optional: Update callback
}
```

**Returns:** `Promise<StatusResponse>` (final status)

**Example:**

```typescript
const status = await client.pollStatus({
  mainTaskId: "task-123",
  interval: 2000,
  timeout: 300000,
  onUpdate: (status) => {
    console.log(status.operationStatus);
  },
});
```

---

## Error Handling

### Error Types

All errors extend `D3ClientError`:

- **D3ClientError** - Base error class
- **D3APIError** - API returned an error (includes `statusCode`, `code`, `details`)
- **D3ValidationError** - Client-side validation error
- **D3UploadError** - Upload-specific error
- **D3TimeoutError** - Polling timeout error

**Example:**

```typescript
try {
  await client.uploadFile({ ... });
} catch (error) {
  if (error instanceof D3APIError) {
    console.error(`API Error (${error.statusCode}):`, error.message);
  } else if (error instanceof D3ValidationError) {
    console.error('Validation Error:', error.message);
  }
}
```

---

## Quick Reference Table

| Method                      | Purpose            | Key Parameters                           |
| --------------------------- | ------------------ | ---------------------------------------- |
| `uploadFile()`              | Upload file        | `file`, `fileName`                       |
| `checkSupportedOperation()` | Check support      | `ext`, `action?`, `parameters?`          |
| `createOperation()`         | Create operation   | `action`, `fileKeys`, `parameters?`      |
| `convert()`                 | Convert files      | `fileKeys`, `convertTo`                  |
| `compress()`                | Compress files     | `fileKeys`, `compressionValue?`          |
| `merge()`                   | Merge files        | `fileKeys`                               |
| `zip()`                     | Create ZIP         | `fileKeys`                               |
| `share()`                   | Share files        | `fileKeys`                               |
| `lockPdf()`                 | Lock PDF           | `fileKeys`, `password`                   |
| `unlockPdf()`               | Unlock PDF         | `fileKeys`, `password`                   |
| `resetPdfPassword()`        | Reset PDF password | `fileKeys`, `oldPassword`, `newPassword` |
| `getStatus()`               | Get status         | `mainTaskId`, `fileTaskId?`              |
| `pollStatus()`              | Poll until done    | `mainTaskId`, `interval?`, `timeout?`    |

---

For detailed documentation, see [README.md](./README.md) and [API_DESIGN.md](./API_DESIGN.md).
