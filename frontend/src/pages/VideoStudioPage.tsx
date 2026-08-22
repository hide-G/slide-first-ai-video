import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { StepWizard } from "../components/StepWizard.js";
import { PageList } from "../components/PageList.js";
import { UploadZone } from "../components/UploadZone.js";
import { SsmlToolbar } from "../components/SsmlToolbar.js";
import { SsmlCheatsheet } from "../components/SsmlCheatsheet.js";
import { apiClient } from "../api/client.js";
import {
  extractPdfPageText,
  openPdfDocument,
  renderPdfPagePreview,
  type PdfDocument,
  type PdfPagePreview,
} from "../lib/pdf-preview.js";
import type {
  Artifact,
  AspectRatio,
  DictionaryEntry,
  NarrationMode,
  NarrationPage,
  RenderProgress,
  RenderStageName,
  RenderStatus,
} from "../api/types.js";

const STEPS = [
  { labelKey: "video.stepA" as const },
  { labelKey: "video.stepB" as const },
  { labelKey: "video.stepC" as const },
  { labelKey: "video.stepD" as const },
];

const STAGES: Array<{
  name: RenderStageName;
  labelKey: "video.job1" | "video.job2" | "video.job3" | "video.job4";
}> = [
  { name: "pages", labelKey: "video.job1" },
  { name: "audio", labelKey: "video.job2" },
  { name: "captions", labelKey: "video.job3" },
  { name: "video", labelKey: "video.job4" },
];

const ASPECT_INFO: Record<AspectRatio, { width: number; height: number; css: string }> = {
  "16:9": { width: 1920, height: 1080, css: "16 / 9" },
  "9:16": { width: 1080, height: 1920, css: "9 / 16" },
  "1:1": { width: 1080, height: 1080, css: "1 / 1" },
  "4:5": { width: 1080, height: 1350, css: "4 / 5" },
};

type SubtitleMode = "burn" | "srt" | "none";
type StageState = "wait" | "running" | "done" | "failed";
type VerticalLayout = "top" | "center" | "crop";
type PadColor = "white" | "navy" | "auto";

interface SelectedPagePreview extends PdfPagePreview {
  pageIndex: number;
}

interface NarrationDraftFeedback {
  type: "success" | "error";
  message: string;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "処理に失敗しました。時間をおいて再試行してください。";
}

function voiceLanguageCode(voiceId: string): string {
  return ["Joanna", "Matthew"].includes(voiceId) ? "en-US" : "ja-JP";
}

