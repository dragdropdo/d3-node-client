# D3 Node.js Client - API Design Document

## Overview

The D3 Node.js Client provides a clean, developer-friendly interface for interacting with the D3 Business API. This document outlines the design decisions and methods exposed to developers.

## Design Principles

1. **Simplicity**: Methods should be intuitive and easy to use
2. **Type Safety**: Full TypeScript support with comprehensive type definitions
3. **Error Handling**: Clear, actionable error messages with proper error types
4. **Progress Tracking**: Built-in support for upload progress and status polling
5. **Flexibility**: Support both high-level convenience methods and low-level control

## Client Initialization

### Constructor

```typescript
new D3Client(config: D3ClientConfig)
```

**Purpose**: Initialize the client with API credentials and configuration.

**Configuration Options**:

- `apiKey` (required): Authentication key for API access
- `baseURL` (optional): API base URL (defaults to `https://api.d3.com`)
- `timeout` (optional): Request timeout in milliseconds (defaults to 30000)
- `headers` (optional): Custom headers for all requests

**Design Decision**: Single configuration object keeps initialization simple and allows for future extensibility.

---

## Core Methods

### 1. File Upload

#### `uploadFile(options: UploadFileOptions): Promise<UploadResponse>`

**Purpose**: Upload files to D3 storage with automatic multipart handling.

**Key Features**:

- Automatic multipart upload for large files
- Progress tracking via callback
- Automatic MIME type detection
- Automatic part calculation

**Design Decisions**:

- **Single method for all uploads**: Simplifies API surface
- **Automatic multipart handling**: Developers don't need to manage presigned URLs manually
- **Progress callback**: Allows UI updates during upload
- **File path support**: Uploads use a file path; Buffers are not supported

**Example**:

```typescript
const result = await client.uploadFile({
  file: "/path/to/file.pdf",
  fileName: "document.pdf",
  onProgress: (progress) => console.log(`${progress.percentage}%`),
});
```

---

### 2. Check Supported Operations

#### `checkSupportedOperation(options: SupportedOperationOptions): Promise<SupportedOperationResponse>`

**Purpose**: Query which operations are available for a file extension.

**Key Features**:

- Check all available actions for an extension
- Validate specific operation parameters
- Get available parameter values (e.g., compression levels, convert targets)

**Design Decisions**:

- **Single method with flexible options**: One method handles all query types
- **Returns structured data**: Easy to parse and display to users
- **Parameter validation**: Can validate before creating operations

**Use Cases**:

1. Display available operations to users
2. Validate operations before execution
3. Get available parameter values for UI dropdowns

**Example**:

```typescript
// Get all actions
const all = await client.checkSupportedOperation({ ext: "pdf" });

// Validate specific operation
const valid = await client.checkSupportedOperation({
  ext: "pdf",
  action: "convert",
  parameters: { convert_to: "png" },
});
```

---

### 3. Create Operations

#### `createOperation(options: OperationOptions): Promise<OperationResponse>`

**Purpose**: Create file processing operations (convert, compress, merge, etc.).

**Key Features**:

- Supports all operation types
- Type-safe parameters per operation
- Optional user metadata (notes)

**Design Decisions**:

- **Generic method**: One method for all operations keeps API consistent
- **Type-safe parameters**: TypeScript ensures correct parameter usage
- **Convenience methods**: Additional methods for common operations (see below)

**Supported Actions**:

- `convert`: Convert files to different formats
- `compress`: Compress files
- `merge`: Merge multiple files
- `zip`: Create ZIP archives
- `share`: Generate shareable links
- `lock`: Protect PDFs with password
- `unlock`: Remove PDF password protection
- `reset_password`: Change PDF password

**Example**:

```typescript
const result = await client.createOperation({
  action: "convert",
  fileKeys: ["file-key-123"],
  parameters: { convert_to: "png" },
  notes: { userId: "user-123" },
});
```

---

### 4. Convenience Methods

**Purpose**: Provide simpler, more intuitive methods for common operations.

**Methods**:

- `convert(fileKeys, convertTo, notes?)`
- `compress(fileKeys, compressionValue?, notes?)`
- `merge(fileKeys, notes?)`
- `zip(fileKeys, notes?)`
- `share(fileKeys, notes?)`
- `lockPdf(fileKeys, password, notes?)`
- `unlockPdf(fileKeys, password, notes?)`
- `resetPdfPassword(fileKeys, oldPassword, newPassword, notes?)`

**Design Decisions**:

- **Method overloading**: More intuitive than generic `createOperation`
- **Sensible defaults**: Compression defaults to 'recommended'
- **Type safety**: Each method has specific parameter types

**Example**:

