import axios from "axios";
import { D3Client } from "../src";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const API_BASE = process.env.D3_BASE_URL ?? "https://api-dev.dragdropdo.com";
const API_KEY = process.env.D3_API_KEY;
const RUN_LIVE = process.env.RUN_LIVE_TESTS === "1";

// Skip unless explicitly enabled with RUN_LIVE_TESTS=1 and a real API key.
const maybeDescribe = RUN_LIVE && API_KEY ? describe : describe.skip;

if (!RUN_LIVE || !API_KEY) {
  // Provide a hint when the suite is skipped.
  // eslint-disable-next-line no-console
  console.warn(
    "Skipping live API tests. Set RUN_LIVE_TESTS=1 and D3_API_KEY to run."
  );
}

maybeDescribe("D3Client live API", () => {
  const log = (...args: unknown[]) => console.log("[live-test]", ...args);

  test("upload, convert, poll, download", async () => {
    if (!API_KEY) {
      throw new Error("API_KEY is required for live tests");
    }

    const client = new D3Client({ apiKey: API_KEY, baseURL: API_BASE });
    const tmpFile = path.join(os.tmpdir(), `d3-live-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "hello world");

    log("Uploading file...");
    const upload = await client.uploadFile({
      file: tmpFile,
      fileName: "hello.txt",
      mimeType: "text/plain",
      parts: 1,
    });
    log("Upload result:", upload);

    log("Starting convert...");
    const operation = await client.convert(
      [upload.fileKey || upload.file_key],
      "png"
    );
    log("Operation:", operation);

    log("Polling status...");
    const status = await client.pollStatus({
      mainTaskId: operation.mainTaskId,
      interval: 3_000,
      timeout: 60_000,
    });
    log("Final status:", status);

    expect(status.operationStatus).toBe("completed");
    const link = status.filesData[0]?.downloadLink;
    expect(link).toBeTruthy();

    if (link) {
      log("Downloading output...");
      const res = await axios.get<ArrayBuffer>(link, {
        responseType: "arraybuffer",
      });
      const buf = Buffer.from(res.data);
      log("Downloaded bytes:", buf.length);
      expect(res.status).toBe(200);
      expect(buf.length).toBeGreaterThan(0);
    }

    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }, 120_000);
});
