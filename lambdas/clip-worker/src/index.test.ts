import { describe, it, expect } from "vitest";

describe("Stage 4: Clips handler (deprecated)", () => {
  it("returns deprecated error", async () => {
    const { handler } = await import("./index.js");
    const result = await handler({
      s3Bucket: "test-bucket",
      s3Prefix: "users/user-1/projects/proj-1/",
      projectId: "proj-1",
      userId: "user-1",
      renderId: "render-1",
      stage: "clips",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("deprecated");
  });
});
