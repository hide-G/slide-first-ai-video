import type {
  CaptionPlacement,
  CaptionStylePreset,
  VerticalLayout,
} from "@slide-first/shared-types";

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
  verticalLayout?: VerticalLayout | null;
  captionStyle?: CaptionStylePreset | null;
  captionPlacement?: CaptionPlacement | null;
  /** ページ描画が実測した下部セーフエリア内の字幕Y座標。 */
  captionSafeAreaYPosition?: number | null;
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
  /** captions=burnのときに各ページ入力へ渡すSRTのS3 URI。字幕なしページはundefined。 */
  captionsSrtS3Uris?: Array<string | undefined>;
  /** 字幕テキストの言語（BCP 47） */
  captionLanguageCode?: string;
}

type CaptionSourceSettings =
  | {
      SourceType: "SRT";
      FileSourceSettings: { SourceFile: string };
    }
  | {
      SourceType: "NULL";
    };

interface CaptionSelector {
  SourceSettings: CaptionSourceSettings;
}

interface BurninDestinationSettings {
  Alignment: "CENTERED";
  BackgroundColor: "BLACK";
  BackgroundOpacity: number;
  FontColor: "WHITE" | "YELLOW";
  FontOpacity: number;
  FontScript: "AUTOMATIC";
  OutlineColor: "BLACK";
  OutlineSize: number;
  ShadowColor: "BLACK";
  ShadowOpacity: number;
  ShadowXOffset: number;
  ShadowYOffset: number;
  YPosition?: number;
}

interface CaptionDescription {
  CaptionSelectorName: "SRT Captions";
  LanguageCode?: "JPN" | "ENG";
  DestinationSettings: {
    DestinationType: "BURN_IN";
    BurninDestinationSettings: BurninDestinationSettings;
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

interface CaptionStyleConfig {
  backgroundOpacity: number;
  fontColor: "WHITE" | "YELLOW";
  outlineSize: number;
  shadowOpacity: number;
  shadowXOffset: number;
  shadowYOffset: number;
}

/** MediaConvertが受け付ける色・不透明度だけで構成した固定プリセット。 */
const CAPTION_STYLE_CONFIG: Record<CaptionStylePreset, CaptionStyleConfig> = {
  "white-outline": {
    backgroundOpacity: 0,
    fontColor: "WHITE",
    outlineSize: 3,
    shadowOpacity: 50,
    shadowXOffset: 2,
    shadowYOffset: 2,
  },
  "yellow-outline": {
    backgroundOpacity: 0,
    fontColor: "YELLOW",
    outlineSize: 3,
    shadowOpacity: 50,
    shadowXOffset: 2,
    shadowYOffset: 2,
  },
  "black-background": {
    backgroundOpacity: 160,
    fontColor: "WHITE",
    outlineSize: 0,
    shadowOpacity: 0,
    shadowXOffset: 0,
    shadowYOffset: 0,
  },
  chalkboard: {
    // 濃緑はMediaConvertの字幕背景で指定できないため、ページPNGの下部余白を使う。
    backgroundOpacity: 0,
    fontColor: "WHITE",
    outlineSize: 0,
    shadowOpacity: 0,
    shadowXOffset: 0,
    shadowYOffset: 0,
  },
};

/** MediaConvertが字幕の日本語フォントを選ぶための言語コードへ変換する。 */
function toMediaConvertCaptionLanguageCode(
  languageCode: string | undefined,
): "JPN" | "ENG" | undefined {
  if (languageCode?.toLowerCase().startsWith("ja")) return "JPN";
  if (languageCode?.toLowerCase().startsWith("en")) return "ENG";
  return undefined;
}

function resolveCaptionStyle(value: CaptionStylePreset | null | undefined): CaptionStylePreset {
  return value ?? "white-outline";
}

/**
 * ページ描画で実測したコンテンツ下端を基準に、下部セーフエリアの字幕位置を使う。
 * 実測値がない旧マニフェストでは従来どおりMediaConvertの下端配置へフォールバックする。
 */
function resolveSafeAreaYPosition(output: OutputProfile): number | undefined {
  if (
    output.captionPlacement !== "safe-area" ||
    output.verticalLayout !== "top" ||
    output.height <= output.width
  ) {
    return undefined;
  }

  const yPosition = output.captionSafeAreaYPosition;
  return typeof yPosition === "number" && yPosition >= 0 && yPosition < output.height
    ? yPosition
    : undefined;
}

function buildBurnInCaptionDescription(
  languageCode: string | undefined,
  output: OutputProfile,
): CaptionDescription {
  const mediaConvertLanguageCode = toMediaConvertCaptionLanguageCode(languageCode);
  const style = CAPTION_STYLE_CONFIG[resolveCaptionStyle(output.captionStyle)];
  const yPosition = resolveSafeAreaYPosition(output);

  return {
    CaptionSelectorName: CAPTION_SELECTOR_NAME,
    ...(mediaConvertLanguageCode ? { LanguageCode: mediaConvertLanguageCode } : {}),
    DestinationSettings: {
      DestinationType: "BURN_IN",
      BurninDestinationSettings: {
        Alignment: "CENTERED",
        BackgroundColor: "BLACK",
        BackgroundOpacity: style.backgroundOpacity,
        FontColor: style.fontColor,
        FontOpacity: 100,
        // 言語設定からサービス側が適切なフォントスクリプトを選択する。
        FontScript: "AUTOMATIC",
        OutlineColor: "BLACK",
        OutlineSize: style.outlineSize,
        ShadowColor: "BLACK",
        ShadowOpacity: style.shadowOpacity,
        ShadowXOffset: style.shadowXOffset,
        ShadowYOffset: style.shadowYOffset,
        ...(yPosition === undefined ? {} : { YPosition: yPosition }),
      },
    },
  };
}

function buildCaptionSelector(captionSrtS3Uri: string | undefined): CaptionSelector {
  if (!captionSrtS3Uri) {
    return {
      SourceSettings: {
        SourceType: "NULL",
      },
    };
  }

  return {
    SourceSettings: {
      SourceType: "SRT",
      FileSourceSettings: { SourceFile: captionSrtS3Uri },
    },
  };
}

/**
 * MediaConvertジョブJSONを構築する。
 * 各ページは静止画+外部WAVのInputとなり、MediaConvertが入力順に連結する。
 */
export function buildMediaConvertJob(params: BuildJobParams): MediaConvertJobSettings {
  const { roleArn, pages, outputDestination, output, captionsSrtS3Uris, captionLanguageCode } =
    params;

  if (
    output.captions === "burn" &&
    (!captionsSrtS3Uris || captionsSrtS3Uris.length !== pages.length)
  ) {
    throw new Error("字幕を焼き込むには各ページのSRTのS3 URIが必要です。");
  }

  const inputs = pages.map((page, index) => ({
    TimecodeSource: "ZEROBASED" as const,
    AudioSelectors: {
      "Audio Selector 1": {
        DefaultSelection: "DEFAULT" as const,
        ExternalAudioFileInput: page.audioS3Uri,
      },
    },
    ...(output.captions === "burn"
      ? {
          CaptionSelectors: {
            [CAPTION_SELECTOR_NAME]: buildCaptionSelector(captionsSrtS3Uris![index]),
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
          CaptionDescriptions: [buildBurnInCaptionDescription(captionLanguageCode, output)],
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
