/**
 * MediaConvert job JSON builder.
 *
 * Generates the job settings matching the verified template from
 * design doc section 2.1. All values are production-tested.
 */

export interface PageInput {
  /** Page number (1-based) */
  pageNumber: number;
  /** Frame-aligned duration in milliseconds */
  frameAlignedDurationMs: number;
  /** Full S3 URI to the page PNG image */
  imageS3Uri: string;
  /** Full S3 URI to the page WAV audio */
  audioS3Uri: string;
}

export interface BuildJobParams {
  /** IAM Role ARN for MediaConvert */
  roleArn: string;
  /** Pages with their durations and S3 URIs */
  pages: PageInput[];
  /** S3 destination for output (with trailing slash) */
  outputDestination: string;
}

export interface MediaConvertJobSettings {
  Role: string;
  AccelerationSettings: { Mode: "DISABLED" };
  Settings: {
    TimecodeConfig: { Source: "ZEROBASED" };
    Inputs: Array<{
      TimecodeSource: "ZEROBASED";
      AudioSelectors: {
        "Audio Selector 1": {
          DefaultSelection: "DEFAULT";
          ExternalAudioFileInput: string;
        };
      };
      VideoGenerator: {
        Duration: number;
        ImageInput: string;
        FramerateNumerator: 30;
        FramerateDenominator: 1;
        Width: 1920;
        Height: 1080;
      };
    }>;
    OutputGroups: Array<{
      Name: "File Group";
      OutputGroupSettings: {
        Type: "FILE_GROUP_SETTINGS";
        FileGroupSettings: { Destination: string };
      };
      Outputs: Array<{
        NameModifier: "-video";
        ContainerSettings: { Container: "MP4"; Mp4Settings: Record<string, never> };
        VideoDescription: {
          Width: 1920;
          Height: 1080;
          CodecSettings: {
            Codec: "H_264";
            H264Settings: {
              RateControlMode: "QVBR";
              MaxBitrate: 5000000;
              FramerateControl: "SPECIFIED";
              FramerateNumerator: 30;
              FramerateDenominator: 1;
            };
          };
        };
        AudioDescriptions: Array<{
          AudioSourceName: "Audio Selector 1";
          CodecSettings: {
            Codec: "AAC";
            AacSettings: {
              Bitrate: 96000;
              CodingMode: "CODING_MODE_2_0";
              SampleRate: 48000;
            };
          };
        }>;
      }>;
    }>;
  };
}

/**
 * Build MediaConvert job JSON matching the verified template (section 2.1).
 *
 * Each page becomes one Input entry with VideoGenerator (still image + duration)
 * and an ExternalAudioFileInput pointing to the WAV file.
 * MediaConvert concatenates inputs in order.
 */
export function buildMediaConvertJob(
  params: BuildJobParams,
): MediaConvertJobSettings {
  const { roleArn, pages, outputDestination } = params;

  const inputs = pages.map((page) => ({
    TimecodeSource: "ZEROBASED" as const,
    AudioSelectors: {
      "Audio Selector 1": {
        DefaultSelection: "DEFAULT" as const,
        ExternalAudioFileInput: page.audioS3Uri,
      },
    },
    VideoGenerator: {
      Duration: page.frameAlignedDurationMs,
      ImageInput: page.imageS3Uri,
      FramerateNumerator: 30 as const,
      FramerateDenominator: 1 as const,
      Width: 1920 as const,
      Height: 1080 as const,
    },
  }));

  return {
    Role: roleArn,
    AccelerationSettings: { Mode: "DISABLED" },
    Settings: {
      TimecodeConfig: { Source: "ZEROBASED" },
      Inputs: inputs,
      OutputGroups: [
        {
          Name: "File Group",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: { Destination: outputDestination },
          },
          Outputs: [
            {
              NameModifier: "-video",
              ContainerSettings: { Container: "MP4", Mp4Settings: {} },
              VideoDescription: {
                Width: 1920,
                Height: 1080,
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    RateControlMode: "QVBR",
                    MaxBitrate: 5000000,
                    FramerateControl: "SPECIFIED",
                    FramerateNumerator: 30,
                    FramerateDenominator: 1,
                  },
                },
              },
              AudioDescriptions: [
                {
                  AudioSourceName: "Audio Selector 1",
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 96000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}
