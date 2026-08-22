import { describe, expect, it } from "vitest";
import { buildMediaConvertJob } from "./job-builder.js";

const baseParams = {
  roleArn: "arn:aws:iam::123456789012:role/MediaConvertRole",
  pages: [
    {
      pageNumber: 1,
      frameAlignedDurationMs: 25200,
      imageS3Uri: "s3://my-bucket/users/user1/projects/proj1/pages/page-001.png",
      audioS3Uri: "s3://my-bucket/users/user1/projects/proj1/audio/page-001.wav",
    },
    {
      pageNumber: 2,
      frameAlignedDurationMs: 27867,
      imageS3Uri: "s3://my-bucket/users/user1/projects/proj1/pages/page-002.png",
      audioS3Uri: "s3://my-bucket/users/user1/projects/proj1/audio/page-002.wav",
    },
  ],
  outputDestination: "s3://my-bucket/users/user1/projects/proj1/output/render-abc/",
};

describe("buildMediaConvertJob", () => {
  it("指定した16:9・30fpsの映像プロファイルを全設定に反映する", () => {
    const job = buildMediaConvertJob({
      ...baseParams,
      output: { width: 1920, height: 1080, fps: 30, captions: "none" },
    });

    expect(job.Role).toBe(baseParams.roleArn);
    expect(job.AccelerationSettings).toEqual({ Mode: "DISABLED" });
    expect(job.Settings.TimecodeConfig).toEqual({ Source: "ZEROBASED" });
    expect(job.Settings.Inputs).toHaveLength(2);

    for (const input of job.Settings.Inputs) {
      expect(input.VideoGenerator).toMatchObject({
        FramerateNumerator: 30,
        FramerateDenominator: 1,
        Width: 1920,
        Height: 1080,
      });
    }

    const output = job.Settings.OutputGroups[0].Outputs[0];
    expect(output.VideoDescription).toMatchObject({
      Width: 1920,
      Height: 1080,
      CodecSettings: {
        Codec: "H_264",
        H264Settings: {
          FramerateControl: "SPECIFIED",
          FramerateNumerator: 30,
          FramerateDenominator: 1,
        },
      },
    });
    expect(output.CaptionDescriptions).toBeUndefined();
  });

  it("9:16・60fpsを静止画入力とH.264出力の両方へ反映する", () => {
    const job = buildMediaConvertJob({
      ...baseParams,
      output: { width: 1080, height: 1920, fps: 60, captions: "srt" },
    });

    for (const input of job.Settings.Inputs) {
      expect(input.VideoGenerator).toMatchObject({
        Width: 1080,
        Height: 1920,
        FramerateNumerator: 60,
      });
    }

    expect(job.Settings.OutputGroups[0].Outputs[0].VideoDescription).toMatchObject({
      Width: 1080,
      Height: 1920,
      CodecSettings: { H264Settings: { FramerateNumerator: 60 } },
    });
  });

  it("burn指定時は先頭入力のSRTを同じMP4出力へ焼き込む", () => {
    const job = buildMediaConvertJob({
      ...baseParams,
      output: { width: 1080, height: 1920, fps: 60, captions: "burn" },
      captionsSrtS3Uri: "s3://my-bucket/users/user1/projects/proj1/captions/captions.srt",
      captionLanguageCode: "ja-JP",
    });

    expect(job.Settings.Inputs[0].CaptionSelectors).toEqual({
      "SRT Captions": {
        SourceSettings: {
          SourceType: "SRT",
          FileSourceSettings: {
            SourceFile: "s3://my-bucket/users/user1/projects/proj1/captions/captions.srt",
          },
        },
      },
    });
    expect(job.Settings.Inputs[1].CaptionSelectors).toBeUndefined();
    expect(job.Settings.OutputGroups[0].Outputs[0].CaptionDescriptions).toEqual([
      expect.objectContaining({
        CaptionSelectorName: "SRT Captions",
        LanguageCode: "JPN",
        DestinationSettings: expect.objectContaining({
          DestinationType: "BURN_IN",
          BurninDestinationSettings: expect.objectContaining({
            FontScript: "AUTOMATIC",
          }),
        }),
      }),
    ]);
  });

  it("burn指定でSRT URIが無い場合はジョブを構築しない", () => {
    expect(() =>
      buildMediaConvertJob({
        ...baseParams,
        output: { width: 1920, height: 1080, fps: 30, captions: "burn" },
      }),
    ).toThrow("SRT");
  });

  it("ページごとの入力尺・画像・WAVを保持する", () => {
    const job = buildMediaConvertJob({
      ...baseParams,
      output: { width: 1920, height: 1080, fps: 30, captions: "none" },
    });

    expect(job.Settings.Inputs[0].VideoGenerator.Duration).toBe(25200);
    expect(job.Settings.Inputs[1].VideoGenerator.Duration).toBe(27867);
    expect(job.Settings.Inputs[0].VideoGenerator.ImageInput).toMatch(/page-001\.png$/);
    expect(
      job.Settings.Inputs[1].AudioSelectors["Audio Selector 1"].ExternalAudioFileInput,
    ).toMatch(/page-002\.wav$/);
  });
});
