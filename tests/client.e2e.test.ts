import nock from "nock";
import { D3Client } from "../src";

const API_BASE = "https://api.d3.com";

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
      throw new Error(`Not all HTTP mocks were satisfied: ${pending.join(", ")}`);
    }
    nock.cleanAll();
  });

  test("uploads a file (Buffer) with multipart flow", async () => {
    const client = new D3Client({ apiKey: "test-key", baseURL: API_BASE });

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
          fileKey: "file-key-123",
          presignedUrls: [
            "https://upload.d3.com/part1",
            "https://upload.d3.com/part2",
          ],
        },
      });

    nock("https://upload.d3.com").put("/part1").reply(200, {});
    nock("https://upload.d3.com").put("/part2").reply(200, {});

    const sixMbBuffer = Buffer.from("a".repeat(6 * 1024 * 1024));

    const result = await client.uploadFile({
      file: sixMbBuffer,
      fileName: "test.pdf",
      mimeType: "application/pdf",
      parts: 2,
    });

    expect(result.fileKey).toBe("file-key-123");
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

