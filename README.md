# D3 Node.js Client

Official Node.js client library for the D3 Business API. This library provides a simple and elegant interface for developers to interact with D3's file processing services.

## Features

- ✅ **File Upload** - Upload files with automatic multipart handling
- ✅ **Operation Support** - Check which operations are available for file types
- ✅ **File Operations** - Convert, compress, merge, zip, and more
- ✅ **Status Polling** - Built-in polling for operation status
- ✅ **TypeScript Support** - Full TypeScript definitions included
- ✅ **Error Handling** - Comprehensive error types and messages
- ✅ **Progress Tracking** - Upload progress callbacks

## Installation

```bash
npm install d3-node-client
```

## Quick Start

```typescript
import { D3Client } from "d3-node-client";

// Initialize the client
const client = new D3Client({
  apiKey: "your-api-key-here",
  baseURL: "https://api.d3.com", // Optional, defaults to https://api.d3.com
  timeout: 30000, // Optional, defaults to 30000ms
});

// Upload a file
const uploadResult = await client.uploadFile({
  file: "/path/to/document.pdf",
  fileName: "document.pdf",
  mimeType: "application/pdf",
});

console.log("File key:", uploadResult.fileKey);

// Check if convert to PNG is supported
const supported = await client.checkSupportedOperation({
  ext: "pdf",
  action: "convert",
  parameters: { convert_to: "png" },
});

if (supported.supported) {
  // Convert PDF to PNG
  const operation = await client.convert([uploadResult.fileKey], "png");

  // Poll for completion
  const status = await client.pollStatus({
    mainTaskId: operation.mainTaskId,
    interval: 2000, // Check every 2 seconds
    onUpdate: (status) => {
      console.log("Status:", status.operationStatus);
    },
  });

  if (status.operationStatus === "completed") {
    console.log(
      "Download links:",
      status.filesData.map((f) => f.downloadLink)
    );
  }
}
```

## API Reference

### Initialization

#### `new D3Client(config: D3ClientConfig)`

Create a new D3 client instance.

**Parameters:**

- `config.apiKey` (required) - Your D3 API key
- `config.baseURL` (optional) - Base URL of the D3 API (default: `'https://api.d3.com'`)
- `config.timeout` (optional) - Request timeout in milliseconds (default: `30000`)
- `config.headers` (optional) - Custom headers to include in all requests

**Example:**

```typescript
const client = new D3Client({
  apiKey: "your-api-key",
  baseURL: "https://api.d3.com",
  timeout: 30000,
});
```

---

### File Upload

#### `uploadFile(options: UploadFileOptions): Promise<UploadResponse>`

Upload a file to D3 storage. This method handles the complete upload flow including multipart uploads.

**Parameters:**

- `options.file` (required) - File path (string) or Buffer
- `options.fileName` (required) - Original file name
- `options.mimeType` (optional) - MIME type (auto-detected if not provided)
- `options.parts` (optional) - Number of parts for multipart upload (auto-calculated if not provided)
- `options.onProgress` (optional) - Progress callback function

**Returns:** `Promise<UploadResponse>` with `fileKey` and `presignedUrls`

**Example:**

```typescript
// Upload from file path
const result = await client.uploadFile({
  file: "/path/to/file.pdf",
  fileName: "document.pdf",
  mimeType: "application/pdf",
  onProgress: (progress) => {
    console.log(`Upload: ${progress.percentage}%`);
  },
});

// Upload from Buffer
const buffer = fs.readFileSync("/path/to/file.pdf");
const result = await client.uploadFile({
  file: buffer,
  fileName: "document.pdf",
  mimeType: "application/pdf",
});
```

---

### Check Supported Operations

#### `checkSupportedOperation(options: SupportedOperationOptions): Promise<SupportedOperationResponse>`

Check which operations are supported for a file extension.

**Parameters:**

- `options.ext` (required) - File extension (e.g., `'pdf'`, `'jpg'`)
- `options.action` (optional) - Specific action to check (e.g., `'convert'`, `'compress'`)
- `options.parameters` (optional) - Parameters for validation (e.g., `{ convert_to: 'png' }`)

**Returns:** `Promise<SupportedOperationResponse>` with support information

**Example:**

```typescript
// Get all available actions for PDF
const result = await client.checkSupportedOperation({
  ext: "pdf",
});
console.log("Available actions:", result.availableActions);
// Output: ['CONVERT', 'COMPRESS', 'MERGE', 'LOCK', 'UNLOCK', ...]

// Check if convert to PNG is supported
const result = await client.checkSupportedOperation({
  ext: "pdf",
  action: "convert",
  parameters: { convert_to: "png" },
});
console.log("Supported:", result.supported); // true or false

// Get available compression levels
const result = await client.checkSupportedOperation({
  ext: "pdf",
  action: "compress",
});
console.log("Compression levels:", result.parameters?.compression_value);
// Output: [{ name: 'Recommended', value: 'recommended', ... }, ...]

// Get available convert targets
const result = await client.checkSupportedOperation({
  ext: "pdf",
  action: "convert",
});
console.log("Convert targets:", result.parameters?.convert_to);
// Output: { DOCUMENT: ['docx', 'txt'], IMAGE: ['png', 'jpg'], ... }
```

