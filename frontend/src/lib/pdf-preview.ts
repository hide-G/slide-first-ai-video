import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function openPdfDocument(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

export type PdfDocument = Awaited<ReturnType<typeof openPdfDocument>>;

export interface PdfPagePreview {
  imageDataUrl: string;
  text: string;
}

function normalizePdfText(textContent: { items: readonly unknown[] }): string {
  return textContent.items
    .map((item) => {
      if (typeof item !== "object" || item === null || !("str" in item)) {
        return "";
      }

      const value = (item as { str?: unknown }).str;
      return typeof value === "string" ? value : "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 描画せずに1ページ分の本文を抽出する。初期原稿の作成に使う。 */
export async function extractPdfPageText(
  document: PdfDocument,
  pageNumber: number,
): Promise<string> {
  const page = await document.getPage(pageNumber);
  try {
    return normalizePdfText(await page.getTextContent());
  } finally {
    page.cleanup();
  }
}

/** 選択した1ページだけをブラウザ内で描画し、AI提案用のテキストも抽出する。 */
export async function renderPdfPagePreview(
  document: PdfDocument,
  pageNumber: number,
): Promise<PdfPagePreview> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 0.45 });
  const canvas = window.document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("PDFプレビュー用のCanvasを初期化できませんでした。");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;

  const text = normalizePdfText(await page.getTextContent());
  page.cleanup();
  return {
    imageDataUrl: canvas.toDataURL("image/png"),
    text,
  };
}
