import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { StepWizard } from "../components/StepWizard.js";
import { CostTable } from "../components/CostTable.js";
import { PageList } from "../components/PageList.js";
import { UploadZone } from "../components/UploadZone.js";
import { SsmlToolbar, getUnsupportedTags } from "../components/SsmlToolbar.js";
import { SsmlCheatsheet } from "../components/SsmlCheatsheet.js";
import { apiClient } from "../api/client.js";
import type { CostEntry, DictionaryEntry, NarrationPage } from "../api/types.js";

const STEPS = [
  { labelKey: "video.stepA" as const },
  { labelKey: "video.stepB" as const },
  { labelKey: "video.stepC" as const },
  { labelKey: "video.stepD" as const },
];

type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
type SubtitleMode = "burn" | "srt" | "none";

const ASPECT_INFO: Record<AspectRatio, { dim: string; css: string }> = {
  "16:9": { dim: "1920x1080 / 16:9", css: "16 / 9" },
  "9:16": { dim: "1080x1920 / 9:16", css: "9 / 16" },
  "1:1": { dim: "1080x1080 / 1:1", css: "1 / 1" },
  "4:5": { dim: "1080x1350 / 4:5", css: "4 / 5" },
};

const STAGE_NAMES = ["video.job1", "video.job2", "video.job3", "video.job4", "video.job5"] as const;