```typescript
// Simpler than createOperation
await client.convert(["file-key-123"], "png");
await client.compress(["file-key-123"], "recommended");
await client.merge(["file-key-1", "file-key-2"]);
```

---

### 5. Get Status

#### `getStatus(options: StatusOptions): Promise<StatusResponse>`

**Purpose**: Get current status of an operation.

**Key Features**:

- Get main task status
- Get specific file task status
- Returns detailed file information

**Design Decisions**:

- **Single method with optional fileTaskId**: Handles both use cases
- **Structured response**: Easy to parse and display

**Example**:

```typescript
const status = await client.getStatus({
  mainTaskId: "task-123",
  fileTaskId: "file-task-456", // optional
});
```

---

### 6. Poll Status

#### `pollStatus(options: PollStatusOptions): Promise<StatusResponse>`

**Purpose**: Poll operation status until completion or failure.

**Key Features**:

- Configurable polling interval
- Configurable timeout
- Progress callback for each update
- Automatic completion detection

**Design Decisions**:

- **Built-in polling**: Developers don't need to implement polling logic
- **Configurable**: Allows customization for different use cases
- **Progress callback**: Enables real-time status updates

**Example**:

```typescript
const status = await client.pollStatus({
  mainTaskId: "task-123",
  interval: 2000,
  timeout: 300000,
  onUpdate: (status) => console.log(status.operationStatus),
});
```

---

## Error Handling

### Error Types

1. **D3ClientError**: Base error class
2. **D3APIError**: API returned an error (includes status code)
3. **D3ValidationError**: Client-side validation error
4. **D3UploadError**: Upload-specific error
5. **D3TimeoutError**: Polling timeout error

**Design Decisions**:

- **Hierarchical error types**: Easy to catch specific error types
- **Rich error information**: Includes status codes, error codes, and details
- **Actionable messages**: Error messages help developers fix issues

**Example**:

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

## Type System

### Exported Types

All types are exported for use in developer code:

- `D3ClientConfig`
- `UploadFileOptions`, `UploadResponse`, `UploadProgress`
- `SupportedOperationOptions`, `SupportedOperationResponse`
- `OperationOptions`, `OperationResponse`, `OperationParameters`
- `StatusOptions`, `StatusResponse`, `FileTaskStatus`, `PollStatusOptions`
- `D3Error` and all error types

**Design Decisions**:

- **Full type export**: Developers can use types in their code
- **Comprehensive types**: All API structures are typed
- **Optional fields**: Marked with `?` for clarity

---

## Workflow Patterns

### Standard Workflow

1. **Upload File** → Get file key
2. **Check Support** → Validate operation (optional)
3. **Create Operation** → Get main task ID
4. **Poll Status** → Wait for completion
5. **Handle Result** → Process download links or errors

### Quick Workflow (No Validation)

1. **Upload File** → Get file key
2. **Create Operation** → Get main task ID
3. **Poll Status** → Wait for completion

### Batch Processing

1. **Upload Multiple Files** → Get file keys
2. **Create Operation** → Use all file keys
3. **Poll Status** → Wait for all files

---

## Method Summary

| Method                      | Purpose                    | Returns                          |
| --------------------------- | -------------------------- | -------------------------------- |
| `uploadFile()`              | Upload file to storage     | `UploadResponse` (fileKey)       |
| `checkSupportedOperation()` | Query available operations | `SupportedOperationResponse`     |
| `createOperation()`         | Create file operation      | `OperationResponse` (mainTaskId) |
| `convert()`                 | Convert files              | `OperationResponse`              |
| `compress()`                | Compress files             | `OperationResponse`              |
| `merge()`                   | Merge files                | `OperationResponse`              |
| `zip()`                     | Create ZIP archive         | `OperationResponse`              |
| `share()`                   | Generate shareable links   | `OperationResponse`              |
| `lockPdf()`                 | Protect PDF with password  | `OperationResponse`              |
| `unlockPdf()`               | Remove PDF password        | `OperationResponse`              |
| `resetPdfPassword()`        | Change PDF password        | `OperationResponse`              |
| `getStatus()`               | Get operation status       | `StatusResponse`                 |
| `pollStatus()`              | Poll until completion      | `StatusResponse`                 |

---

## Future Enhancements

Potential additions based on developer feedback:

1. **Stream Support**: Direct stream uploads without buffering
2. **Batch Operations**: Upload and process multiple files in one call
3. **Webhook Integration**: Built-in webhook verification
4. **Retry Logic**: Automatic retry for failed operations
5. **Rate Limit Handling**: Automatic rate limit backoff
6. **Caching**: Cache supported operations for performance

---

## Conclusion

The D3 Node.js Client provides a clean, type-safe, and developer-friendly interface to the D3 Business API. The design prioritizes ease of use while maintaining flexibility for advanced use cases.
