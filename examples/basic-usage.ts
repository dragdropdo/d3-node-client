/**
 * Basic Usage Examples for D3 Node.js Client
 *
 * This file demonstrates common usage patterns for the D3 client library.
 */

import { D3Client, D3APIError, D3ValidationError } from "../src";

// Type declarations for Node.js globals (for linter)
// These are available at runtime in Node.js
declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

declare const require: {
  main: any;
};

declare const module: any;

async function basicExample() {
  // Initialize the client
  const client = new D3Client({
    apiKey: process.env.D3_API_KEY || "your-api-key-here",
    baseURL: "https://api.d3.com",
    timeout: 30000,
  });

  try {
    // Example 1: Upload a file
    console.log("Example 1: Uploading file...");
    const uploadResult = await client.uploadFile({
      file: "./example.pdf",
      fileName: "example.pdf",
      mimeType: "application/pdf",
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress.percentage}%`);
      },
    });
    console.log("Upload complete. File key:", uploadResult.fileKey);

    // Example 2: Check supported operations
    console.log("\nExample 2: Checking supported operations...");
    const supported = await client.checkSupportedOperation({
      ext: "pdf",
    });
    console.log("Available actions:", supported.availableActions);

    // Example 3: Validate specific operation
    console.log("\nExample 3: Validating convert operation...");
    const convertSupported = await client.checkSupportedOperation({
      ext: "pdf",
      action: "convert",
      parameters: { convert_to: "png" },
    });
    console.log("Convert to PNG supported:", convertSupported.supported);

    // Example 4: Create convert operation
    console.log("\nExample 4: Creating convert operation...");
    const operation = await client.convert([uploadResult.fileKey], "png", {
      userId: "user-123",
      source: "api-example",
    });
    console.log("Operation created. Main task ID:", operation.mainTaskId);

    // Example 5: Poll for completion
    console.log("\nExample 5: Polling for completion...");
    const status = await client.pollStatus({
      mainTaskId: operation.mainTaskId,
      interval: 2000,
      timeout: 300000,
      onUpdate: (status) => {
        console.log(`Status update: ${status.operationStatus}`);
      },
    });

    // Example 6: Handle result
    console.log("\nExample 6: Handling result...");
    if (status.operationStatus === "completed") {
      console.log("Operation completed successfully!");
      status.filesData.forEach((file, index) => {
        console.log(`File ${index + 1}:`);
        console.log(`  File Key: ${file.fileKey}`);
        console.log(`  Status: ${file.status}`);
        if (file.downloadLink) {
          console.log(`  Download Link: ${file.downloadLink}`);
        }
      });
    } else if (status.operationStatus === "failed") {
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
      console.error("Error code:", error.code);
      console.error("Details:", error.details);
    } else if (error instanceof D3ValidationError) {
      console.error("Validation Error:", error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

async function compressExample() {
  const client = new D3Client({
    apiKey: process.env.D3_API_KEY || "your-api-key-here",
  });

  try {
    // Upload file
    const uploadResult = await client.uploadFile({
      file: "./large-file.pdf",
      fileName: "large-file.pdf",
    });

    // Get available compression levels
    const compressionInfo = await client.checkSupportedOperation({
      ext: "pdf",
      action: "compress",
    });
    console.log(
      "Available compression levels:",
      compressionInfo.parameters?.compression_value
    );

    // Compress with recommended level
    const operation = await client.compress(
      [uploadResult.fileKey],
      "recommended"
    );

    // Poll for completion
    const status = await client.pollStatus({
      mainTaskId: operation.mainTaskId,
    });

    if (status.operationStatus === "completed") {
      console.log("Compression completed!");
      console.log("Download link:", status.filesData[0].downloadLink);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

async function mergeExample() {
  const client = new D3Client({
    apiKey: process.env.D3_API_KEY || "your-api-key-here",
  });

  try {
    // Upload multiple files
    const file1 = await client.uploadFile({
      file: "./document1.pdf",
      fileName: "document1.pdf",
    });
    const file2 = await client.uploadFile({
      file: "./document2.pdf",
      fileName: "document2.pdf",
    });
    const file3 = await client.uploadFile({
      file: "./document3.pdf",
      fileName: "document3.pdf",
    });

    // Merge all files
    const operation = await client.merge([
      file1.fileKey,
      file2.fileKey,
      file3.fileKey,
    ]);

    // Poll for completion
    const status = await client.pollStatus({
      mainTaskId: operation.mainTaskId,
    });

    if (status.operationStatus === "completed") {
      console.log("Merge completed!");
      console.log("Merged file:", status.filesData[0].downloadLink);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

async function pdfProtectionExample() {
  const client = new D3Client({
    apiKey: process.env.D3_API_KEY || "your-api-key-here",
  });

  try {
    // Upload PDF
    const uploadResult = await client.uploadFile({
      file: "./document.pdf",
      fileName: "document.pdf",
    });

    // Lock PDF with password
    const lockOperation = await client.lockPdf(
      [uploadResult.fileKey],
      "secure-password-123"
    );

    const lockStatus = await client.pollStatus({
      mainTaskId: lockOperation.mainTaskId,
    });

    if (lockStatus.operationStatus === "completed") {
      console.log("PDF locked successfully!");
      console.log("Protected file:", lockStatus.filesData[0].downloadLink);

      // Later, unlock the PDF
      const unlockOperation = await client.unlockPdf(
        [lockStatus.filesData[0].fileKey],
        "secure-password-123"
      );

      const unlockStatus = await client.pollStatus({
        mainTaskId: unlockOperation.mainTaskId,
      });

      if (unlockStatus.operationStatus === "completed") {
        console.log("PDF unlocked successfully!");
        console.log("Unlocked file:", unlockStatus.filesData[0].downloadLink);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run examples
if (require.main === module) {
  console.log("D3 Node.js Client - Basic Usage Examples\n");
  console.log("Note: Make sure to set D3_API_KEY environment variable\n");

  // Uncomment to run specific examples:
  // basicExample();
  // compressExample();
  // mergeExample();
  // pdfProtectionExample();
}

export { basicExample, compressExample, mergeExample, pdfProtectionExample };