---

### Create Operations

#### `createOperation(options: OperationOptions): Promise<OperationResponse>`

Create a file operation (convert, compress, merge, zip, etc.).

**Parameters:**

- `options.action` (required) - Action to perform: `'convert'`, `'compress'`, `'merge'`, `'zip'`, `'share'`, `'lock'`, `'unlock'`, `'reset_password'`
- `options.fileKeys` (required) - Array of file keys from upload
- `options.parameters` (optional) - Action-specific parameters
- `options.notes` (optional) - User metadata

**Returns:** `Promise<OperationResponse>` with `mainTaskId`

**Example:**

```typescript
// Convert PDF to PNG
const result = await client.createOperation({
  action: "convert",
  fileKeys: ["file-key-123"],
  parameters: { convert_to: "png" },
  notes: { userId: "user-123" },
});

// Compress PDF
const result = await client.createOperation({
  action: "compress",
  fileKeys: ["file-key-123"],
  parameters: { compression_value: "recommended" },
});

// Merge multiple PDFs
const result = await client.createOperation({
  action: "merge",
  fileKeys: ["file-key-1", "file-key-2", "file-key-3"],
});
```

#### Convenience Methods

The client also provides convenience methods for common operations:

**Convert:**

```typescript
await client.convert(fileKeys, convertTo, notes?);
// Example: await client.convert(['file-key-123'], 'png');
```

**Compress:**

```typescript
await client.compress(fileKeys, compressionValue?, notes?);
// Example: await client.compress(['file-key-123'], 'recommended');
```

**Merge:**

```typescript
await client.merge(fileKeys, notes?);
// Example: await client.merge(['file-key-1', 'file-key-2']);
```

**Zip:**

```typescript
await client.zip(fileKeys, notes?);
// Example: await client.zip(['file-key-1', 'file-key-2']);
```

**Share:**

```typescript
await client.share(fileKeys, notes?);
// Example: await client.share(['file-key-123']);
```

**Lock PDF:**

```typescript
await client.lockPdf(fileKeys, password, notes?);
// Example: await client.lockPdf(['file-key-123'], 'secure-password');
```

**Unlock PDF:**

```typescript
await client.unlockPdf(fileKeys, password, notes?);
// Example: await client.unlockPdf(['file-key-123'], 'password');
```

**Reset PDF Password:**

```typescript
await client.resetPdfPassword(fileKeys, oldPassword, newPassword, notes?);
// Example: await client.resetPdfPassword(['file-key-123'], 'old', 'new');
```

---

### Get Status

#### `getStatus(options: StatusOptions): Promise<StatusResponse>`

Get the current status of an operation.

**Parameters:**

- `options.mainTaskId` (required) - Main task ID from operation creation
- `options.fileTaskId` (optional) - Specific file task ID

**Returns:** `Promise<StatusResponse>` with operation and file statuses

**Example:**

```typescript
// Get main task status
const status = await client.getStatus({
  mainTaskId: "task-123",
});

// Get specific file task status
const status = await client.getStatus({
  mainTaskId: "task-123",
  fileTaskId: "file-task-456",
});

console.log("Operation status:", status.operationStatus);
// Possible values: 'queued', 'running', 'completed', 'failed'

if (status.operationStatus === "completed") {
  status.filesData.forEach((file) => {
    console.log(`File ${file.fileKey}: ${file.status}`);
    if (file.downloadLink) {
      console.log(`Download: ${file.downloadLink}`);
    }
  });
}
```

#### `pollStatus(options: PollStatusOptions): Promise<StatusResponse>`

Poll operation status until completion or failure.

**Parameters:**

- `options.mainTaskId` (required) - Main task ID
- `options.fileTaskId` (optional) - Specific file task ID
- `options.interval` (optional) - Polling interval in milliseconds (default: `2000`)
- `options.timeout` (optional) - Maximum polling duration in milliseconds (default: `300000` = 5 minutes)
- `options.onUpdate` (optional) - Callback for each status update

**Returns:** `Promise<StatusResponse>` with final status

**Example:**

```typescript
const status = await client.pollStatus({
  mainTaskId: "task-123",
  interval: 2000, // Check every 2 seconds
  timeout: 300000, // 5 minutes max
  onUpdate: (status) => {
    console.log("Status:", status.operationStatus);
    console.log("Files:", status.filesData.length);
  },
});

if (status.operationStatus === "completed") {
  console.log("All files processed successfully!");
  status.filesData.forEach((file) => {
    console.log(`Download: ${file.downloadLink}`);
  });
} else if (status.operationStatus === "failed") {
  console.error("Operation failed");
  status.filesData.forEach((file) => {
    if (file.errorMessage) {
      console.error(`Error: ${file.errorMessage}`);
    }
  });
}
```

---

## Complete Workflow Example

Here's a complete example showing the typical workflow:

