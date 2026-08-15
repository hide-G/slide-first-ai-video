import type { Job } from "../api/types.js";

export const SUPPORTED_LOCALES = ["ja", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type MessageParams = {
  "app.title": undefined;
  "app.tagline": undefined;
  "language.switcherLabel": undefined;
  "language.japanese": undefined;
  "language.english": undefined;
  "auth.checking": undefined;
  "auth.logout": undefined;
  "auth.signingOut": undefined;
  "auth.logoutFailed": undefined;
  "common.loading": undefined;
  "common.status": undefined;
  "common.error": undefined;
  "nav.backToProject": undefined;
  "projects.title": undefined;
  "projects.namePlaceholder": undefined;
  "projects.creating": undefined;
  "projects.create": undefined;
  "projects.empty": undefined;
  "project.detailTitle": { id: string };
  "project.videos": undefined;
  "project.slides": undefined;
  "project.slidesStarted": undefined;
  "project.viewVersion": { version: number };
  "project.theme": undefined;
  "project.themePlaceholder": undefined;
  "project.audience": undefined;
  "project.audiencePlaceholder": undefined;
  "project.duration": undefined;
  "project.references": undefined;
  "project.generating": undefined;
  "project.startSlides": undefined;
  "version.title": { version: string };
  "version.notFound": undefined;
  "version.approving": undefined;
  "version.approve": undefined;
  "version.approved": undefined;
  "version.slidesMarkdown": undefined;
  "videos.title": undefined;
  "videos.versionNumber": undefined;
  "videos.generating": undefined;
  "videos.start": undefined;
  "job.status": undefined;
  "deliverables.title": undefined;
  "deliverables.empty": undefined;
  "deliverables.download": { filename: string };
  "deliverables.type": { type: string };
  "markdown.empty": undefined;
  "video.unsupported": undefined;
  "status.notSet": undefined;
  "status.pending": undefined;
  "status.running": undefined;
  "status.succeeded": undefined;
  "status.failed": undefined;
  "status.cancelled": undefined;
  "status.draft": undefined;
  "status.projectCreated": undefined;
  "status.slideGenerating": undefined;
  "status.slideReady": undefined;
  "status.slideApproved": undefined;
  "status.videoGenerating": undefined;
  "status.videoReady": undefined;
  "status.unknown": { status: string };
  "errors.rootNotFound": undefined;
  "errors.runtimeConfigInvalid": undefined;
  "errors.runtimeConfigMissingRequired": undefined;
  "errors.runtimeConfigFetchFailed": { status: number };
  "errors.runtimeConfigInvalidJson": undefined;
  "errors.runtimeConfigUnknown": undefined;
  "errors.applicationStartFailed": undefined;
  "errors.applicationRetryGuidance": undefined;
  "errors.apiEndpointEmpty": undefined;
  "errors.apiEndpointInvalid": undefined;
  "errors.apiRuntimeConfigNotLoaded": undefined;
  "errors.projectsLoad": undefined;
  "errors.projectsCreate": undefined;
  "errors.slidesStart": undefined;
  "errors.versionLoad": undefined;
  "errors.versionApprove": undefined;
  "errors.videosStart": undefined;
  "errors.videosGeneration": undefined;
  "errors.videosStatusCheck": undefined;
  "errors.videosTimeout": undefined;
};

export type MessageKey = keyof MessageParams;

type MessageFormatter<Key extends MessageKey> =
  MessageParams[Key] extends undefined
    ? () => string
    : (params: MessageParams[Key]) => string;

export type MessageCatalog = {
  [Key in MessageKey]: MessageFormatter<Key>;
};

export type MessageArguments<Key extends MessageKey> =
  MessageParams[Key] extends undefined ? [] : [params: MessageParams[Key]];

export type MessageDescriptor = {
  [Key in MessageKey]: MessageParams[Key] extends undefined
    ? { key: Key }
    : { key: Key; params: MessageParams[Key] };
}[MessageKey];

export type Translate = <Key extends MessageKey>(
  key: Key,
  ...args: MessageArguments<Key>
) => string;

export const messages = {
  ja: {
    "app.title": () => "スライド動画生成 | Slide-First AI Video",
    "app.tagline": () => "スライドから動画を自動生成",
    "language.switcherLabel": () => "表示言語",
    "language.japanese": () => "日本語",
    "language.english": () => "English",
    "auth.checking": () => "認証状態を確認しています...",
    "auth.logout": () => "ログアウト",
    "auth.signingOut": () => "ログアウト中...",
    "auth.logoutFailed": () =>
      "ログアウトに失敗しました。時間をおいて再度お試しください。",
    "common.loading": () => "読み込み中...",
    "common.status": () => "状態",
    "common.error": () => "エラー",
    "nav.backToProject": () => "← プロジェクトに戻る",
    "projects.title": () => "プロジェクト",
    "projects.namePlaceholder": () => "プロジェクト名を入力",
    "projects.creating": () => "作成中...",
    "projects.create": () => "プロジェクト作成",
    "projects.empty": () =>
      "プロジェクトがありません。上のフォームから作成してください。",
    "project.detailTitle": ({ id }) => `プロジェクト: ${id}`,
    "project.videos": () => "動画一覧",
    "project.slides": () => "スライド生成",
    "project.slidesStarted": () => "スライド生成を開始しました",
    "project.viewVersion": ({ version }) => `バージョン ${version} を確認`,
    "project.theme": () => "テーマ:",
    "project.themePlaceholder": () => "例: AWS CDK、サーバーレス",
    "project.audience": () => "対象者:",
    "project.audiencePlaceholder": () => "例: エンジニア初心者",
    "project.duration": () => "持ち時間（秒）:",
    "project.references": () => "参照URL（1行に1つ）:",
    "project.generating": () => "生成中...",
    "project.startSlides": () => "スライド生成を開始",
    "version.title": ({ version }) => `バージョン ${version}`,
    "version.notFound": () => "データが見つかりません",
    "version.approving": () => "承認中...",
    "version.approve": () => "このバージョンを承認する",
    "version.approved": () => "✅ 承認済み - 動画生成が可能です",
    "version.slidesMarkdown": () => "スライド（Marp Markdown）",
    "videos.title": () => "動画生成",
    "videos.versionNumber": () => "バージョン番号:",
    "videos.generating": () => "生成中...",
    "videos.start": () => "動画生成を開始",
    "job.status": () => "ジョブ状態",
    "deliverables.title": () => "成果物",
    "deliverables.empty": () => "成果物はまだありません。",
    "deliverables.download": ({ filename }) => `${filename} をダウンロード`,
    "deliverables.type": ({ type }) => `種別: ${type}`,
    "markdown.empty": () => "表示できる内容がありません。",
    "video.unsupported": () => "このブラウザは動画の再生に対応していません。",
    "status.notSet": () => "未設定",
    "status.pending": () => "待機中",
    "status.running": () => "実行中",
    "status.succeeded": () => "完了",
    "status.failed": () => "失敗",
    "status.cancelled": () => "キャンセル",
    "status.draft": () => "下書き",
    "status.projectCreated": () => "作成済み",
    "status.slideGenerating": () => "スライド生成中",
    "status.slideReady": () => "スライド確認待ち",
    "status.slideApproved": () => "スライド承認済み",
    "status.videoGenerating": () => "動画生成中",
    "status.videoReady": () => "動画完成",
    "status.unknown": ({ status }) => `不明な状態（${status}）`,
    "errors.rootNotFound": () => "アプリケーションの描画先が見つかりません。",
    "errors.runtimeConfigInvalid": () => "実行時設定の形式が不正です。",
    "errors.runtimeConfigMissingRequired": () =>
      "実行時設定にAPIまたはCognitoの必須項目がありません。",
    "errors.runtimeConfigFetchFailed": ({ status }) =>
      `実行時設定の取得に失敗しました（HTTP ${status}）。`,
    "errors.runtimeConfigInvalidJson": () =>
      "実行時設定のJSONを解析できませんでした。",
    "errors.runtimeConfigUnknown": () =>
      "実行時設定の取得中に不明なエラーが発生しました。",
    "errors.applicationStartFailed": () =>
      "アプリケーションを開始できませんでした",
    "errors.applicationRetryGuidance": () =>
      "ページを再読み込みし、解決しない場合は管理者に連絡してください。",
    "errors.apiEndpointEmpty": () => "APIエンドポイントが空です。",
    "errors.apiEndpointInvalid": () => "APIエンドポイントの形式が不正です。",
    "errors.apiRuntimeConfigNotLoaded": () =>
      "実行時設定が読み込まれていないため、APIを呼び出せません。",
    "errors.projectsLoad": () => "プロジェクトの読み込みに失敗しました。",
    "errors.projectsCreate": () => "プロジェクトの作成に失敗しました。",
    "errors.slidesStart": () => "スライド生成の開始に失敗しました。",
    "errors.versionLoad": () => "バージョン情報の読み込みに失敗しました。",
    "errors.versionApprove": () => "バージョンの承認に失敗しました。",
    "errors.videosStart": () => "動画生成の開始に失敗しました。",
    "errors.videosGeneration": () => "動画生成に失敗しました。",
    "errors.videosStatusCheck": () => "動画生成の状態確認に失敗しました。",
    "errors.videosTimeout": () => "動画生成が時間内に完了しませんでした。",
  },
  en: {
    "app.title": () => "Slide-First AI Video",
    "app.tagline": () => "Generate videos from slides automatically",
    "language.switcherLabel": () => "Display language",
    "language.japanese": () => "日本語",
    "language.english": () => "English",
    "auth.checking": () => "Checking your authentication status...",
    "auth.logout": () => "Sign out",
    "auth.signingOut": () => "Signing out...",
    "auth.logoutFailed": () => "Could not sign out. Please try again shortly.",
    "common.loading": () => "Loading...",
    "common.status": () => "Status",
    "common.error": () => "Error",
    "nav.backToProject": () => "← Back to project",
    "projects.title": () => "Projects",
    "projects.namePlaceholder": () => "Enter a project name",
    "projects.creating": () => "Creating...",
    "projects.create": () => "Create project",
    "projects.empty": () => "No projects yet. Create one using the form above.",
    "project.detailTitle": ({ id }) => `Project: ${id}`,
    "project.videos": () => "Videos",
    "project.slides": () => "Generate slides",
    "project.slidesStarted": () => "Slide generation has started.",
    "project.viewVersion": ({ version }) => `View version ${version}`,
    "project.theme": () => "Theme:",
    "project.themePlaceholder": () => "Example: AWS CDK, serverless",
    "project.audience": () => "Audience:",
    "project.audiencePlaceholder": () => "Example: entry-level engineers",
    "project.duration": () => "Duration (seconds):",
    "project.references": () => "Reference URLs (one per line):",
    "project.generating": () => "Generating...",
    "project.startSlides": () => "Start slide generation",
    "version.title": ({ version }) => `Version ${version}`,
    "version.notFound": () => "Data was not found.",
    "version.approving": () => "Approving...",
    "version.approve": () => "Approve this version",
    "version.approved": () => "✅ Approved - ready for video generation",
    "version.slidesMarkdown": () => "Slides (Marp Markdown)",
    "videos.title": () => "Generate video",
    "videos.versionNumber": () => "Version number:",
    "videos.generating": () => "Generating...",
    "videos.start": () => "Start video generation",
    "job.status": () => "Job status",
    "deliverables.title": () => "Deliverables",
    "deliverables.empty": () => "No deliverables are available yet.",
    "deliverables.download": ({ filename }) => `Download ${filename}`,
    "deliverables.type": ({ type }) => `Type: ${type}`,
    "markdown.empty": () => "No content is available.",
    "video.unsupported": () =>
      "Your browser does not support the video tag.",
    "status.notSet": () => "Not set",
    "status.pending": () => "Pending",
    "status.running": () => "Running",
    "status.succeeded": () => "Succeeded",
    "status.failed": () => "Failed",
    "status.cancelled": () => "Cancelled",
    "status.draft": () => "Draft",
    "status.projectCreated": () => "Created",
    "status.slideGenerating": () => "Generating slides",
    "status.slideReady": () => "Slides ready for review",
    "status.slideApproved": () => "Slides approved",
    "status.videoGenerating": () => "Generating video",
    "status.videoReady": () => "Video ready",
    "status.unknown": ({ status }) => `Unknown status (${status})`,
    "errors.rootNotFound": () => "The application root element was not found.",
    "errors.runtimeConfigInvalid": () => "The runtime configuration format is invalid.",
    "errors.runtimeConfigMissingRequired": () =>
      "The runtime configuration is missing required API or Cognito values.",
    "errors.runtimeConfigFetchFailed": ({ status }) =>
      `Could not load the runtime configuration (HTTP ${status}).`,
    "errors.runtimeConfigInvalidJson": () =>
      "Could not parse the runtime configuration JSON.",
    "errors.runtimeConfigUnknown": () =>
      "An unknown error occurred while loading the runtime configuration.",
    "errors.applicationStartFailed": () => "Could not start the application",
    "errors.applicationRetryGuidance": () =>
      "Reload the page and contact an administrator if the problem persists.",
    "errors.apiEndpointEmpty": () => "The API endpoint is empty.",
    "errors.apiEndpointInvalid": () => "The API endpoint format is invalid.",
    "errors.apiRuntimeConfigNotLoaded": () =>
      "The runtime configuration has not been loaded, so the API cannot be called.",
    "errors.projectsLoad": () => "Could not load projects.",
    "errors.projectsCreate": () => "Could not create the project.",
    "errors.slidesStart": () => "Could not start slide generation.",
    "errors.versionLoad": () => "Could not load version information.",
    "errors.versionApprove": () => "Could not approve the version.",
    "errors.videosStart": () => "Could not start video generation.",
    "errors.videosGeneration": () => "Video generation failed.",
    "errors.videosStatusCheck": () =>
      "Could not check the video generation status.",
    "errors.videosTimeout": () =>
      "Video generation did not finish within the expected time.",
  },
} satisfies Record<Locale, MessageCatalog>;

export function message<Key extends MessageKey>(
  key: Key,
  ...args: MessageArguments<Key>
): Extract<MessageDescriptor, { key: Key }> {
  return (args.length === 0 ? { key } : { key, params: args[0] }) as Extract<
    MessageDescriptor,
    { key: Key }
  >;
}

export function createTranslate(locale: Locale): Translate {
  return ((key: MessageKey, ...args: unknown[]) => {
    const formatter = messages[locale][key] as (params?: unknown) => string;
    return formatter(args[0]);
  }) as Translate;
}

export function formatMessage(
  locale: Locale,
  descriptor: MessageDescriptor,
): string {
  const formatter = messages[locale][descriptor.key] as (
    params?: unknown,
  ) => string;
  return formatter("params" in descriptor ? descriptor.params : undefined);
}

type StaticStatusMessageKey = Exclude<
  Extract<MessageKey, `status.${string}`>,
  "status.notSet" | "status.unknown"
>;

const statusMessageKeys: Record<string, StaticStatusMessageKey> = {
  PENDING: "status.pending",
  RUNNING: "status.running",
  SUCCEEDED: "status.succeeded",
  FAILED: "status.failed",
  CANCELLED: "status.cancelled",
  DRAFT: "status.draft",
  PROJECT_CREATED: "status.projectCreated",
  SLIDE_GENERATING: "status.slideGenerating",
  SLIDE_READY: "status.slideReady",
  SLIDE_APPROVED: "status.slideApproved",
  VIDEO_GENERATING: "status.videoGenerating",
  VIDEO_READY: "status.videoReady",
};

const jobStatusMessageKeys = {
  PENDING: "status.pending",
  RUNNING: "status.running",
  SUCCEEDED: "status.succeeded",
  FAILED: "status.failed",
  CANCELLED: "status.cancelled",
} as const satisfies Record<Job["status"], StaticStatusMessageKey>;

export function statusMessage(status: string | undefined): MessageDescriptor {
  if (!status) {
    return message("status.notSet");
  }

  const key = statusMessageKeys[status];
  return key ? message(key) : message("status.unknown", { status });
}

export function jobStatusMessage(status: Job["status"]): MessageDescriptor {
  return message(jobStatusMessageKeys[status]);
}
