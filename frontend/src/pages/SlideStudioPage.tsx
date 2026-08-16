import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext.js";
import { StepWizard } from "../components/StepWizard.js";
import { CostTable } from "../components/CostTable.js";
import { PageList } from "../components/PageList.js";
import { apiClient } from "../api/client.js";
import type { CostEntry, OutlinePage } from "../api/types.js";

const STEPS = [
  { labelKey: "slide.stepA" as const },
  { labelKey: "slide.stepB" as const },
  { labelKey: "slide.stepC" as const },
];

const INITIAL_OUTLINE: OutlinePage[] = [
  { title: "", body: "", notes: "" },
];

export function SlideStudioPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 state
  const [contentLang, setContentLang] = useState<"ja" | "en">("ja");
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([""]);
  const [audience, setAudience] = useState("audience1");
  const [pages, setPages] = useState("5");
  const [tone, setTone] = useState("tone1");
  const [theme, setTheme] = useState("theme1");

  // Step 2 state
  const [outline, setOutline] = useState<OutlinePage[]>(INITIAL_OUTLINE);
  const [selectedPage, setSelectedPage] = useState(0);

  // Step 3 state
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [totalCost, setTotalCost] = useState("-");
  const [generating, setGenerating] = useState(false);
  const [projectId] = useState<string | null>(null);

  const addUrl = useCallback(() => {
    setReferenceUrls((prev) => [...prev, ""]);
  }, []);

  const removeUrl = useCallback((index: number) => {
    setReferenceUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateUrl = useCallback((index: number, value: string) => {
    setReferenceUrls((prev) => prev.map((url, i) => (i === index ? value : url)));
  }, []);

  async function handleGenerateOutline() {
    setGenerating(true);
    try {
      // Create project first if needed
      const projRes = await apiClient.createProject({ title: topic || "Untitled", kind: "slide" });
      const pid = projRes.project.projectId;

      const res = await apiClient.generateOutline(pid, {
        contentLang,
        topic,
        sourceText,
        referenceUrls: referenceUrls.filter((u) => u.trim()),
        audience,
        pages: parseInt(pages, 10),
        tone,
        theme,
      });
      setOutline(res.outline.pages);
      setCosts(res.costs);
      setCurrentStep(1);
    } catch {
      // Handle error silently for now
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateDeck() {
    if (!projectId) {
      // Use costs from outline generation for demo
      setCurrentStep(2);
      return;
    }
    setGenerating(true);
    try {
      await apiClient.updateOutline(projectId, { pages: outline });
      const res = await apiClient.generateDeck(projectId, { format: ["markdown", "pdf", "pptx"] });
      setCosts(res.costs);
      const sum = res.costs.reduce((acc, c) => acc + parseFloat(c.estimate || "0"), 0);
      setTotalCost(`${sum.toFixed(4)} USD`);
      setCurrentStep(2);
    } catch {
      // Handle error
    } finally {
      setGenerating(false);
    }
  }

  function handleMoveUp() {
    if (selectedPage <= 0) return;
    const newOutline = [...outline];
    [newOutline[selectedPage - 1], newOutline[selectedPage]] = [newOutline[selectedPage], newOutline[selectedPage - 1]];
    setOutline(newOutline);
    setSelectedPage(selectedPage - 1);
  }

  function handleMoveDown() {
    if (selectedPage >= outline.length - 1) return;
    const newOutline = [...outline];
    [newOutline[selectedPage], newOutline[selectedPage + 1]] = [newOutline[selectedPage + 1], newOutline[selectedPage]];
    setOutline(newOutline);
    setSelectedPage(selectedPage + 1);
  }

  function handleAddSlide() {
    const newOutline = [...outline];
    newOutline.splice(selectedPage + 1, 0, { title: "", body: "", notes: "" });
    setOutline(newOutline);
    setSelectedPage(selectedPage + 1);
  }

  function handleDeleteSlide() {
    if (outline.length <= 1) return;
    const newOutline = outline.filter((_, i) => i !== selectedPage);
    setOutline(newOutline);
    setSelectedPage(Math.min(selectedPage, newOutline.length - 1));
  }

  function handlePageUpdate(field: keyof OutlinePage, value: string) {
    const newOutline = [...outline];
    newOutline[selectedPage] = { ...newOutline[selectedPage], [field]: value };
    setOutline(newOutline);
  }

  function handleRegen() {
    // Placeholder - would call API to regenerate this page
    window.alert("AI regen requested for this page");
  }

  function handleFactCheck() {
    // Placeholder - would call API to check references
    window.alert("Reference check requested");
  }

  function handleDownload(format: string) {
    // Placeholder - would trigger actual download
    window.alert(`Download ${format} requested`);
  }

  const currentPageData = outline[selectedPage] ?? { title: "", body: "", notes: "" };

  return (
    <main className="page">
      <div className="page-head">
        <h1>{t("slide.heading")}</h1>
        <p>{t("slide.lead")}</p>
      </div>

      <StepWizard steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />

      {/* Step 1: Input */}
      {currentStep === 0 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("slide.s1Title")}</h2>
            <p className="card-sub">{t("slide.s1Sub")}</p>

            <p className="note">{t("slide.langNote")}</p>

            <fieldset className="option-cards">
              <legend>{t("slide.outputLang")}</legend>
              <label className="option-card">
                <input
                  type="radio"
                  name="content-lang"
                  value="ja"
                  checked={contentLang === "ja"}
                  onChange={() => setContentLang("ja")}
                />
                <span>
                  <strong>{t("slide.langJa")}</strong>
                  <span>{t("slide.langJaHint")}</span>
                </span>
              </label>
              <label className="option-card">
                <input
                  type="radio"
                  name="content-lang"
                  value="en"
                  checked={contentLang === "en"}
                  onChange={() => setContentLang("en")}
                />
                <span>
                  <strong>{t("slide.langEn")}</strong>
                  <span>{t("slide.langEnHint")}</span>
                </span>
              </label>
            </fieldset>

            <div className="field">
              <label htmlFor="deck-topic">{t("slide.topic")}</label>
              <input
                type="text"
                id="deck-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="deck-source">{t("slide.sourceText")}</label>
              <textarea
                id="deck-source"
                rows={6}
                placeholder={t("slide.sourcePlaceholder")}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />
              <span className="hint">{t("slide.sourceHint")}</span>
            </div>

            <div className="field">
              <span className="field-label">{t("slide.refUrls")}</span>
              {referenceUrls.map((url, index) => (
                <div key={index} className="url-row" style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeUrl(index)}
                  >
                    {t("common.remove")}
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={addUrl}>
                {t("slide.addUrl")}
              </button>
              <span className="hint">{t("slide.refHint")}</span>
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="deck-audience">{t("slide.audience")}</label>
                <select id="deck-audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="audience1">{t("slide.audience1")}</option>
                  <option value="audience2">{t("slide.audience2")}</option>
                  <option value="audience3">{t("slide.audience3")}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="deck-pages">{t("slide.pages")}</label>
                <select id="deck-pages" value={pages} onChange={(e) => setPages(e.target.value)}>
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="7">7</option>
                  <option value="10">10</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="deck-tone">{t("slide.tone")}</label>
                <select id="deck-tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="tone1">{t("slide.tone1")}</option>
                  <option value="tone2">{t("slide.tone2")}</option>
                  <option value="tone3">{t("slide.tone3")}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="deck-theme">{t("slide.theme")}</label>
                <select id="deck-theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="theme1">{t("slide.theme1")}</option>
                  <option value="theme2">{t("slide.theme2")}</option>
                  <option value="theme3">{t("slide.theme3")}</option>
                </select>
              </div>
            </div>
          </div>

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
              disabled={generating}
              onClick={() => { void handleGenerateOutline(); }}
            >
              {t("slide.genOutline")}
            </button>
          </div>
        </section>
      )}

      {/* Step 2: Outline review */}
      {currentStep === 1 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("slide.s2Title")}</h2>
            <p className="card-sub">{t("slide.s2Sub")}</p>

            <div className="split" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
              <div>
                <h3>{t("slide.outlineList")}</h3>
                <PageList
                  items={outline.map((p, i) => ({ label: `${i + 1}. ${p.title || `Slide ${i + 1}`}` }))}
                  selectedIndex={selectedPage}
                  onSelect={setSelectedPage}
                />
                <div className="list-tools" style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleMoveUp}>
                    {t("slide.moveUp")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleMoveDown}>
                    {t("slide.moveDown")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddSlide}>
                    {t("slide.addSlide")}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSlide}>
                    {t("common.remove")}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>Slide {selectedPage + 1}</h3>
                  <span className="badge badge-ai">{t("slide.aiDraft")}</span>
                </div>

                <div className="field">
                  <label htmlFor="outline-title">{t("slide.slideTitle")}</label>
                  <input
                    type="text"
                    id="outline-title"
                    value={currentPageData.title}
                    onChange={(e) => handlePageUpdate("title", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="outline-body">{t("slide.slideBody")}</label>
                  <textarea
                    id="outline-body"
                    rows={9}
                    value={currentPageData.body}
                    onChange={(e) => handlePageUpdate("body", e.target.value)}
                  />
                  <span className="hint">{t("slide.slideBodyHint")}</span>
                </div>

                <div className="field">
                  <label htmlFor="outline-notes">{t("slide.slideNotes")}</label>
                  <textarea
                    id="outline-notes"
                    rows={3}
                    value={currentPageData.notes}
                    onChange={(e) => handlePageUpdate("notes", e.target.value)}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleRegen}>
                    {t("slide.regen")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleFactCheck}>
                    {t("slide.factCheck")}
                  </button>
                </div>
              </div>
            </div>
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
              disabled={generating}
              onClick={() => { void handleGenerateDeck(); }}
            >
              {t("slide.genDeck")}
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Generated slides */}
      {currentStep === 2 && (
        <section className="step-panel">
          <div className="card">
            <h2>{t("slide.s3Title")}</h2>
            <p className="card-sub">{t("slide.s3Sub")}</p>
            <div className="thumb-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {outline.map((page, i) => (
                <div key={i} style={{ background: "#f0f0f0", padding: 16, borderRadius: 4, textAlign: "center" }}>
                  <strong>{page.title || `Slide ${i + 1}`}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>{t("slide.downloadTitle")}</h2>
            <p className="card-sub">{t("slide.downloadSub")}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => handleDownload("md")}>
                deck.md (Markdown)
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => handleDownload("pdf")}>
                deck.pdf (PDF)
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => handleDownload("pptx")}>
                deck.pptx (PowerPoint)
              </button>
            </div>
            <p className="note" style={{ marginTop: 16 }}>{t("slide.pptxNote")}</p>
          </div>

          {costs.length > 0 && (
            <CostTable entries={costs} totalCost={totalCost} />
          )}

          <div className="step-actions">
            <button
              type="button"
              className="btn btn-ghost spacer"
              onClick={() => setCurrentStep(1)}
            >
              {t("slide.backOutline")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/video-studio?from=slide")}
            >
              {t("slide.toVideo")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
