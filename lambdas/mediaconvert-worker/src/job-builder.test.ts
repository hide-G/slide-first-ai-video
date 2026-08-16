import { describe, it, expect } from "vitest";
import { buildMediaConvertJob } from "./job-builder.js";

describe("buildMediaConvertJob", () => {
  const twoPageParams = {
    roleArn: "arn:aws:iam::123456789012:role/MediaConvertRole",
    pages: [
      {
        pageNumber: 1,
        frameAlignedDurationMs: 25200,
        imageS3Uri:
          "s3://my-bucket/users/user1/projects/proj1/pages/page-001.png",
        audioS3Uri:
          "s3://my-bucket/users/user1/projects/proj1/audio/page-001.wav",
      },
      {
        pageNumber: 2,
        frameAlignedDurationMs: 27867,
        imageS3Uri:
          "s3://my-bucket/users/user1/projects/proj1/pages/page-002.png",
        audioS3Uri:
          "s3://my-bucket/users/user1/projects/proj1/audio/page-002.wav",
      },
    ],
    outputDestination:
      "s3://my-bucket/users/user1/projects/proj1/output/render-abc/",
  };

  it("generates correct top-level structure", () => {
    const job = buildMediaConvertJob(twoPageParams);

    expect(job.Role).toBe(twoPageParams.roleArn);
    expect(job.AccelerationSettings).toEqual({ Mode: "DISABLED" });
    expect(job.Settings.TimecodeConfig).toEqual({ Source: "ZEROBASED" });
  });

  it("creates one Input per page with correct Duration values", () => {
    const job = buildMediaConvertJob(twoPageParams);
    const inputs = job.Settings.Inputs;

    expect(inputs).toHaveLength(2);

    // Page 1
    expect(inputs[0].VideoGenerator.Duration).toBe(25200);
    expect(inputs[0].VideoGenerator.ImageInput).toBe(
      "s3://my-bucket/users/user1/projects/proj1/pages/page-001.png",
    );
    expect(
      inputs[0].AudioSelectors["Audio Selector 1"].ExternalAudioFileInput,
    ).toBe("s3://my-bucket/users/user1/projects/proj1/audio/page-001.wav");

    // Page 2
    expect(inputs[1].VideoGenerator.Duration).toBe(27867);
    expect(inputs[1].VideoGenerator.ImageInput).toBe(
      "s3://my-bucket/users/user1/projects/proj1/pages/page-002.png",
    );
    expect(
      inputs[1].AudioSelectors["Audio Selector 1"].ExternalAudioFileInput,
    ).toBe("s3://my-bucket/users/user1/projects/proj1/audio/page-002.wav");
  });

  it("sets VideoGenerator properties correctly for all inputs", () => {
    const job = buildMediaConvertJob(twoPageParams);

    for (const input of job.Settings.Inputs) {
      expect(input.TimecodeSource).toBe("ZEROBASED");
      expect(input.AudioSelectors["Audio Selector 1"].DefaultSelection).toBe(
        "DEFAULT",
      );
      expect(input.VideoGenerator.FramerateNumerator).toBe(30);
      expect(input.VideoGenerator.FramerateDenominator).toBe(1);
      expect(input.VideoGenerator.Width).toBe(1920);
      expect(input.VideoGenerator.Height).toBe(1080);
    }
  });

  it("generates correct OutputGroups structure", () => {
    const job = buildMediaConvertJob(twoPageParams);
    const outputGroups = job.Settings.OutputGroups;

    expect(outputGroups).toHaveLength(1);

    const group = outputGroups[0];
    expect(group.Name).toBe("File Group");
    expect(group.OutputGroupSettings.Type).toBe("FILE_GROUP_SETTINGS");
    expect(group.OutputGroupSettings.FileGroupSettings.Destination).toBe(
      "s3://my-bucket/users/user1/projects/proj1/output/render-abc/",
    );
  });

  it("generates correct video output settings (H264 QVBR)", () => {
    const job = buildMediaConvertJob(twoPageParams);
    const output = job.Settings.OutputGroups[0].Outputs[0];

    expect(output.NameModifier).toBe("-video");
    expect(output.ContainerSettings.Container).toBe("MP4");
    expect(output.ContainerSettings.Mp4Settings).toEqual({});

    const video = output.VideoDescription;
    expect(video.Width).toBe(1920);
    expect(video.Height).toBe(1080);
    expect(video.CodecSettings.Codec).toBe("H_264");
    expect(video.CodecSettings.H264Settings.RateControlMode).toBe("QVBR");
    expect(video.CodecSettings.H264Settings.MaxBitrate).toBe(5000000);
    expect(video.CodecSettings.H264Settings.FramerateControl).toBe("SPECIFIED");
    expect(video.CodecSettings.H264Settings.FramerateNumerator).toBe(30);
    expect(video.CodecSettings.H264Settings.FramerateDenominator).toBe(1);
  });

  it("generates correct audio output settings (AAC stereo 48kHz)", () => {
    const job = buildMediaConvertJob(twoPageParams);
    const output = job.Settings.OutputGroups[0].Outputs[0];

    expect(output.AudioDescriptions).toHaveLength(1);

    const audio = output.AudioDescriptions[0];
    expect(audio.AudioSourceName).toBe("Audio Selector 1");
    expect(audio.CodecSettings.Codec).toBe("AAC");
    expect(audio.CodecSettings.AacSettings.Bitrate).toBe(96000);
    expect(audio.CodecSettings.AacSettings.CodingMode).toBe("CODING_MODE_2_0");
    expect(audio.CodecSettings.AacSettings.SampleRate).toBe(48000);
  });

  it("forms S3 paths correctly from page inputs", () => {
    const job = buildMediaConvertJob(twoPageParams);

    // Verify the audio URIs end with .wav
    for (const input of job.Settings.Inputs) {
      expect(
        input.AudioSelectors["Audio Selector 1"].ExternalAudioFileInput,
      ).toMatch(/\.wav$/);
    }

    // Verify the image URIs end with .png
    for (const input of job.Settings.Inputs) {
      expect(input.VideoGenerator.ImageInput).toMatch(/\.png$/);
    }
  });

  it("Duration values match frameAlignedDurationMs from input pages", () => {
    const job = buildMediaConvertJob(twoPageParams);

    expect(job.Settings.Inputs[0].VideoGenerator.Duration).toBe(
      twoPageParams.pages[0].frameAlignedDurationMs,
    );
    expect(job.Settings.Inputs[1].VideoGenerator.Duration).toBe(
      twoPageParams.pages[1].frameAlignedDurationMs,
    );
  });
});
