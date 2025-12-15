import nock from "nock";
import { D3Client } from "../src";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const API_BASE = "https://api-dev.dragdropdo.com";

describe("D3Client end-to-end (mocked HTTP)", () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    if (!nock.isDone()) {
      const pending = nock.pendingMocks();
      nock.cleanAll();
      throw new Error(
        `Not all HTTP mocks were satisfied: ${pending.join(", ")}`
      );
    }
    nock.cleanAll();
  });

  test("uploads a file (path) with multipart flow", async () => {
    const client = new D3Client({ apiKey: "test-key", baseURL: API_BASE });

    const tmpFile = path.join(os.tmpdir(), `d3-test-${Date.now()}.pdf`);
    const sixMbContent = "a".repeat(6 * 1024 * 1024);
    fs.writeFileSync(tmpFile, sixMbContent);

    const cleanup = () => {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    };

    nock(API_BASE)
      .post("/v1/external/upload", (body) => {
        return (
          body.file_name === "test.pdf" &&
          body.size === 6 * 1024 * 1024 &&
          body.mime_type === "application/pdf" &&
          body.parts === 2
        );
      })
      .reply(200, {
        data: {
          file_key: "file-key-123",
          upload_id: "upload-id-456",
          presigned_urls: [
            "https://upload.d3.com/part1",
            "https://upload.d3.com/part2",
          ],
        },
      });

    nock("https://upload.d3.com")
      .put("/part1")
      .reply(200, {}, { ETag: '"etag-part-1"' });
    nock("https://upload.d3.com")
      .put("/part2")
      .reply(200, {}, { ETag: '"etag-part-2"' });

    nock(API_BASE)
      .post("/v1/external/complete-upload", (body) => {
        return (
          body.file_key === "file-key-123" &&
          body.upload_id === "upload-id-456" &&
          Array.isArray(body.parts) &&
          body.parts.length === 2 &&
          body.parts[0].etag === "etag-part-1" &&
          body.parts[0].part_number === 1 &&
          body.parts[1].etag === "etag-part-2" &&
          body.parts[1].part_number === 2
        );
      })
      .reply(200, {
        data: {
          message: "Upload completed successfully",
          file_key: "file-key-123",
        },
      });

    let result;
    try {
      result = await client.uploadFile({
        file: tmpFile,
        fileName: "test.pdf",
        mimeType: "application/pdf",
        parts: 2,
      });
    } finally {
      cleanup();
    }

    expect(result.fileKey).toBe("file-key-123");
    expect(result.uploadId).toBe("upload-id-456");
    expect(result.presignedUrls).toHaveLength(2);
  });

  test("creates an operation and polls status to completion", async () => {
    const client = new D3Client({ apiKey: "test-key", baseURL: API_BASE });

    nock(API_BASE)
      .post("/v1/external/do", {
        action: "convert",
        file_keys: ["file-key-123"],
        parameters: { convert_to: "png" },
        notes: undefined,
      })
      .reply(200, { data: { mainTaskId: "task-123" } });

    nock(API_BASE)
      .get("/v1/external/status/task-123")
      .reply(200, {
        data: {
          operationStatus: "queued",
          filesData: [{ fileKey: "file-key-123", status: "queued" }],
        },
      })
      .get("/v1/external/status/task-123")
      .reply(200, {
        data: {
          operationStatus: "completed",
          filesData: [
            {
              fileKey: "file-key-123",
              status: "completed",
              downloadLink: "https://files.d3.com/output.png",
            },
          ],
        },
      });

    const operation = await client.convert(["file-key-123"], "png");
    expect(operation.mainTaskId).toBe("task-123");

    const status = await client.pollStatus({
      mainTaskId: operation.mainTaskId,
      interval: 5,
      timeout: 1000,
    });

    expect(status.operationStatus).toBe("completed");
    expect(status.filesData[0].downloadLink).toContain("files.d3.com");
  });
});
