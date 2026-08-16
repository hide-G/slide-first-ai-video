/*
  docs/assets/architecture.svg を生成するスクリプト。

  AWS公式のアーキテクチャアイコン（SVG）を <symbol> として埋め込み、
  外部参照のない自己完結したSVGを出力する。
  外部参照があるとGitHub上の <img> 表示でアイコンが読み込まれないため。

  使い方:
    1. AWS公式のアイコンパッケージから必要なSVGを docs/assets/aws-icons/ へ配置する
       （ファイル名は ICONS の値のとおり）
    2. node docs/assets/build-architecture-svg.mjs

  アイコン自体はリポジトリにコミットしない。生成後のSVGだけをコミットする。
*/

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const iconDir = join(here, "aws-icons");
const outFile = join(here, "architecture.svg");

const ICONS = {
  cloudfront: "Amazon-CloudFront.svg",
  s3: "Amazon-Simple-Storage-Service.svg",
  cognito: "Amazon-Cognito.svg",
  apigw: "Amazon-API-Gateway.svg",
  lambda: "AWS-Lambda.svg",
  dynamodb: "Amazon-DynamoDB.svg",
  bedrock: "Amazon-Bedrock.svg",
  sfn: "AWS-Step-Functions.svg",
  polly: "Amazon-Polly.svg",
  mediaconvert: "AWS-Elemental-MediaConvert.svg",
};

/** アイコンSVGの中身を取り出して <symbol> にする */
function buildSymbol(id, fileName) {
  const path = join(iconDir, fileName);
  if (!existsSync(path)) {
    throw new Error(`アイコンが見つかりません: ${path}`);
  }
  const raw = readFileSync(path, "utf8");

  const openTag = raw.match(/<svg\b[^>]*>/);
  if (!openTag) {
    throw new Error(`SVGの開始タグが見つかりません: ${fileName}`);
  }
  const viewBox = openTag[0].match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 80 80";

  let inner = raw.slice(openTag.index + openTag[0].length, raw.lastIndexOf("</svg>"));
  inner = inner.replace(/<title>[\s\S]*?<\/title>/g, "");

  // 同一ファイル内でidが衝突しないよう接頭辞を付ける
  inner = inner.replace(/\bid="([^"]+)"/g, (_m, v) => `id="${id}__${v}"`);
  inner = inner.replace(/url\(#([^)]+)\)/g, (_m, v) => `url(#${id}__${v})`);
  inner = inner.replace(/(xlink:href|href)="#([^"]+)"/g, (_m, a, v) => `${a}="#${id}__${v}"`);

  return `    <symbol id="icon-${id}" viewBox="${viewBox}">${inner.trim()}</symbol>`;
}

const C = {
  text: "#0f2b46",
  sub: "#5b6b7b",
  frame: "#232f3e",
  groupLine: "#8c9bab",
  groupFill: "#ffffff",
  cloudFill: "#f7fafd",
  arrow: "#4a5c6e",
  accent: "#d45b07",
  dashed: "#8c9bab",
};

const ICON = 52;
const parts = [];
const add = (s) => parts.push(s);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** サービス1つ分。アイコンの下に名前と役割を置く */
function node(cx, y, icon, name, role) {
  add(`  <use href="#icon-${icon}" x="${cx - ICON / 2}" y="${y}" width="${ICON}" height="${ICON}" />`);
  add(
    `  <text x="${cx}" y="${y + ICON + 18}" text-anchor="middle" font-size="14" font-weight="600" fill="${C.text}">${esc(name)}</text>`,
  );
  if (role) {
    add(`  <text x="${cx}" y="${y + ICON + 35}" text-anchor="middle" font-size="11.5" fill="${C.sub}">${esc(role)}</text>`);
  }
}

/** グループ枠 */
function group(x, y, w, h, title, note) {
  add(`  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C.groupFill}" stroke="${C.groupLine}" stroke-width="1.4" />`);
  add(`  <text x="${x + 16}" y="${y + 25}" font-size="14.5" font-weight="700" fill="${C.text}">${esc(title)}</text>`);
  if (note) {
    add(`  <text x="${x + 16}" y="${y + 43}" font-size="11.5" fill="${C.sub}">${esc(note)}</text>`);
  }
}

function arrow(points, label, opts = {}) {
  const stroke = opts.color ?? C.arrow;
  const dash = opts.dashed ? ' stroke-dasharray="5 4"' : "";
  const width = opts.width ?? 1.8;
  const d = points.map((p) => p.join(",")).join(" ");
  add(`  <polyline points="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash} marker-end="url(#arrowhead${opts.color === C.accent ? "-accent" : ""})" />`);
  if (label) {
    const [lx, ly] = opts.labelAt ?? points[Math.floor(points.length / 2)];
    add(
      `  <text x="${lx}" y="${ly}" font-size="11.5" fill="${opts.color ?? C.sub}" text-anchor="${opts.labelAnchor ?? "middle"}" font-weight="${opts.color === C.accent ? "700" : "400"}">${esc(label)}</text>`,
    );
  }
}

