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

    const slideElements = await page.$$("section[id]");

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
 * 現時点では PDF をフォールバックとして使用。
 */
export async function generatePptxBuffer(markdown: string): Promise<Buffer> {
  return generatePdfBuffer(markdown);
}