```typescript
import { D3Client } from "d3-node-client";
import * as fs from "fs";

async function processFile() {
  // Initialize client
  const client = new D3Client({
    apiKey: process.env.D3_API_KEY!,
    baseURL: "https://api.d3.com",
  });

  try {
    // Step 1: Upload file
    console.log("Uploading file...");
    const uploadResult = await client.uploadFile({
      file: "./document.pdf",
      fileName: "document.pdf",
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress.percentage}%`);
      },
    });
    console.log("Upload complete. File key:", uploadResult.fileKey);

    // Step 2: Check if operation is supported
    console.log("Checking supported operations...");
    const supported = await client.checkSupportedOperation({
      ext: "pdf",
      action: "convert",
      parameters: { convert_to: "png" },
    });

    if (!supported.supported) {
      throw new Error("Convert to PNG is not supported for PDF");
    }

    // Step 3: Create operation
    console.log("Creating convert operation...");
    const operation = await client.convert([uploadResult.fileKey], "png", {
      userId: "user-123",
      source: "api",
    });
    console.log("Operation created. Task ID:", operation.mainTaskId);

    // Step 4: Poll for completion
    console.log("Waiting for operation to complete...");
    const status = await client.pollStatus({
      mainTaskId: operation.mainTaskId,
      interval: 2000,
      onUpdate: (status) => {
        console.log(`Status: ${status.operationStatus}`);
      },
    });

    // Step 5: Handle result
    if (status.operationStatus === "completed") {
      console.log("Operation completed successfully!");
      status.filesData.forEach((file, index) => {
        console.log(`File ${index + 1}:`);
        console.log(`  Status: ${file.status}`);
        console.log(`  Download: ${file.downloadLink}`);
      });
    } else {
      console.error("Operation failed");
      status.filesData.forEach((file) => {
        if (file.errorMessage) {
          console.error(`Error: ${file.errorMessage}`);
        }
      });
    }
  } catch (error) {
    if (error instanceof D3APIError) {
      console.error(`API Error (${error.statusCode}):`, error.message);
    } else if (error instanceof D3ValidationError) {
      console.error("Validation Error:", error.message);
    } else {
      console.error("Error:", error);
    }
  }
}

processFile();
```

---

## Error Handling

The client provides several error types for better error handling:

```typescript
import { D3ClientError, D3APIError, D3ValidationError, D3UploadError, D3TimeoutError } from 'd3-node-client';

try {
  await client.uploadFile({ ... });
} catch (error) {
  if (error instanceof D3APIError) {
    // API returned an error
    console.error(`API Error (${error.statusCode}):`, error.message);
    console.error('Error code:', error.code);
    console.error('Details:', error.details);
  } else if (error instanceof D3ValidationError) {
    // Validation error (missing required fields, etc.)
    console.error('Validation Error:', error.message);
  } else if (error instanceof D3UploadError) {
    // Upload-specific error
    console.error('Upload Error:', error.message);
  } else if (error instanceof D3TimeoutError) {
    // Timeout error (from polling)
    console.error('Timeout:', error.message);
  } else {
    // Other errors
    console.error('Error:', error);
  }
}
```

---

## Supported Operations

### Convert

Convert files from one format to another.

**Parameters:**

- `convert_to` (required) - Target format (e.g., `'pdf'`, `'png'`, `'docx'`)

**Example:**

```typescript
await client.convert(["file-key-123"], "png");
```

### Compress

Compress files to reduce size.

**Parameters:**

- `compression_value` (required) - Compression level (e.g., `'recommended'`, `'high'`, `'low'`)

**Example:**

```typescript
await client.compress(["file-key-123"], "recommended");
```

### Merge

Merge multiple files into one.

**Example:**

```typescript
await client.merge(["file-key-1", "file-key-2", "file-key-3"]);
```

### Zip

Create a ZIP archive from multiple files.

**Example:**

```typescript
await client.zip(["file-key-1", "file-key-2"]);
```

### Share

Generate shareable links for files.

**Example:**

```typescript
await client.share(["file-key-123"]);
```

### Lock PDF

Protect PDF with password.

**Parameters:**

- `password` (required) - Password to protect the PDF

**Example:**

```typescript
await client.lockPdf(["file-key-123"], "secure-password");
```

### Unlock PDF

Remove password protection from PDF.

**Parameters:**

- `password` (required) - Current password

**Example:**

```typescript
await client.unlockPdf(["file-key-123"], "password");
```

### Reset PDF Password

Change PDF password.

**Parameters:**

- `old_password` (required) - Current password
- `new_password` (required) - New password

**Example:**

```typescript
await client.resetPdfPassword(["file-key-123"], "old-password", "new-password");
```

---

## TypeScript Support

The library is written in TypeScript and includes full type definitions. All types are exported for use in your projects:

```typescript
import {
  D3Client,
  D3ClientConfig,
  UploadFileOptions,
  UploadResponse,
  OperationOptions,
  OperationResponse,
  StatusResponse,
  // ... and more
} from "d3-node-client";
```

---

## Requirements

- Node.js 14.x or higher
- npm or yarn

---

## License

ISC

---

## Support

For API documentation and support, visit [D3 Developer Portal](https://developer.d3.com).
