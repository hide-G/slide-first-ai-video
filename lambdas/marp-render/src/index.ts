/**
 * Marp Render Lambda handler.
 *
 * Dispatches on two event shapes:
 * - action: "generateDeck" -> Generate slides from Markdown using Marp Core + Chromium
 * - stage: "pages"         -> Rasterize a PDF to page PNGs using browser-based pdf.js
 *
 * Does NOT use pdftoppm, libreoffice, ffmpeg, or any external commands.
 * Uses @sparticuz/chromium + puppeteer-core for all rendering.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { pageImageKey, deckKey, manifestKey as buildManifestKey } from "@slide-first/shared-types";
import type { Manifest, S3KeyParams } from "@slide-first/shared-types";

const s3Client = new S3Client({});

// --- Event types ---

export interface GenerateDeckEvent {
  action: "generateDeck";
  s3Bucket: string;
  s3Prefix: string;
  projectId: string;
  userId: string;
  markdown: string;
}

export interface PagesEvent {
  stage: "pages";
  s3Bucket: string;
  s3Prefix: string;
  projectId: string;
  userId: string;
  renderId: string;
}

export interface InspectSourceEvent {
  action: "inspectSource";
  s3Bucket: string;
  projectId: string;
  userId: string;
  sourceKey: string;
}

export type MarpRenderEvent = GenerateDeckEvent | PagesEvent | InspectSourceEvent;

export interface GenerateDeckResult {
  success: boolean;
  pageCount: number;
  error?: string;
}

export interface PagesResult {
  success: boolean;
  pageCount: number;
  pages: Array<{ pageNumber: number }>;
  error?: string;
}

export interface InspectSourceResult {
  success: boolean;
  pageCount: number;
  error?: string;
}

// --- Main handler ---

export const handler = async (
  event: MarpRenderEvent,
): Promise<GenerateDeckResult | PagesResult | InspectSourceResult> => {
  if ("action" in event && event.action === "generateDeck") {
    return handleGenerateDeck(event);
  }
  if ("action" in event && event.action === "inspectSource") {
    return handleInspectSource(event);
  }
  if ("stage" in event && event.stage === "pages") {
    return handlePages(event);
  }
  throw new Error(`Unknown event shape: ${JSON.stringify(event).slice(0, 200)}`);
};

// --- action: "generateDeck" ---

async function handleGenerateDeck(event: GenerateDeckEvent): Promise<GenerateDeckResult> {
  const { s3Bucket, projectId, userId, markdown } = event;
  const keyParams: S3KeyParams = { userId, projectId };

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    // 1. Convert markdown to HTML using Marp Core
    const html = await convertMarkdownToHtml(markdown);

    // 2. Upload deck.md
    await uploadObject(
      s3Bucket,
      deckKey(keyParams, "md"),
      Buffer.from(markdown, "utf-8"),
      "text/markdown",
    );

    // 3. Launch browser
    browser = await launchBrowser();
    const page = await browser.newPage();

    // 4. Build font CSS
    const fontCss = await buildFontCss();

    // 5. Set content with font
    const fullHtml = injectFontCss(html, fontCss);
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });

    // 6. Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // 7. Verify font application
    const fontApplied = await page.evaluate(() => {
      const sample = "\u65E5\u672C\u8A9E\u306E\u6F22\u5B57\u3068\u3072\u3089\u304C\u306A";
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = "48px NotoSansJP";
      const a = ctx.measureText(sample).width;
      ctx.font = "48px NoSuchFontFamilyXYZ";
      const b = ctx.measureText(sample).width;
      return Math.abs(a - b) > 0.5;
    });
    if (!fontApplied) {
      throw new Error("Japanese font verification failed: NotoSansJP not applied");
    }

    // 8. Generate PDF
    const pdfBuffer = await page.pdf({ width: "1920px", height: "1080px" });
    await uploadObject(
      s3Bucket,
      deckKey(keyParams, "pdf"),
      Buffer.from(pdfBuffer),
      "application/pdf",
    );

    // 9. Capture PNG per section (slide page)
    const sectionHandles = await page.$$("section");
    const pageCount = sectionHandles.length;

    const pagePngs: Buffer[] = [];
    for (let i = 0; i < pageCount; i++) {
      const screenshot = await sectionHandles[i].screenshot({ type: "png" });
      const pngBuffer = Buffer.from(screenshot);
      pagePngs.push(pngBuffer);
      await uploadObject(s3Bucket, pageImageKey(keyParams, i + 1), pngBuffer, "image/png");
    }

    // 10. Generate PPTX (images pasted as pages, text not editable)
    const pptxBuffer = await generatePptx(pagePngs);
    await uploadObject(
      s3Bucket,
      deckKey(keyParams, "pptx"),
      pptxBuffer,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    await browser.close();
    browser = null;

    return { success: true, pageCount };
  } catch (error: unknown) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, pageCount: 0, error: message };
  }
}

// --- action: "inspectSource" ---

async function handleInspectSource(event: InspectSourceEvent): Promise<InspectSourceResult> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    const pdfBytes = await downloadObject(event.s3Bucket, event.sourceKey);
    const pdfBase64 = pdfBytes.toString("base64");
    const assetsDir = join(__dirname, "assets");
    const libSource = await readFile(join(assetsDir, "pdf.min.mjs"), "utf-8");
    const workerSource = await readFile(join(assetsDir, "pdf.worker.min.mjs"), "utf-8");

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent("<html><body></body></html>", {
      waitUntil: "domcontentloaded",
    });

    const pageCount = await page.evaluate(
      async (libSrc: string, workerSrc: string, dataBase64: string) => {
        const libUrl = URL.createObjectURL(new Blob([libSrc], { type: "text/javascript" }));
        const workerUrl = URL.createObjectURL(new Blob([workerSrc], { type: "text/javascript" }));
        try {
          const pdfjs = await import(libUrl);
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const bytes = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
          const doc = await pdfjs.getDocument({ data: bytes }).promise;
          return doc.numPages;
        } finally {
          URL.revokeObjectURL(libUrl);
          URL.revokeObjectURL(workerUrl);
        }
      },
      libSource,
      workerSource,
      pdfBase64,
    );

    await browser.close();
    browser = null;
    return { success: true, pageCount };
  } catch (error: unknown) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ブラウザ終了時の二次エラーは元の失敗を上書きしない。
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, pageCount: 0, error: message };
  }
}

// --- stage: "pages" (pdf.js rasterization) ---

async function handlePages(event: PagesEvent): Promise<PagesResult> {
  const { s3Bucket, s3Prefix, projectId, userId } = event;
  const keyParams: S3KeyParams = { userId, projectId };
  const mKey = buildManifestKey(keyParams);

  // Read manifest
  const manifest = await readManifest(s3Bucket, mKey);

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    // Update stage to running
    manifest.stages.pages = "running";
    updatePagesProgress(manifest, 0, manifest.pages.length, "PDFページを画像に変換しています。");
    await writeManifest(s3Bucket, mKey, manifest);

    // Download source PDF
    const sourceKey = resolveSourceKey(manifest, keyParams, s3Prefix);
    const pdfBytes = await downloadObject(s3Bucket, sourceKey);
    const pdfBase64 = pdfBytes.toString("base64");

    // Read pdf.js library sources from assets
    const assetsDir = join(__dirname, "assets");
    const libSource = await readFile(join(assetsDir, "pdf.min.mjs"), "utf-8");
    const workerSource = await readFile(join(assetsDir, "pdf.worker.min.mjs"), "utf-8");

    // Launch browser
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Set minimal HTML page
    await page.setContent("<html><body></body></html>", { waitUntil: "domcontentloaded" });

    // pdf.jsでPDF各ページを、出力プロファイルの固定キャンバスへラスタライズする。
    const pngDataUrls: string[] = await page.evaluate(
      async (
        libSrc: string,
        workerSrc: string,
        dataBase64: string,
        targetWidth: number,
        targetHeight: number,
        verticalLayout: "top" | "center" | "crop",
        padColor: "white" | "navy" | "auto",
      ) => {
        const libUrl = URL.createObjectURL(new Blob([libSrc], { type: "text/javascript" }));
        const workerUrl = URL.createObjectURL(new Blob([workerSrc], { type: "text/javascript" }));

        try {
          const pdfjs = await import(libUrl);
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
          const bytes = Uint8Array.from(atob(dataBase64), (char) => char.charCodeAt(0));
          const doc = await pdfjs.getDocument({ data: bytes }).promise;
          const results: string[] = [];

          for (let i = 1; i <= doc.numPages; i++) {
            const pdfPage = await doc.getPage(i);
            const viewportAt1 = pdfPage.getViewport({ scale: 1 });
            const useCrop = verticalLayout === "crop";
            const scale = useCrop
              ? Math.max(targetWidth / viewportAt1.width, targetHeight / viewportAt1.height)
              : Math.min(targetWidth / viewportAt1.width, targetHeight / viewportAt1.height);
            const viewport = pdfPage.getViewport({ scale });

            const sourceCanvas = document.createElement("canvas");
            sourceCanvas.width = Math.ceil(viewport.width);
            sourceCanvas.height = Math.ceil(viewport.height);
            const sourceContext = sourceCanvas.getContext("2d")!;
            await pdfPage.render({
              canvasContext: sourceContext,
              viewport,
            }).promise;

            const targetCanvas = document.createElement("canvas");
            targetCanvas.width = targetWidth;
            targetCanvas.height = targetHeight;
            const targetContext = targetCanvas.getContext("2d")!;

            let backgroundColor = "#ffffff";
            if (padColor === "navy") {
              backgroundColor = "#0b1f3a";
            } else if (padColor === "auto") {
              const pixel = sourceContext.getImageData(0, 0, 1, 1).data;
              if (pixel[3] > 0) {
                backgroundColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
              }
            }
            targetContext.fillStyle = backgroundColor;
            targetContext.fillRect(0, 0, targetWidth, targetHeight);

            const x = (targetWidth - sourceCanvas.width) / 2;
            const y =
              verticalLayout === "top" && !useCrop ? 0 : (targetHeight - sourceCanvas.height) / 2;
            targetContext.drawImage(sourceCanvas, x, y);
            results.push(targetCanvas.toDataURL("image/png"));
          }

          return results;
        } finally {
          URL.revokeObjectURL(libUrl);
          URL.revokeObjectURL(workerUrl);
        }
      },
      libSource,
      workerSource,
      pdfBase64,
      manifest.output.width,
      manifest.output.height,
      manifest.output.verticalLayout ?? "center",
      manifest.output.padColor ?? "auto",
    );

    await browser.close();
    browser = null;

    // Upload page PNGs
    const pageCount = pngDataUrls.length;
    for (let i = 0; i < pageCount; i++) {
      const dataUrl = pngDataUrls[i];
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      const pngBuffer = Buffer.from(base64Data, "base64");
      await uploadObject(s3Bucket, pageImageKey(keyParams, i + 1), pngBuffer, "image/png");
      updatePagesProgress(
        manifest,
        i + 1,
        pageCount,
        `ページ ${i + 1}/${pageCount} の画像を保存しました。`,
      );
      await writeManifest(s3Bucket, mKey, manifest);
    }

    // Update manifest stage to done
    manifest.stages.pages = "done";
    updatePagesProgress(manifest, pageCount, pageCount, "ページ画像の準備が完了しました。");
    await writeManifest(s3Bucket, mKey, manifest);

    return {
      success: true,
      pageCount,
      pages: Array.from({ length: pageCount }, (_, i) => ({ pageNumber: i + 1 })),
    };
  } catch (error: unknown) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    manifest.stages.pages = "failed";
    updatePagesProgress(
      manifest,
      manifest.progress?.currentPage ?? 0,
      manifest.pages.length,
      "ページ画像の準備に失敗しました。",
    );
    await writeManifest(s3Bucket, mKey, manifest);

    const message = error instanceof Error ? error.message : String(error);
    return { success: false, pageCount: 0, pages: [], error: message };
  }
}

// --- Helper: Marp Core markdown -> HTML ---

async function convertMarkdownToHtml(markdown: string): Promise<string> {
  const { Marp } = await import("@marp-team/marp-core");
  const marp = new Marp();
  const { html, css } = marp.render(markdown);
  return `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}</body></html>`;
}

// --- Helper: Build font CSS ---

async function buildFontCss(): Promise<string> {
  const fontPath = join(__dirname, "assets", "noto-sans-jp.woff2");
  const fontBuffer = await readFile(fontPath);
  const base64 = fontBuffer.toString("base64");
  return `@font-face { font-family: 'NotoSansJP'; src: url(data:font/woff2;base64,${base64}) format('woff2'); font-weight: 400; font-display: block; } section, section * { font-family: 'NotoSansJP', sans-serif !important; }`;
}

// --- Helper: Inject font CSS into HTML ---

function injectFontCss(html: string, fontCss: string): string {
  return html.replace("</head>", `<style>${fontCss}</style></head>`);
}

// --- Helper: Launch Chromium browser ---

async function launchBrowser() {
  const chromium = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");
  const executablePath = await chromium.default.executablePath();
  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    executablePath,
    headless: chromium.default.headless,
    defaultViewport: { width: 1920, height: 1080 },
  });
  return browser;
}

// --- Helper: Generate PPTX with images ---

async function generatePptx(pagePngs: Buffer[]): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 }); // 16:9 at 1920x1080
  pptx.layout = "WIDE";

  for (const png of pagePngs) {
    const slide = pptx.addSlide();
    const base64 = png.toString("base64");
    slide.addImage({
      data: `image/png;base64,${base64}`,
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });
  }

  const output = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(output as Buffer);
}

// --- Helper: Resolve source PDF key ---

function resolveSourceKey(manifest: Manifest, keyParams: S3KeyParams, _s3Prefix: string): string {
  if (manifest.source.kind === "generated") {
    return deckKey(keyParams, "pdf");
  }
  return manifest.source.fileKey;
}

// --- S3 helpers ---

function updatePagesProgress(
  manifest: Manifest,
  currentPage: number,
  totalPages: number,
  message: string,
): void {
  manifest.progress = {
    stage: "pages",
    currentPage,
    totalPages: Math.max(1, totalPages),
    message,
    updatedAt: new Date().toISOString(),
  };
}

async function readManifest(bucket: string, key: string): Promise<Manifest> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await response.Body!.transformToString();
  return JSON.parse(body) as Manifest;
}

async function writeManifest(bucket: string, key: string, manifest: Manifest): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: "application/json",
    }),
  );
}

async function downloadObject(bucket: string, key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await response.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
