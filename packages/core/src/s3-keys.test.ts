import { describe, it, expect } from "vitest";
import {
  buildBucketName,
  buildProjectPrefix,
  buildVersionPrefix,
  buildSlideImageKey,
  buildAudioKey,
  buildSpeechMarksKey,
  buildManifestKey,
  buildOutputKey,
  buildCaptionsKey,
} from "./s3-keys.js";

describe("S3 key builders", () => {
  const bucketParams = {
    productSlug: "ltvideo",
    purpose: "projects",
    env: "dev",
    accountId: "000000000000",
    region: "us-east-1",
  };

  const keyParams = {
    userId: "user-123",
    projectId: "proj-456",
    versionNumber: 1,
  };

  describe("buildBucketName", () => {
    it("builds bucket name from components", () => {
      expect(buildBucketName(bucketParams)).toBe(
        "ltvideo-projects-dev-000000000000-us-east-1",
      );
    });
  });

  describe("buildProjectPrefix", () => {
    it("builds project prefix", () => {
      expect(buildProjectPrefix(keyParams)).toBe("user-123/proj-456/");
    });
  });

  describe("buildVersionPrefix", () => {
    it("builds version prefix with zero-padded version number", () => {
      expect(buildVersionPrefix(keyParams)).toBe(
        "user-123/proj-456/versions/v0001/",
      );
    });

    it("handles large version numbers", () => {
      expect(buildVersionPrefix({ ...keyParams, versionNumber: 42 })).toBe(
        "user-123/proj-456/versions/v0042/",
      );
    });
  });

  describe("buildSlideImageKey", () => {
    it("builds slide image key with zero-padded slide number", () => {
      expect(buildSlideImageKey(keyParams, 1)).toBe(
        "user-123/proj-456/versions/v0001/slides/deck.001.png",
      );
    });
  });

  describe("buildAudioKey", () => {
    it("builds audio key", () => {
      expect(buildAudioKey(keyParams, 3)).toBe(
        "user-123/proj-456/versions/v0001/audio/slide-003.pcm",
      );
    });
  });

  describe("buildSpeechMarksKey", () => {
    it("builds speech marks key", () => {
      expect(buildSpeechMarksKey(keyParams, 1)).toBe(
        "user-123/proj-456/versions/v0001/audio/slide-001-marks.json",
      );
    });
  });

  describe("buildManifestKey", () => {
    it("builds manifest key", () => {
      expect(buildManifestKey(keyParams)).toBe(
        "user-123/proj-456/versions/v0001/video/video-manifest.json",
      );
    });
  });

  describe("buildOutputKey", () => {
    it("builds output key", () => {
      expect(buildOutputKey(keyParams, "lt-full-16x9")).toBe(
        "user-123/proj-456/versions/v0001/output/lt-full-16x9.mp4",
      );
    });
  });

  describe("buildCaptionsKey", () => {
    it("builds captions key", () => {
      expect(buildCaptionsKey(keyParams, "full.ja.vtt")).toBe(
        "user-123/proj-456/versions/v0001/captions/full.ja.vtt",
      );
    });
  });
});