export function VideoStudioPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromSlide = searchParams.get("from") === "slide";
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(5);

  // Step 2 state
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [fps, setFps] = useState<"30" | "60">("30");
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>("burn");
  const [subtitleSize, setSubtitleSize] = useState("M");
  const [subtitlePos, setSubtitlePos] = useState("bottom");
  const [voiceId, setVoiceId] = useState("Takumi");
  const [engine, setEngine] = useState<"neural" | "standard">("neural");
  const [sampleRate, setSampleRate] = useState("24000");
  const [speechRate, setSpeechRate] = useState("100");
  const [verticalLayout, setVerticalLayout] = useState("top");
  const [verticalBg, setVerticalBg] = useState("white");
  const [safeArea, setSafeArea] = useState(false);

  // Step 3 state
  const [narrationPages, setNarrationPages] = useState<NarrationPage[]>(() =>
    Array.from({ length: pageCount }, (_, i) => ({ pageIndex: i, mode: "plain" as const, script: "" })),
  );
  const [selectedNarrPage, setSelectedNarrPage] = useState(0);
  const [ssmlMode, setSsmlMode] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([
    { word: "", reading: "", method: "sub" },
  ]);

  // Step 4 state
  const [stageStates, setStageStates] = useState<("wait" | "running" | "done" | "failed")[]>(
    Array(5).fill("wait"),
  );
  const [progress, setProgress] = useState(0);
  const [renderComplete, setRenderComplete] = useState(false);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [totalCost, setTotalCost] = useState("-");

  const isVertical = aspect === "9:16" || aspect === "4:5";

  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file);
    // In real impl, would upload and get page count
    setPageCount(5);
    setNarrationPages(Array.from({ length: 5 }, (_, i) => ({ pageIndex: i, mode: "plain" as const, script: "" })));
  }, []);

  function handleVoiceTest() {
    window.alert("Voice test would play audio here");
  }

  function updateNarrationScript(text: string) {
    setNarrationPages((prev) =>
      prev.map((p, i) => (i === selectedNarrPage ? { ...p, script: text } : p)),
    );
  }

  function updateNarrationMode(mode: "plain" | "ssml") {
    setSsmlMode(mode === "ssml");
    setNarrationPages((prev) =>
      prev.map((p, i) => (i === selectedNarrPage ? { ...p, mode } : p)),
    );
  }

  function handleSsmlInsert(text: string) {
    const currentScript = narrationPages[selectedNarrPage]?.script ?? "";
    updateNarrationScript(currentScript + text);
  }

  function addDictRow() {
    setDictionary((prev) => [...prev, { word: "", reading: "", method: "sub" }]);
  }

  function removeDictRow(index: number) {
    setDictionary((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDictRow(index: number, field: keyof DictionaryEntry, value: string) {
    setDictionary((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  async function handleGenerate() {
    setCurrentStep(3);
    // Simulate generation progress
    for (let i = 0; i < 5; i++) {
      setStageStates((prev) => prev.map((s, idx) => (idx === i ? "running" : idx < i ? "done" : s)));
      setProgress(((i + 1) / 5) * 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStageStates((prev) => prev.map((s, idx) => (idx === i ? "done" : s)));
    }
    setRenderComplete(true);
    setCosts([
      { stage: "Pages", service: "Lambda", usage: `${pageCount} pages`, estimate: "0.0001 USD" },
      { stage: "Audio", service: "Polly", usage: `${pageCount * 200} chars`, estimate: "0.0040 USD" },
      { stage: "Captions", service: "Lambda", usage: `${pageCount} pages`, estimate: "0.0001 USD" },
      { stage: "Clips", service: "Lambda", usage: `${pageCount} clips`, estimate: "0.0120 USD" },
      { stage: "Concat", service: "Lambda", usage: "1 video", estimate: "0.0050 USD" },
    ]);
    setTotalCost("0.0212 USD");
  }

  function handleDownload(type: string) {
    window.alert(`Download ${type} requested`);
  }

  function handleMakeVertical() {
    setAspect("9:16");
    setCurrentStep(1);
  }

  const currentNarrPage = narrationPages[selectedNarrPage];
  const charCount = (currentNarrPage?.script ?? "").replace(/<[^>]*>/g, "").length;
  const estSeconds = (charCount / 7).toFixed(1);
  const _ = getUnsupportedTags(engine);

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t("video.heading")}</h1>
        <p>{t("video.lead")}</p>
      </div>

      <StepWizard steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />

      {/* Step 1: Source */}
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
            <p className="card-sub">{t("video.uploadSub")}</p>
            <UploadZone onFileSelect={handleFileSelect} />
            {uploadedFile && (
              <p style={{ marginTop: 8 }}>
                {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            <p className="note note-warn" style={{ marginTop: 16 }}>{t("video.independentNote")}</p>
          </div>

          <div className="card">
            <h2>{t("video.pagesTitle")}</h2>
            <p className="card-sub">{t("video.pagesSub")}</p>
            <div className="thumb-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {Array.from({ length: pageCount }, (_, i) => (
                <div key={i} style={{ background: "#f0f0f0", padding: 16, borderRadius: 4, textAlign: "center" }}>
                  Page {i + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="step-actions">
            <button type="button" className="btn btn-ghost spacer" onClick={() => navigate("/home")}>
              {t("common.backHome")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(1)}>
              {t("video.toSettings")}
            </button>
          </div>
        </section>
      )}

      {/* Step 2: Output settings */}
      {currentStep === 1 && (
        <section className="step-panel">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
            <div>
              <div className="card">
                <h2>{t("video.sizeTitle")}</h2>
                <p className="card-sub">{t("video.sizeSub")}</p>
                <fieldset className="option-cards">
                  <legend className="visually-hidden">{t("video.sizeLegend")}</legend>
                  {(["16:9", "9:16", "1:1", "4:5"] as AspectRatio[]).map((a) => (
                    <label key={a} className="option-card">
                      <input
                        type="radio"
                        name="aspect"
                        value={a}
                        checked={aspect === a}
                        onChange={() => setAspect(a)}
                      />
                      <span>
                        <strong>{t(`video.size${a.replace(":", "")}` as keyof typeof ASPECT_INFO extends string ? never : never) || a}</strong>
                        <span>{ASPECT_INFO[a].dim}</span>
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
                        <select id="v-layout" value={verticalLayout} onChange={(e) => setVerticalLayout(e.target.value)}>
                          <option value="top">{t("video.vLayout1")}</option>
                          <option value="center">{t("video.vLayout2")}</option>
                          <option value="crop">{t("video.vLayout3")}</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="v-bg">{t("video.vBg")}</label>
                        <select id="v-bg" value={verticalBg} onChange={(e) => setVerticalBg(e.target.value)}>
                          <option value="white">{t("video.vBg1")}</option>
                          <option value="navy">{t("video.vBg2")}</option>
                          <option value="auto">{t("video.vBg3")}</option>
                        </select>
                      </div>
                    </div>
                    <label className="checkbox-row">
                      <input type="checkbox" checked={safeArea} onChange={(e) => setSafeArea(e.target.checked)} />
                      <span>{t("video.safeArea")}</span>
                    </label>
                  </div>
                )}

                <div className="field">
                  <label htmlFor="fps">{t("video.fps")}</label>
                  <select id="fps" value={fps} onChange={(e) => setFps(e.target.value as "30" | "60")}>
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </div>
              </div>

              <div className="card">
                <h2>{t("video.subtitleTitle")}</h2>
                <fieldset className="option-cards">
                  <legend className="visually-hidden">{t("video.subtitleLegend")}</legend>
                  <label className="option-card">
                    <input type="radio" name="subtitle" value="burn" checked={subtitleMode === "burn"} onChange={() => setSubtitleMode("burn")} />
                    <span>
                      <strong>{t("video.subBurn")}</strong>
                      <span>{t("video.subBurnHint")}</span>
                    </span>
                  </label>
                  <label className="option-card">
                    <input type="radio" name="subtitle" value="srt" checked={subtitleMode === "srt"} onChange={() => setSubtitleMode("srt")} />
                    <span>
                      <strong>{t("video.subSrt")}</strong>
                      <span>{t("video.subSrtHint")}</span>
                    </span>
                  </label>
                  <label className="option-card">
                    <input type="radio" name="subtitle" value="none" checked={subtitleMode === "none"} onChange={() => setSubtitleMode("none")} />
                    <span>
                      <strong>{t("video.subNone")}</strong>
                      <span>{t("video.subNoneHint")}</span>
                    </span>
                  </label>
                </fieldset>

                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="sub-size">{t("video.subSize")}</label>
                    <select id="sub-size" value={subtitleSize} onChange={(e) => setSubtitleSize(e.target.value)}>
                      <option value="S">{t("video.subSizeS")}</option>
                      <option value="M">{t("video.subSizeM")}</option>
                      <option value="L">{t("video.subSizeL")}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sub-pos">{t("video.subPos")}</label>
                    <select id="sub-pos" value={subtitlePos} onChange={(e) => setSubtitlePos(e.target.value)}>
                      <option value="bottom">{t("video.subPosBottom")}</option>
                      <option value="center-bottom">{t("video.subPosCenter")}</option>
                      <option value="top">{t("video.subPosTop")}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>{t("video.voiceTitle")}</h2>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="voice-id">{t("video.voiceId")}</label>
                    <select id="voice-id" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                      <option value="Takumi">Takumi (ja-JP)</option>
                      <option value="Kazuha">Kazuha (ja-JP)</option>
                      <option value="Tomoko">Tomoko (ja-JP)</option>
                      <option value="Joanna">Joanna (en-US)</option>
                      <option value="Matthew">Matthew (en-US)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="voice-engine">{t("video.engine")}</label>
                    <select id="voice-engine" value={engine} onChange={(e) => setEngine(e.target.value as "neural" | "standard")}>
                      <option value="neural">neural</option>
                      <option value="standard">standard</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="sample-rate">{t("video.sampleRate")}</label>
                    <select id="sample-rate" value={sampleRate} onChange={(e) => setSampleRate(e.target.value)}>
                      <option value="24000">24000 Hz</option>
                      <option value="22050">22050 Hz</option>
                      <option value="16000">16000 Hz</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="speech-rate">{t("video.speechRate")}</label>
                    <select id="speech-rate" value={speechRate} onChange={(e) => setSpeechRate(e.target.value)}>
                      <option value="90">90%</option>
                      <option value="100">{t("video.rateDefault")}</option>
                      <option value="110">110%</option>
                    </select>
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleVoiceTest}>
                  {t("video.voiceTest")}
                </button>
                <p className="hint">{t("video.voiceTestHint")}</p>
              </div>
            </div>

            <div className="card preview-col">
              <h3>{t("video.previewTitle")}</h3>
              <div className="preview-wrap">
                <div
                  className="preview-frame"
                  style={{
                    aspectRatio: ASPECT_INFO[aspect].css,
                    background: "#e0e0e0",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 4,
                    maxHeight: 400,
                    width: "100%",
                  }}
                >
                  <div>{t("video.previewSlide")}</div>
                  {subtitleMode !== "none" && (
                    <p style={{ fontSize: "0.8em", marginTop: 8 }}>{t("video.previewCaption")}</p>
                  )}
                </div>
                <p className="preview-meta" style={{ textAlign: "center", marginTop: 8 }}>
                  {ASPECT_INFO[aspect].dim}
                </p>
              </div>
            </div>
          </div>

          <div className="step-actions">
            <button type="button" className="btn btn-ghost spacer" onClick={() => setCurrentStep(0)}>
              {t("common.back")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(2)}>
              {t("video.toNarration")}
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Narration and SSML */}
      {currentStep === 2 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("video.narrTitle")}</h2>
            <p className="card-sub">{t("video.narrSub")}</p>

            <div className="split" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
              <div>
                <h3>{t("video.pageListTitle")}</h3>
                <PageList
                  items={narrationPages.map((p, i) => ({
                    label: `Page ${i + 1}`,
                    duration: `~${((p.script.replace(/<[^>]*>/g, "").length) / 7).toFixed(1)}s`,
                  }))}
                  selectedIndex={selectedNarrPage}
                  onSelect={setSelectedNarrPage}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>Page {selectedNarrPage + 1}</h3>
                  <span className="badge badge-ai">{t("video.aiDraft")}</span>
                </div>

                <fieldset className="option-cards" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <legend>{t("video.inputMode")}</legend>
                  <label className="option-card">
                    <input
                      type="radio"
                      name="narr-mode"
                      value="plain"
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
                      name="narr-mode"
                      value="ssml"
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
                    onInsert={handleSsmlInsert}
                    onCheatsheetToggle={() => setCheatsheetOpen(!cheatsheetOpen)}
                    cheatsheetOpen={cheatsheetOpen}
                  />
                  <textarea
                    id="narr-text"
                    className="code"
                    rows={10}
                    value={currentNarrPage?.script ?? ""}
                    onChange={(e) => updateNarrationScript(e.target.value)}
                  />
                  <div className="counter" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{charCount} chars</span>
                    <span>~{estSeconds}s</span>
                  </div>
                  <span className="hint">{t("video.estHint")}</span>
                </div>

                {ssmlMode && (
                  <p className="note note-warn">{t("video.ssmlNote")}</p>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.alert("Preview audio")}>
                    {t("video.previewAudio")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.alert("AI regen")}>
                    {t("video.regenScript")}
                  </button>
                </div>
              </div>
            </div>
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
                  <th><span className="visually-hidden">{t("home.thAction")}</span></th>
                </tr>
              </thead>
              <tbody>
                {dictionary.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="text"
                        value={row.word}
                        onChange={(e) => updateDictRow(i, "word", e.target.value)}
                        aria-label={t("video.dictWord")}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.reading}
                        onChange={(e) => updateDictRow(i, "reading", e.target.value)}
                        aria-label={t("video.dictRead")}
                      />
                    </td>
                    <td>
                      <select
                        value={row.method}
                        onChange={(e) => updateDictRow(i, "method", e.target.value)}
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
                        onClick={() => removeDictRow(i)}
                      >
                        {t("common.remove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={addDictRow}>
              {t("video.dictAdd")}
            </button>
          </div>

          <div className="step-actions">
            <button type="button" className="btn btn-ghost spacer" onClick={() => setCurrentStep(1)}>
              {t("common.back")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => { void handleGenerate(); }}>
              {t("video.generate")}
            </button>
          </div>

          <SsmlCheatsheet
            engine={engine}
            open={cheatsheetOpen}
            onClose={() => setCheatsheetOpen(false)}
            onInsert={handleSsmlInsert}
          />
        </section>
      )}

      {/* Step 4: Generation */}
      {currentStep === 3 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("video.jobTitle")}</h2>
            <p className="card-sub">{t("video.jobSub")}</p>

            <ol className="progress-list" style={{ listStyle: "none", padding: 0 }}>
              {STAGE_NAMES.map((nameKey, i) => (
                <li key={i} data-state={stageStates[i]} style={{ padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8em",
                      background: stageStates[i] === "done" ? "#22c55e" : stageStates[i] === "running" ? "#3b82f6" : "#e5e7eb",
                      color: stageStates[i] === "wait" ? "#666" : "white",
                    }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span>{t(nameKey)}</span>
                </li>
              ))}
            </ol>

            <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8, marginTop: 16 }}>
              <div style={{ background: "#3b82f6", height: "100%", borderRadius: 4, width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
            <p className="hint">{renderComplete ? "Complete" : t("video.jobWaiting")}</p>
          </div>

          {renderComplete && (
            <>
              <div className="card">
                <h2>{t("video.resultTitle")}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div className="preview-wrap">
                    <div
                      className="preview-frame"
                      style={{
                        aspectRatio: ASPECT_INFO[aspect].css,
                        background: "#e0e0e0",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 4,
                        width: "100%",
                      }}
                    >
                      <div>{t("video.resultPreview")}</div>
                      <p style={{ fontSize: "0.8em", marginTop: 8 }}>{t("video.resultCaption")}</p>
                    </div>
                    <p style={{ textAlign: "center", marginTop: 8 }}>{ASPECT_INFO[aspect].dim}</p>
                  </div>

                  <div>
                    <table className="table" style={{ marginBottom: 16 }}>
                      <tbody>
                        <tr><th>{t("video.resFile")}</th><td>output.mp4</td></tr>
                        <tr><th>{t("video.resPages")}</th><td>{pageCount} pages</td></tr>
                        <tr><th>{t("video.resDuration")}</th><td>-</td></tr>
                        <tr><th>{t("video.resVideo")}</th><td>H.264 / {fps}fps</td></tr>
                        <tr><th>{t("video.resAudio")}</th><td>AAC / {voiceId} / {engine}</td></tr>
                      </tbody>
                    </table>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDownload("mp4")}>
                        {t("video.dlMp4")}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDownload("srt")}>
                        {t("video.dlSrt")}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDownload("audio")}>
                        {t("video.dlAudio")}
                      </button>
                    </div>

                    <p className="note" style={{ marginTop: 16 }}>{t("video.reuseNote")}</p>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleMakeVertical}>
                      {t("video.makeVertical")}
                    </button>
                  </div>
                </div>
              </div>

              <CostTable entries={costs} totalCost={totalCost} />
            </>
          )}

          <div className="step-actions">
            <button type="button" className="btn btn-ghost spacer" onClick={() => setCurrentStep(2)}>
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