export function VideoStudioPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromSlide = searchParams.get("from") === "slide";
  const initialProjectId = searchParams.get("projectId");
  const initialRenderId = searchParams.get("renderId");

  const [currentStep, setCurrentStep] = useState(initialRenderId ? 3 : 0);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [renderId, setRenderId] = useState<string | null>(initialRenderId);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isStartingRender, setIsStartingRender] = useState(false);
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false);
  const [narrationDraftFeedback, setNarrationDraftFeedback] =
    useState<NarrationDraftFeedback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [fps, setFps] = useState<30 | 60>(30);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>("burn");
  const [voiceId, setVoiceId] = useState("Takumi");
  const [engine, setEngine] = useState<"neural" | "standard">("neural");
  const [verticalLayout, setVerticalLayout] = useState<VerticalLayout>("top");
  const [verticalBg, setVerticalBg] = useState<PadColor>("white");
  const [safeArea, setSafeArea] = useState(false);
  const [narrationMode, setNarrationMode] = useState<NarrationMode>("spoken");
  const [silentPageDurationSec, setSilentPageDurationSec] = useState<3 | 5 | 8>(5);

  const [narrationPages, setNarrationPages] = useState<NarrationPage[]>([]);
  const [selectedNarrPage, setSelectedNarrPage] = useState(0);
  const [ssmlMode, setSsmlMode] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([
    { word: "", reading: "", method: "sub" },
  ]);
  const [selectedPreview, setSelectedPreview] = useState<SelectedPagePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [stageStates, setStageStates] = useState<StageState[]>(Array(STAGES.length).fill("wait"));
  const [progress, setProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const pdfDocumentRef = useRef<PdfDocument | null>(null);
  const previewRequestRef = useRef(0);
  const uploadRequestRef = useRef(0);
  const subtitleModeBeforeSilentRef = useRef<SubtitleMode>("burn");
  const isVertical = aspect === "9:16" || aspect === "4:5";
  const profile = ASPECT_INFO[aspect];

  const persistRoute = useCallback(
    (nextProjectId: string, nextRenderId?: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("projectId", nextProjectId);
      if (nextRenderId) {
        next.set("renderId", nextRenderId);
      } else {
        next.delete("renderId");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const disposePdfDocument = useCallback(() => {
    const document = pdfDocumentRef.current;
    pdfDocumentRef.current = null;
    if (document) {
      void document.destroy();
    }
  }, []);

  const applyRenderState = useCallback(
    (status: RenderStatus, currentStage?: RenderStageName, progressInfo?: RenderProgress) => {
      const activeStage = progressInfo?.stage ?? currentStage;
      const currentIndex = activeStage
        ? STAGES.findIndex((stage) => stage.name === activeStage)
        : 0;
      const effectiveIndex = currentIndex < 0 ? 0 : currentIndex;

      if (status === "COMPLETED") {
        setStageStates(Array(STAGES.length).fill("done"));
        setProgress(100);
        return;
      }

      if (status === "FAILED") {
        setStageStates(
          STAGES.map((_, index) =>
            index < effectiveIndex ? "done" : index === effectiveIndex ? "failed" : "wait",
          ),
        );
        setProgress((effectiveIndex / STAGES.length) * 100);
        return;
      }

      const pageFraction =
        progressInfo && progressInfo.stage === activeStage && progressInfo.totalPages > 0
          ? Math.min(progressInfo.currentPage / progressInfo.totalPages, 0.95)
          : 0;
      setStageStates(
        STAGES.map((_, index) =>
          index < effectiveIndex ? "done" : index === effectiveIndex ? "running" : "wait",
        ),
      );
      setProgress(Math.min(99, ((effectiveIndex + pageFraction) / STAGES.length) * 100));
    },
    [],
  );

  const startPolling = useCallback(
    (activeProjectId: string, activeRenderId: string) => {
      const poll = async () => {
        try {
          const result = await apiClient.getRender(activeProjectId, activeRenderId);
          if (!mountedRef.current) return;

          setRenderStatus(result.status);
          setRenderProgress(result.progress ?? null);
          applyRenderState(result.status, result.currentStage, result.progress);

          if (result.status === "COMPLETED") {
            const artifactResult = await apiClient.getArtifacts(activeProjectId, activeRenderId);
            if (mountedRef.current) {
              setArtifacts(artifactResult.artifacts);
            }
            return;
          }

          if (result.status === "FAILED") {
            setErrorMessage(
              result.error === "RENDER_FAILED"
                ? "動画の生成に失敗しました。原稿と出力設定を確認して再実行してください。"
                : "動画の生成に失敗しました。時間をおいて再試行してください。",
            );
            return;
          }
        } catch (error) {
          if (mountedRef.current) {
            setErrorMessage(`レンダリング状態を取得できません: ${formatError(error)}`);
          }
        }

        if (mountedRef.current) {
          pollTimerRef.current = window.setTimeout(() => {
            void poll();
          }, 3000);
        }
      };

      void poll();
    },
    [applyRenderState],
  );

  const showPagePreview = useCallback(
    async (pageIndex: number, fileOverride?: File | null): Promise<string> => {
      const file = fileOverride ?? uploadedFile;
      if (!file) {
        throw new Error("このブラウザでPDFを選択してからページを確認してください。");
      }

      const requestId = ++previewRequestRef.current;
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        if (!pdfDocumentRef.current) {
          pdfDocumentRef.current = await openPdfDocument(file);
        }
        const preview = await renderPdfPagePreview(pdfDocumentRef.current, pageIndex + 1);
        if (mountedRef.current && requestId === previewRequestRef.current) {
          setSelectedPreview({ pageIndex, ...preview });
        }
        return preview.text;
      } catch (error) {
        if (mountedRef.current && requestId === previewRequestRef.current) {
          setSelectedPreview(null);
          setPreviewError(`ページプレビューを表示できません: ${formatError(error)}`);
        }
        throw error;
      } finally {
        if (mountedRef.current && requestId === previewRequestRef.current) {
          setIsPreviewLoading(false);
        }
      }
    },
    [uploadedFile],
  );

  function selectNarrationPage(pageIndex: number) {
    setSelectedNarrPage(pageIndex);
    setNarrationDraftFeedback(null);
    setSsmlMode(narrationPages[pageIndex]?.mode === "ssml");
    void showPagePreview(pageIndex).catch(() => undefined);
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      disposePdfDocument();
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [disposePdfDocument]);

  useEffect(() => {
    if (!projectId || !renderId) return;
    setCurrentStep(3);
    startPolling(projectId, renderId);
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [projectId, renderId, startPolling]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!isPdf(file)) {
        setErrorMessage("PDFファイルを選択してください。");
        return;
      }

      const requestId = ++uploadRequestRef.current;
      setErrorMessage(null);
      setNoticeMessage(null);
      setNarrationDraftFeedback(null);
      setIsUploading(true);
      setSourceReady(false);
      setSelectedPreview(null);
      setPreviewError(null);
      disposePdfDocument();
      try {
        let activeProjectId = projectId;
        if (!activeProjectId) {
          const created = await apiClient.createProject({
            title: file.name.replace(/\.pdf$/i, "") || "動画プロジェクト",
            contentLanguage: "ja-JP",
            kind: "video",
          });
          activeProjectId = created.project.projectId;
          setProjectId(activeProjectId);
          persistRoute(activeProjectId);
        }

        const upload = await apiClient.getSourceUploadUrl(activeProjectId, {
          fileName: file.name,
          contentType: "application/pdf",
        });
        await apiClient.uploadToPresignedUrl(upload.uploadUrl, file);
        const registered = await apiClient.registerSource(activeProjectId, {
          kind: "uploaded",
          fileKey: upload.fileKey,
          fileName: file.name,
        });

        if (!mountedRef.current || requestId !== uploadRequestRef.current) return;

        const extractedTexts: string[] = [];
        try {
          const document = await openPdfDocument(file);
          if (!mountedRef.current || requestId !== uploadRequestRef.current) {
            void document.destroy();
            return;
          }
          pdfDocumentRef.current = document;
          for (let pageIndex = 0; pageIndex < registered.source.pageCount; pageIndex += 1) {
            try {
              extractedTexts.push(await extractPdfPageText(document, pageIndex + 1));
            } catch {
              // 画像だけのページなど、本文を取得できないページは空の原稿として残す。
              extractedTexts.push("");
            }
          }
        } catch {
          extractedTexts.push(...Array<string>(registered.source.pageCount).fill(""));
          setPreviewError("PDF本文を自動抽出できませんでした。原稿欄へ直接入力してください。");
        }

        if (!mountedRef.current || requestId !== uploadRequestRef.current) return;
        setUploadedFile(file);
        setSourceReady(true);
        setPageCount(registered.source.pageCount);
        setNarrationPages(
          Array.from({ length: registered.source.pageCount }, (_, pageIndex) => ({
            pageIndex,
            mode: "plain" as const,
            script: extractedTexts[pageIndex] ?? "",
            origin: "pdf-extracted" as const,
          })),
        );
        setSelectedNarrPage(0);
        setNarrationMode("spoken");
        setSubtitleMode("burn");
        subtitleModeBeforeSilentRef.current = "burn";
        setNoticeMessage(
          `${registered.source.pageCount}ページのPDFを読み込み、抽出できた本文を各ページの原稿欄へ入力しました。内容を確認・編集してから動画を生成してください。`,
        );
        void showPagePreview(0, file).catch(() => undefined);
      } catch (error) {
        if (requestId === uploadRequestRef.current) {
          setErrorMessage(`PDFのアップロードに失敗しました: ${formatError(error)}`);
        }
      } finally {
        if (mountedRef.current && requestId === uploadRequestRef.current) {
          setIsUploading(false);
        }
      }
    },
    [disposePdfDocument, persistRoute, projectId, showPagePreview],
  );

  function updateNarrationScript(text: string) {
    setNarrationDraftFeedback(null);
    setNarrationPages((previous) =>
      previous.map((page, index) =>
        index === selectedNarrPage ? { ...page, script: text, origin: "user" } : page,
      ),
    );
  }

  function updateNarrationMode(mode: "plain" | "ssml") {
    setSsmlMode(mode === "ssml");
    setNarrationPages((previous) =>
      previous.map((page, index) => (index === selectedNarrPage ? { ...page, mode } : page)),
    );
  }

  function selectNarrationMode(mode: NarrationMode) {
    setNarrationMode(mode);
    setErrorMessage(null);
    if (mode === "none") {
      subtitleModeBeforeSilentRef.current = subtitleMode;
      setSubtitleMode("none");
      return;
    }
    setSubtitleMode(subtitleModeBeforeSilentRef.current);
  }

  async function handleGenerateNarrationDraft() {
    if (!projectId || !sourceReady) {
      const message = "先にPDFをアップロードしてください。";
      setNarrationDraftFeedback({ type: "error", message });
      setErrorMessage(message);
      return;
    }

    const currentPage = narrationPages[selectedNarrPage];
    if (!currentPage) return;
    if (currentPage.origin === "user" && currentPage.script.trim()) {
      setNarrationDraftFeedback({
        type: "error",
        message:
          "編集済みの原稿は保護されています。AI案を使う場合は、原稿欄を空にしてから実行してください。",
      });
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setNarrationDraftFeedback(null);
    setIsGeneratingNarration(true);
    try {
      const pageText =
        selectedPreview?.pageIndex === selectedNarrPage
          ? selectedPreview.text
          : await showPagePreview(selectedNarrPage);
      if (!pageText.trim()) {
        throw new Error(
          "このPDFページからテキストを抽出できませんでした。画像だけのPDFでは手入力で原稿を作成してください。",
        );
      }

      const generated = await apiClient.generateNarration(projectId, {
        pageNumber: selectedNarrPage + 1,
        pageText: pageText.slice(0, 12000),
      });
      setNarrationPages((previous) =>
        previous.map((page, index) =>
          index === selectedNarrPage
            ? {
                ...page,
                mode: generated.script.mode,
                script: generated.script.text,
                origin: "ai",
              }
            : page,
        ),
      );
      setSsmlMode(generated.script.mode === "ssml");
      const message = `${selectedNarrPage + 1}ページ目にAIナレーション案を挿入しました。内容を確認・編集してから動画を生成してください。`;
      setNarrationDraftFeedback({ type: "success", message });
      setNoticeMessage(message);
    } catch (error) {
      const message = `AIナレーション案を作成できません: ${formatError(error)}`;
      setNarrationDraftFeedback({ type: "error", message });
      setErrorMessage(message);
    } finally {
      if (mountedRef.current) setIsGeneratingNarration(false);
    }
  }

  function addDictionaryRow() {
    setDictionary((previous) => [...previous, { word: "", reading: "", method: "sub" }]);
  }

  function updateDictionaryRow(index: number, field: keyof DictionaryEntry, value: string) {
    setDictionary((previous) =>
      previous.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  }

  function removeDictionaryRow(index: number) {
    setDictionary((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleGenerate() {
    if (!projectId || !sourceReady || pageCount < 1) {
      setErrorMessage("先にPDFをアップロードしてください。");
      setCurrentStep(0);
      return;
    }

    if (narrationMode === "spoken") {
      const emptyPage = narrationPages.find((page) => !page.script.trim());
      if (emptyPage) {
        setErrorMessage(
          `${emptyPage.pageIndex + 1}ページ目の読み上げ原稿を入力するか、ページごとのAI案を作成してください。ナレーションなし動画を選ぶこともできます。`,
        );
        setCurrentStep(2);
        return;
      }
    }

    setErrorMessage(null);
    setNoticeMessage(null);
    setIsStartingRender(true);
    setCurrentStep(3);
    setArtifacts([]);
    setRenderStatus("RUNNING");
    setRenderProgress(null);
    setStageStates(Array(STAGES.length).fill("wait"));
    setProgress(0);

    try {
      await apiClient.updateOutput(projectId, {
        aspect,
        width: profile.width,
        height: profile.height,
        fps,
        captions: narrationMode === "none" ? "none" : subtitleMode,
        verticalLayout: isVertical ? verticalLayout : null,
        padColor: isVertical ? verticalBg : null,
        narrationMode,
        silentPageDurationSec,
      });

      if (narrationMode === "spoken") {
        await apiClient.updateNarration(projectId, {
          scripts: narrationPages.map((page) => ({
            pageNumber: page.pageIndex + 1,
            mode: page.mode,
            text: page.script,
          })),
          lexicon: dictionary
            .filter((entry) => entry.word.trim() && entry.reading.trim())
            .map((entry) => ({
              written: entry.word.trim(),
              reading: entry.reading.trim(),
              method: entry.method,
            })),
          voice: {
            id: voiceId,
            engine,
            languageCode: voiceLanguageCode(voiceId),
            sampleRate: "16000",
          },
        });
      }

      const started = await apiClient.startRender(projectId);
      setRenderId(started.renderId);
      persistRoute(projectId, started.renderId);
      applyRenderState(started.status, "pages");
    } catch (error) {
      setRenderStatus("FAILED");
      setErrorMessage(`動画の生成を開始できません: ${formatError(error)}`);
    } finally {
      setIsStartingRender(false);
    }
  }

  function handleDownload(kind: "mp4" | "srt" | "audio") {
    const artifact = artifacts.find((item) => {
      if (kind === "mp4") return item.key.toLowerCase().endsWith(".mp4");
      if (kind === "srt") return item.key.toLowerCase().endsWith(".srt");
      return item.key.includes("/audio/") && item.key.toLowerCase().endsWith(".wav");
    });

    if (!artifact) {
      setErrorMessage("ダウンロード可能な成果物がまだありません。");
      return;
    }
    window.location.assign(artifact.url);
  }

  const currentNarrationPage = narrationPages[selectedNarrPage];
  const charCount = useMemo(
    () => (currentNarrationPage?.script ?? "").replace(/<[^>]*>/g, "").length,
    [currentNarrationPage],
  );
  const estimatedSeconds = (charCount / 7).toFixed(1);
  const videoArtifact = artifacts.find((artifact) => artifact.key.toLowerCase().endsWith(".mp4"));
  const srtArtifact = artifacts.find((artifact) => artifact.key.toLowerCase().endsWith(".srt"));
  const audioArtifact = artifacts.find(
    (artifact) => artifact.key.includes("/audio/") && artifact.key.toLowerCase().endsWith(".wav"),
  );

  const pagePreview = (
    <div className="card" style={{ marginTop: 0 }}>
      <h3>選択ページのサムネイル</h3>
      {isPreviewLoading && <p className="hint">PDFページを描画しています...</p>}
      {previewError && <p className="note note-warn">{previewError}</p>}
      {selectedPreview ? (
        <>
          <img
            src={selectedPreview.imageDataUrl}
            alt={`${selectedPreview.pageIndex + 1}ページ目のサムネイル`}
            style={{
              width: "100%",
              maxHeight: 440,
              objectFit: "contain",
              background: "#f4f4f5",
              borderRadius: 4,
            }}
          />
          <details style={{ marginTop: 12 }}>
            <summary>抽出テキストを確認</summary>
            <p className="hint" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {selectedPreview.text || "このページからテキストを抽出できませんでした。"}
            </p>
          </details>
        </>
      ) : (
        <p className="hint">ページを選ぶと、このブラウザ内でサムネイルを表示します。</p>
      )}
    </div>
  );

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t("video.heading")}</h1>
        <p>{t("video.lead")}</p>
      </div>

      {errorMessage && (
        <p className="note note-warn" role="alert">
          {errorMessage}
        </p>
      )}
      {noticeMessage && (
        <p className="note" role="status">
          {noticeMessage}
        </p>
      )}

      <StepWizard steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />

      {currentStep === 0 && (
        <section className="step-panel">
          {fromSlide && (
            <div className="card">
              <h2>{t("video.handoffTitle")}</h2>
              <p className="note">{t("video.handoffNote")}</p>
            </div>
          )}

          <div className="card">
            <h2>{t("video.uploadTitle")}</h2>
            <p className="card-sub">
              PDFのみ対応します。アップロード後にサーバー側で正確なページ数を取得します。
            </p>
            <UploadZone
              onFileSelect={(file) => {
                void handleFileSelect(file);
              }}
              accept=".pdf,application/pdf"
            />
            {isUploading && (
              <p className="hint">PDFをアップロードしてページ数を確認しています...</p>
            )}
            {uploadedFile && (
              <p style={{ marginTop: 8 }}>
                {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <p className="note note-warn" style={{ marginTop: 16 }}>
              {t("video.independentNote")}
            </p>
          </div>

          {sourceReady && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 2fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div className="card">
                <h2>{t("video.pagesTitle")}</h2>
                <p className="card-sub">{t("video.pagesSub")}</p>
                <div
                  className="thumb-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                    gap: 8,
                  }}
                >
                  {Array.from({ length: pageCount }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-pressed={selectedNarrPage === index}
                      onClick={() => selectNarrationPage(index)}
                      style={{
                        minHeight: 56,
                        borderColor: selectedNarrPage === index ? "#2563eb" : undefined,
                      }}
                    >
                      Page {index + 1}
                    </button>
                  ))}
                </div>
              </div>
              {pagePreview}
            </div>
          )}

          <div className="step-actions">
            <button
              type="button"
              className="btn btn-ghost spacer"
              onClick={() => navigate("/home")}
            >
              {t("common.backHome")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!sourceReady || isUploading}
              onClick={() => setCurrentStep(1)}
            >
              {t("video.toSettings")}
            </button>
          </div>
        </section>
      )}

      {currentStep === 1 && (
        <section className="step-panel">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            <div>
              <div className="card">
                <h2>{t("video.sizeTitle")}</h2>
                <p className="card-sub">{t("video.sizeSub")}</p>
                <fieldset className="option-cards">
                  <legend className="visually-hidden">{t("video.sizeLegend")}</legend>
                  {(["16:9", "9:16", "1:1", "4:5"] as AspectRatio[]).map((candidate) => (
                    <label key={candidate} className="option-card">
                      <input
                        type="radio"
                        name="aspect"
                        value={candidate}
                        checked={aspect === candidate}
                        onChange={() => setAspect(candidate)}
                      />
                      <span>
                        <strong>
                          {candidate === "16:9"
                            ? t("video.size169")
                            : candidate === "9:16"
                              ? t("video.size916")
                              : candidate === "1:1"
                                ? t("video.size11")
                                : t("video.size45")}
                        </strong>
                        <span>
                          {ASPECT_INFO[candidate].width}×{ASPECT_INFO[candidate].height}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {isVertical && (
                  <div>
                    <p className="note">{t("video.verticalNote")}</p>
                    <div className="grid-2">
                      <div className="field">
                        <label htmlFor="v-layout">{t("video.vLayout")}</label>
                        <select
                          id="v-layout"
                          value={verticalLayout}
                          onChange={(event) =>
                            setVerticalLayout(event.target.value as VerticalLayout)
                          }
                        >
                          <option value="top">{t("video.vLayout1")}</option>
                          <option value="center">{t("video.vLayout2")}</option>
                          <option value="crop">{t("video.vLayout3")}</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="v-bg">{t("video.vBg")}</label>
                        <select
                          id="v-bg"
                          value={verticalBg}
                          onChange={(event) => setVerticalBg(event.target.value as PadColor)}
                        >
                          <option value="white">{t("video.vBg1")}</option>
                          <option value="navy">{t("video.vBg2")}</option>
                          <option value="auto">{t("video.vBg3")}</option>
                        </select>
                      </div>
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={safeArea}
                        onChange={(event) => setSafeArea(event.target.checked)}
                      />
                      <span>{t("video.safeArea")}</span>
                    </label>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="fps">{t("video.fps")}</label>
                  <select
                    id="fps"
                    value={fps}
                    onChange={(event) => setFps(Number(event.target.value) as 30 | 60)}
                  >
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </div>
              </div>

              <div className="card">
                <h2>{t("video.subtitleTitle")}</h2>
                <fieldset className="option-cards">
                  <legend className="visually-hidden">{t("video.subtitleLegend")}</legend>
                  {(["burn", "srt", "none"] as SubtitleMode[]).map((mode) => (
                    <label key={mode} className="option-card">
                      <input
                        type="radio"
                        name="subtitle"
                        value={mode}
                        checked={subtitleMode === mode}
                        disabled={narrationMode === "none"}
                        onChange={() => {
                          setSubtitleMode(mode);
                          if (narrationMode === "spoken") {
                            subtitleModeBeforeSilentRef.current = mode;
                          }
                        }}
                      />
                      <span>
                        <strong>
                          {mode === "burn"
                            ? t("video.subBurn")
                            : mode === "srt"
                              ? t("video.subSrt")
                              : t("video.subNone")}
                        </strong>
                        <span>
                          {mode === "burn"
                            ? t("video.subBurnHint")
                            : mode === "srt"
                              ? t("video.subSrtHint")
                              : t("video.subNoneHint")}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {narrationMode === "none" ? (
                  <p className="hint">ナレーションなし動画では字幕も生成しません。</p>
                ) : (
                  subtitleMode === "burn" && (
                    <p className="hint">字幕はMediaConvertで映像に焼き込みます。</p>
                  )
                )}
              </div>

              <div className="card">
                <h2>{t("video.voiceTitle")}</h2>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="voice-id">{t("video.voiceId")}</label>
                    <select
                      id="voice-id"
                      value={voiceId}
                      disabled={narrationMode === "none"}
                      onChange={(event) => setVoiceId(event.target.value)}
                    >
                      <option value="Takumi">Takumi (ja-JP)</option>
                      <option value="Kazuha">Kazuha (ja-JP)</option>
                      <option value="Tomoko">Tomoko (ja-JP)</option>
                      <option value="Joanna">Joanna (en-US)</option>
                      <option value="Matthew">Matthew (en-US)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="voice-engine">{t("video.engine")}</label>
                    <select
                      id="voice-engine"
                      value={engine}
                      disabled={narrationMode === "none"}
                      onChange={(event) => setEngine(event.target.value as "neural" | "standard")}
                    >
                      <option value="neural">neural</option>
                      <option value="standard">standard</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sample-rate">{t("video.sampleRate")}</label>
                    <select id="sample-rate" value="16000" disabled>
                      <option value="16000">16000 Hz</option>
                    </select>
                    <span className="hint">PCM/WAV互換の16000 Hzを使用します。</span>
                  </div>
                </div>
              </div>
            </div>

            <aside className="card preview-col">
              <h3>{t("video.previewTitle")}</h3>
              <div
                className="preview-frame"
                style={{
                  aspectRatio: profile.css,
                  background: "#e0e0e0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 4,
                  width: "100%",
                }}
              >
                <div>{t("video.previewSlide")}</div>
                {narrationMode === "spoken" && subtitleMode !== "none" && (
                  <p style={{ fontSize: "0.8em", marginTop: 8 }}>{t("video.previewCaption")}</p>
                )}
              </div>
              <p className="preview-meta" style={{ textAlign: "center", marginTop: 8 }}>
                {profile.width}×{profile.height} / {fps} fps
              </p>
            </aside>
          </div>

          <div className="step-actions">
            <button
              type="button"
              className="btn btn-ghost spacer"
              onClick={() => setCurrentStep(0)}
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!sourceReady}
              onClick={() => setCurrentStep(2)}
            >
              {t("video.toNarration")}
            </button>
          </div>
        </section>
      )}

      {currentStep === 2 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("video.narrTitle")}</h2>
            <p className="card-sub">
              原稿を作るか、ナレーションなし動画を選択します。AI案は必要なページだけに挿入できます。
            </p>
            <fieldset
              className="option-cards"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
            >
              <legend>ナレーション設定</legend>
              <label className="option-card">
                <input
                  type="radio"
                  name="narration-mode"
                  checked={narrationMode === "spoken"}
                  onChange={() => selectNarrationMode("spoken")}
                />
                <span>
                  <strong>ナレーションあり</strong>
                  <span>ページごとの原稿を手入力またはAI案で作成します。</span>
                </span>
              </label>
              <label className="option-card">
                <input
                  type="radio"
                  name="narration-mode"
                  checked={narrationMode === "none"}
                  onChange={() => selectNarrationMode("none")}
                />
                <span>
                  <strong>ナレーションなし</strong>
                  <span>原稿・音声・字幕を使わず、各ページを一定時間表示します。</span>
                </span>
              </label>
            </fieldset>
          </div>

          {narrationMode === "none" ? (
            <div className="card">
              <h2>無音動画の表示時間</h2>
              <p className="card-sub">
                各ページを同じ時間表示します。音声合成と字幕生成は実行しません。
              </p>
              <div className="field" style={{ maxWidth: 280 }}>
                <label htmlFor="silent-page-duration">1ページあたりの表示時間</label>
                <select
                  id="silent-page-duration"
                  value={silentPageDurationSec}
                  onChange={(event) =>
                    setSilentPageDurationSec(Number(event.target.value) as 3 | 5 | 8)
                  }
                >
                  <option value={3}>3秒</option>
                  <option value={5}>5秒</option>
                  <option value={8}>8秒</option>
                </select>
              </div>
              <p className="note">
                {pageCount}ページで約{pageCount * silentPageDurationSec}秒の無音動画になります。
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 2fr)",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                <div className="card">
                  <h3>{t("video.pageListTitle")}</h3>
                  <PageList
                    items={narrationPages.map((page, index) => ({
                      label: `Page ${index + 1}`,
                      duration: `~${(page.script.replace(/<[^>]*>/g, "").length / 7).toFixed(1)}s`,
                    }))}
                    selectedIndex={selectedNarrPage}
                    onSelect={selectNarrationPage}
                  />
                </div>
                {pagePreview}
              </div>

              <div className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3>{selectedNarrPage + 1}ページ目の読み上げ原稿</h3>
                    <p className="card-sub">
                      PDFから抽出した本文を初期入力しています。内容を確認・編集するか、AI案に置き換えます。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={isGeneratingNarration}
                    onClick={() => {
                      void handleGenerateNarrationDraft();
                    }}
                  >
                    {isGeneratingNarration
                      ? "AI案を作成しています..."
                      : "このページにAIナレーション案を挿入"}
                  </button>
                </div>
                {narrationDraftFeedback && (
                  <p
                    className={narrationDraftFeedback.type === "error" ? "note note-warn" : "note"}
                    role={narrationDraftFeedback.type === "error" ? "alert" : "status"}
                  >
                    {narrationDraftFeedback.message}
                  </p>
                )}
                {currentNarrationPage?.origin === "pdf-extracted" && (
                  <p className="hint">
                    PDFから抽出した初期原稿です。AI案を実行すると、このページの原稿を置き換えます。
                  </p>
                )}
                <fieldset
                  className="option-cards"
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
                >
                  <legend>{t("video.inputMode")}</legend>
                  <label className="option-card">
                    <input
                      type="radio"
                      checked={!ssmlMode}
                      onChange={() => updateNarrationMode("plain")}
                    />
                    <span>
                      <strong>{t("video.modePlain")}</strong>
                      <span>{t("video.modePlainHint")}</span>
                    </span>
                  </label>
                  <label className="option-card">
                    <input
                      type="radio"
                      checked={ssmlMode}
                      onChange={() => updateNarrationMode("ssml")}
                    />
                    <span>
                      <strong>{t("video.modeSsml")}</strong>
                      <span>{t("video.modeSsmlHint")}</span>
                    </span>
                  </label>
                </fieldset>
                <div className="field">
                  <label htmlFor="narr-text">{t("video.script")}</label>
                  <SsmlToolbar
                    engine={engine}
                    ssmlMode={ssmlMode}
                    onInsert={(text) =>
                      updateNarrationScript((currentNarrationPage?.script ?? "") + text)
                    }
                    onCheatsheetToggle={() => setCheatsheetOpen((open) => !open)}
                    cheatsheetOpen={cheatsheetOpen}
                  />
                  <textarea
                    id="narr-text"
                    className="code"
                    rows={10}
                    value={currentNarrationPage?.script ?? ""}
                    onChange={(event) => updateNarrationScript(event.target.value)}
                  />
                  <div
                    className="counter"
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>{charCount} chars</span>
                    <span>~{estimatedSeconds}s</span>
                  </div>
                  <span className="hint">{t("video.estHint")}</span>
                </div>
                {ssmlMode && <p className="note note-warn">{t("video.ssmlNote")}</p>}
              </div>

              <div className="card">
                <h2>{t("video.dictTitle")}</h2>
                <p className="card-sub">{t("video.dictSub")}</p>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("video.dictWord")}</th>
                      <th>{t("video.dictRead")}</th>
                      <th>{t("video.dictMethod")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dictionary.map((row, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            value={row.word}
                            onChange={(event) =>
                              updateDictionaryRow(index, "word", event.target.value)
                            }
                            aria-label={t("video.dictWord")}
                          />
                        </td>
                        <td>
                          <input
                            value={row.reading}
                            onChange={(event) =>
                              updateDictionaryRow(index, "reading", event.target.value)
                            }
                            aria-label={t("video.dictRead")}
                          />
                        </td>
                        <td>
                          <select
                            value={row.method}
                            onChange={(event) =>
                              updateDictionaryRow(index, "method", event.target.value)
                            }
                            aria-label={t("video.dictMethod")}
                          >
                            <option value="sub">{t("video.dictSubTag")}</option>
                            <option value="phoneme">{t("video.dictPhonemeTag")}</option>
                            <option value="spell">{t("video.dictSpellTag")}</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removeDictionaryRow(index)}
                            disabled={dictionary.length === 1}
                          >
                            {t("common.remove")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={addDictionaryRow}
                >
                  {t("video.dictAdd")}
                </button>
              </div>
            </>
          )}

          <div className="step-actions">
            <button
              type="button"
              className="btn btn-ghost spacer"
              onClick={() => setCurrentStep(1)}
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isStartingRender}
              onClick={() => {
                void handleGenerate();
              }}
            >
              {isStartingRender ? "生成を開始しています..." : t("video.generate")}
            </button>
          </div>
          {narrationMode === "spoken" && (
            <SsmlCheatsheet
              engine={engine}
              open={cheatsheetOpen}
              onClose={() => setCheatsheetOpen(false)}
              onInsert={(text) =>
                updateNarrationScript((currentNarrationPage?.script ?? "") + text)
              }
            />
          )}
        </section>
      )}

      {currentStep === 3 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("video.jobTitle")}</h2>
            <p className="card-sub">{t("video.jobSub")}</p>
            <ol className="progress-list" style={{ listStyle: "none", padding: 0 }}>
              {STAGES.map((stage, index) => (
                <li
                  key={stage.name}
                  data-state={stageStates[index]}
                  style={{ padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8em",
                      background:
                        stageStates[index] === "done"
                          ? "#22c55e"
                          : stageStates[index] === "running"
                            ? "#3b82f6"
                            : stageStates[index] === "failed"
                              ? "#dc2626"
                              : "#e5e7eb",
                      color: stageStates[index] === "wait" ? "#666" : "white",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span>{t(stage.labelKey)}</span>
                </li>
              ))}
            </ol>
            <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8, marginTop: 16 }}>
              <div
                style={{
                  background: renderStatus === "FAILED" ? "#dc2626" : "#3b82f6",
                  height: "100%",
                  borderRadius: 4,
                  width: `${progress}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <p className="hint">
              {renderStatus === "COMPLETED"
                ? "完了"
                : renderStatus === "FAILED"
                  ? "失敗"
                  : renderProgress
                    ? `${renderProgress.message}（ページ ${renderProgress.currentPage}/${renderProgress.totalPages}）`
                    : renderStatus === "RUNNING"
                      ? "レンダリングを開始しています。ブラウザを閉じても、トップ画面から進捗を確認できます。"
                      : t("video.jobWaiting")}
            </p>
          </div>

          {renderStatus === "COMPLETED" && (
            <div className="card">
              <h2>{t("video.resultTitle")}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div className="preview-wrap">
                  {videoArtifact ? (
                    <video
                      controls
                      src={videoArtifact.url}
                      style={{ width: "100%", borderRadius: 4 }}
                    />
                  ) : (
                    <p className="note">動画成果物を取得しています...</p>
                  )}
                </div>
                <div>
                  <table className="table">
                    <tbody>
                      <tr>
                        <th>{t("video.resFile")}</th>
                        <td>
                          {videoArtifact?.downloadName ??
                            videoArtifact?.key.split("/").pop() ??
                            "-"}
                        </td>
                      </tr>
                      <tr>
                        <th>{t("video.resPages")}</th>
                        <td>{pageCount || "-"}</td>
                      </tr>
                      <tr>
                        <th>{t("video.resVideo")}</th>
                        <td>
                          H.264 / {fps}fps / {profile.width}×{profile.height}
                        </td>
                      </tr>
                      <tr>
                        <th>{t("video.resAudio")}</th>
                        <td>
                          {narrationMode === "none"
                            ? "ナレーションなし（無音トラック）"
                            : `AAC / ${voiceId} / ${engine}`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!videoArtifact}
                      onClick={() => handleDownload("mp4")}
                    >
                      {t("video.dlMp4")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!srtArtifact}
                      onClick={() => handleDownload("srt")}
                    >
                      {t("video.dlSrt")}
                    </button>
                    {narrationMode === "spoken" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!audioArtifact}
                        onClick={() => handleDownload("audio")}
                      >
                        {t("video.dlAudio")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="step-actions">
            <button
              type="button"
              className="btn btn-ghost spacer"
              onClick={() => setCurrentStep(2)}
            >
              {t("video.backNarration")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/home")}>
              {t("common.backHome")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
