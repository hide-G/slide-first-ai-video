/**
 * Marp レンダリングコマンド (Docker不要版)
 * @marp-team/marp-core で Markdown → HTML 変換し、
 * puppeteer-core + @sparticuz/chromium で PDF/PNG 生成を行う。
 */

import { Marp } from "@marp-team/marp-core";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

/**
 * Marp Markdown を完全な HTML ドキュメントに変換する。
 */
export function renderMarpToHtml(markdown: string): string {
  const marp = new Marp({
    html: true,
    math: true,
  });

  const { html, css } = marp.render(markdown);

  // Puppeteer で開くための完全な HTML ドキュメントを構成
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Chromium ブラウザインスタンスを起動する。
 * Lambda 環境では @sparticuz/chromium のバイナリを使用。
 */
async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: true,
  });
}

/**
 * Marp Markdown から PDF を生成する。
 */
export async function generatePdfBuffer(markdown: string): Promise<Buffer> {
  const html = renderMarpToHtml(markdown);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      width: "1280px",
      height: "720px",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Marp Markdown から各スライドの PNG 画像を生成する。
 * 各スライドを個別にスクリーンショットして返す。
 */
export async function generatePngBuffers(
  markdown: string,
  scale: number = 2,
): Promise<Buffer[]> {
  const html = renderMarpToHtml(markdown);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1280 * scale,
      height: 720 * scale,
      deviceScaleFactor: scale,
    });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // 各 section[id] がスライドに対応する
    const slideElements = await page.$$("section[id]");

    // スライドが見つからない場合は body 全体をキャプチャ
    if (slideElements.length === 0) {
      const screenshot = await page.screenshot({
        type: "png",
        fullPage: true,
      });
      return [Buffer.from(screenshot)];
    }

    const buffers: Buffer[] = [];
    for (const element of slideElements) {
      const screenshot = await element.screenshot({ type: "png" });
      buffers.push(Buffer.from(screenshot));
    }

    return buffers;
  } finally {
    await browser.close();
  }
}

/**
 * Marp Markdown から PPTX を生成する。
 * 注意: Chromium では直接 PPTX 生成はできないため、
 * PDF を生成して返す（PPTX は将来別途ライブラリで対応可能）。
 * 現時点では PDF をフォールバックとして使用する。
 */
export async function generatePptxBuffer(markdown: string): Promise<Buffer> {
  // PPTX 生成は Chromium 単体では不可能。
  // 将来的に pptxgenjs などを使って実装可能。
  // 現時点では PDF を生成して返す。
  return generatePdfBuffer(markdown);
}
