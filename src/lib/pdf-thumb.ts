import { createCanvas } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import sharp from "sharp";

/**
 * pdf.js reads its bundled Type1 fallback fonts from disk on Node. The bundler must not see a
 * static `require.resolve` here (Turbopack rewrites it into a module id), so the resolver is
 * looked up at runtime; if nothing is found we fall back to system fonts.
 */
function standardFontDataUrl(): string | undefined {
  const candidates: string[] = [];
  try {
    const nodeRequire = createRequire(import.meta.url);
    const resolve = Reflect.get(nodeRequire, "resolve") as ((id: string) => string) | undefined;
    const pkg = resolve?.("pdfjs-dist/package.json");
    if (typeof pkg === "string") candidates.push(path.join(path.dirname(pkg), "standard_fonts"));
  } catch {
    /* fall through to the cwd-based path */
  }
  candidates.push(path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts"));
  const dir = candidates.find((d) => existsSync(path.join(d, "FoxitFixed.pfb")));
  return dir ? dir + path.sep : undefined;
}

export interface PdfThumb {
  /** WebP, 640px wide. */
  thumb: Buffer;
  /** First page size in PDF points. */
  width: number;
  height: number;
}

/**
 * Rasterize page 1 of a PDF to a WebP thumbnail. Runs on Node (pdf.js legacy build with
 * @napi-rs/canvas), so it works at upload time and as a lazy backfill for older files.
 */
export async function renderPdfThumbnail(buffer: Buffer, targetWidth = 640): Promise<PdfThumb> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fonts = standardFontDataUrl();
  if (!fonts) console.warn("pdf thumbnail: pdf.js standard fonts not found; using system fonts");
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), disableFontFace: true, useSystemFonts: !fonts, standardFontDataUrl: fonts });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
    const png = canvas.toBuffer("image/png");
    const thumb = await sharp(png).webp({ quality: 80 }).toBuffer();
    return { thumb, width: Math.round(base.width), height: Math.round(base.height) };
  } finally {
    await task.destroy();
  }
}
