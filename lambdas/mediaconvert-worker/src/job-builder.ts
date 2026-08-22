/**
 * MediaConvertジョブ設定のビルダー。
 * 静止画とWAVをページ順に連結し、manifest.outputを唯一の出力プロファイルとして使う。
 */

export interface PageInput {
  /** ページ番号（1始まり） */
  pageNumber: number;
  /** フレーム境界へ切り上げた表示時間（ミリ秒） */
  frameAlignedDurationMs: number;
  /** ページPNGの完全なS3 URI */
  imageS3Uri: string;
  /** ページWAVの完全なS3 URI */
  audioS3Uri: string;
}

export interface OutputProfile {
  width: number;
  height: number;
  fps: number;
  captions: "burn" | "srt" | "none";
}

export interface BuildJobParams {
  /** MediaConvertサービスロールのARN */
  roleArn: string;
  /** 尺とS3 URIを含むページ一覧 */
  pages: PageInput[];
  /** 末尾スラッシュ付きのS3出力先 */
  outputDestination: string;
  /** manifest.outputから渡す出力プロファイル */
  output: OutputProfile;
  /** captions=burnのときに使用するSRTのS3 URI */
  captionsSrtS3Uri?: string;
  /** 字幕テキストの言語（BCP 47） */
  captionLanguageCode?: string;
}

interface CaptionSelector {
  SourceSettings: {
    SourceType: "SRT";
    FileSourceSettings: { SourceFile: string };
  };
}

interface CaptionDescription {
  CaptionSelectorName: "SRT Captions";
  LanguageCode?: "JPN" | "ENG";
  DestinationSettings: {
    DestinationType: "BURN_IN";
    BurninDestinationSettings: {
      Alignment: "CENTERED";
      BackgroundColor: "BLACK";
      BackgroundOpacity: number;
      FontColor: "WHITE";
      FontOpacity: number;
      FontScript: "AUTOMATIC";
      OutlineColor: "BLACK";
      OutlineSize: number;
      ShadowColor: "BLACK";
      ShadowOpacity: number;
      ShadowXOffset: number;
      ShadowYOffset: number;
    };
  };
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
      CaptionSelectors?: { "SRT Captions": CaptionSelector };
      VideoGenerator: {
        Duration: number;
        ImageInput: string;
        FramerateNumerator: number;
        FramerateDenominator: 1;
        Width: number;
        Height: number;
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
          Width: number;
          Height: number;
          CodecSettings: {
            Codec: "H_264";
            H264Settings: {
              RateControlMode: "QVBR";
              MaxBitrate: number;
              FramerateControl: "SPECIFIED";
              FramerateNumerator: number;
              FramerateDenominator: 1;
            };
          };
        };
        AudioDescriptions: Array<{
          AudioSourceName: "Audio Selector 1";
          CodecSettings: {
            Codec: "AAC";
            AacSettings: {
              Bitrate: number;
              CodingMode: "CODING_MODE_2_0";
              SampleRate: number;
            };
          };
        }>;
        CaptionDescriptions?: CaptionDescription[];
      }>;
    }>;
  };
}

const CAPTION_SELECTOR_NAME = "SRT Captions" as const;

/** MediaConvertが字幕の日本語フォントを選ぶための言語コードへ変換する。 */
function toMediaConvertCaptionLanguageCode(
  languageCode: string | undefined,
): "JPN" | "ENG" | undefined {
  if (languageCode?.toLowerCase().startsWith("ja")) return "JPN";
  if (languageCode?.toLowerCase().startsWith("en")) return "ENG";
  return undefined;
}

function buildBurnInCaptionDescription(languageCode: string | undefined): CaptionDescription {
  const mediaConvertLanguageCode = toMediaConvertCaptionLanguageCode(languageCode);
  return {
    CaptionSelectorName: CAPTION_SELECTOR_NAME,
    ...(mediaConvertLanguageCode ? { LanguageCode: mediaConvertLanguageCode } : {}),
    DestinationSettings: {
      DestinationType: "BURN_IN",
      BurninDestinationSettings: {
        Alignment: "CENTERED",
        BackgroundColor: "BLACK",
        BackgroundOpacity: 0,
        FontColor: "WHITE",
        FontOpacity: 100,
        // 言語設定からサービス側が適切なフォントスクリプトを選択する。
        FontScript: "AUTOMATIC",
        OutlineColor: "BLACK",
        OutlineSize: 3,
        ShadowColor: "BLACK",
        ShadowOpacity: 50,
        ShadowXOffset: 2,
        ShadowYOffset: 2,
      },
    },
  };
}

/**
 * MediaConvertジョブJSONを構築する。
 * 各ページは静止画+外部WAVのInputとなり、MediaConvertが入力順に連結する。
 */
export function buildMediaConvertJob(params: BuildJobParams): MediaConvertJobSettings {
  const { roleArn, pages, outputDestination, output, captionsSrtS3Uri, captionLanguageCode } =
    params;

  if (output.captions === "burn" && !captionsSrtS3Uri) {
    throw new Error("字幕を焼き込むにはSRTのS3 URIが必要です。");
  }

  const inputs = pages.map((page, index) => ({
    TimecodeSource: "ZEROBASED" as const,
    AudioSelectors: {
      "Audio Selector 1": {
        DefaultSelection: "DEFAULT" as const,
        ExternalAudioFileInput: page.audioS3Uri,
      },
    },
    ...(output.captions === "burn" && index === 0
      ? {
          CaptionSelectors: {
            [CAPTION_SELECTOR_NAME]: {
              SourceSettings: {
                SourceType: "SRT" as const,
                FileSourceSettings: { SourceFile: captionsSrtS3Uri! },
              },
            },
          },
        }
      : {}),
    VideoGenerator: {
      Duration: page.frameAlignedDurationMs,
      ImageInput: page.imageS3Uri,
      FramerateNumerator: output.fps,
      FramerateDenominator: 1 as const,
      Width: output.width,
      Height: output.height,
    },
  }));

  const outputVideo = {
    NameModifier: "-video" as const,
    ContainerSettings: { Container: "MP4" as const, Mp4Settings: {} },
    VideoDescription: {
      Width: output.width,
      Height: output.height,
      CodecSettings: {
        Codec: "H_264" as const,
        H264Settings: {
          RateControlMode: "QVBR" as const,
          MaxBitrate: 5000000,
          FramerateControl: "SPECIFIED" as const,
          FramerateNumerator: output.fps,
          FramerateDenominator: 1 as const,
        },
      },
    },
    AudioDescriptions: [
      {
        AudioSourceName: "Audio Selector 1" as const,
        CodecSettings: {
          Codec: "AAC" as const,
          AacSettings: {
            Bitrate: 96000,
            CodingMode: "CODING_MODE_2_0" as const,
            SampleRate: 48000,
          },
        },
      },
    ],
    ...(output.captions === "burn"
      ? {
          CaptionDescriptions: [buildBurnInCaptionDescription(captionLanguageCode)],
        }
      : {}),
  };

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
          Outputs: [outputVideo],
        },
      ],
    },
  };
}