const W = 1420;
const H = 900;

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Hiragino Kaku Gothic ProN, Meiryo, sans-serif">`);
add(`  <title>Slide-First AI Video アーキテクチャ</title>`);
add(`  <desc>スライドを正本に、ナレーションと字幕つきの動画を生成するAWS構成図。アイコンはAWS公式のアーキテクチャアイコンを埋め込んでいる。</desc>`);
add("  <defs>");
for (const [id, file] of Object.entries(ICONS)) {
  add(buildSymbol(id, file));
}
add(`    <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`);
add(`      <path d="M 0 0 L 10 5 L 0 10 z" fill="${C.arrow}" />`);
add("    </marker>");
add(`    <marker id="arrowhead-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`);
add(`      <path d="M 0 0 L 10 5 L 0 10 z" fill="${C.accent}" />`);
add("    </marker>");
add("  </defs>");

add(`  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" />`);

// 利用者
add(`  <rect x="34" y="290" width="140" height="118" rx="10" fill="#ffffff" stroke="${C.groupLine}" stroke-width="1.4" />`);
add(`  <circle cx="104" cy="332" r="15" fill="none" stroke="${C.text}" stroke-width="2" />`);
add(`  <path d="M 80 370 q 24 -22 48 0" fill="none" stroke="${C.text}" stroke-width="2" />`);
add(`  <text x="104" y="392" text-anchor="middle" font-size="13.5" font-weight="600" fill="${C.text}">利用者</text>`);
add(`  <text x="104" y="406" text-anchor="middle" font-size="11" fill="${C.sub}">ブラウザ</text>`);

// AWS Cloud の枠
add(`  <rect x="210" y="40" width="1180" height="828" rx="14" fill="${C.cloudFill}" stroke="${C.frame}" stroke-width="2" />`);
add(`  <text x="234" y="74" font-size="16" font-weight="700" fill="${C.frame}">AWS Cloud</text>`);
add(`  <text x="340" y="74" font-size="12.5" fill="${C.sub}">ap-northeast-1（東京）</text>`);

// 画面を届ける
group(238, 96, 470, 170, "画面を届ける", "React SPA を配信する");
node(330, 158, "cloudfront", "CloudFront", "配信");
node(560, 158, "s3", "S3", "フロントエンド");

// ログイン
group(238, 292, 230, 160, "ログイン");
node(330, 338, "cognito", "Cognito", "ユーザープール");

// API とデータ
group(492, 292, 470, 160, "API とデータ");
node(570, 338, "apigw", "API Gateway", "REST + 認証");
node(725, 338, "lambda", "Lambda", "api");
node(880, 338, "dynamodb", "DynamoDB", "プロジェクト情報");

// 生成AI
group(986, 292, 380, 160, "文章を作る");
node(1070, 338, "lambda", "Lambda", "slide-generator");
node(1270, 338, "bedrock", "Bedrock", "Converse API");

// レンダリング 4工程
group(238, 482, 1128, 180, "レンダリング 4工程", "工程ごとに再実行できる。FFmpeg は使わない");
node(320, 544, "sfn", "Step Functions", "工程の実行管理");
node(600, 544, "lambda", "1 pages", "marp-render");
node(790, 544, "polly", "2 audio", "polly-worker");
node(980, 544, "lambda", "3 captions", "caption-worker");
node(1200, 544, "mediaconvert", "4 video", "MediaConvert");

// 保存
group(238, 692, 470, 160, "保存");
node(330, 738, "s3", "S3", "プロジェクト用バケット");
add(`  <text x="424" y="756" font-size="12" fill="${C.sub}">pages / audio / captions</text>`);
add(`  <text x="424" y="774" font-size="12" fill="${C.sub}">deck / output / manifest.json</text>`);
add(`  <text x="424" y="792" font-size="12" fill="${C.sub}">CloudFront と署名付きURLで配布</text>`);

// 利用者からの矢印
arrow([[174, 320], [204, 320], [204, 184], [302, 184]], "HTTPS", { labelAt: [210, 206], labelAnchor: "start" });
arrow([[174, 364], [302, 364]], "ログイン", { labelAt: [238, 356] });
arrow([[174, 332], [196, 332], [196, 278], [542, 278], [542, 338]], "REST + JWT", {
  color: C.accent,
  labelAt: [560, 272],
  labelAnchor: "start",
});

// API 内部
arrow([[598, 364], [697, 364]]);
arrow([[753, 364], [852, 364]]);

// API から生成AI
arrow([[908, 364], [1042, 364]], "呼び出し", { labelAt: [975, 356] });
arrow([[1098, 364], [1242, 364]]);

// API からレンダリング（ラベルの下から引いて文字を横切らないようにする）
arrow([[725, 432], [725, 467], [320, 467], [320, 540]], "実行開始", { labelAt: [520, 461] });

// 4工程の連結
arrow([[348, 570], [572, 570]]);
arrow([[628, 570], [762, 570]]);
arrow([[818, 570], [952, 570]]);
arrow([[1008, 570], [1172, 570]]);

// 成果物の保存（ラベルの下から引いて文字を横切らないようにする）
arrow([[600, 640], [600, 676], [420, 676], [420, 690]], "成果物", { dashed: true, labelAt: [500, 670] });
arrow([[1200, 640], [1200, 676], [620, 676], [620, 690]], "MP4", { dashed: true, labelAt: [900, 670] });

// 注記
add(`  <text x="238" y="890" font-size="11.5" fill="${C.sub}">アイコンは AWS 公式のアーキテクチャアイコンを使用しています。</text>`);

add("</svg>");

const svg = parts.join("\n") + "\n";
writeFileSync(outFile, svg, "utf8");

console.log(`生成しました: ${outFile}`);
console.log(`  サイズ: ${(svg.length / 1024).toFixed(1)} KB`);
console.log(`  埋め込んだアイコン: ${Object.keys(ICONS).length} 個`);
