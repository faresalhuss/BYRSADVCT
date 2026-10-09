import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderPdfThumbnail } from "@/lib/pdf-thumb";
import { tinyPdf } from "../fixtures/tiny-pdf";

describe("PDF thumbnails", () => {
  it("rasterizes page 1 to a 640px-wide WebP", async () => {
    const res = await renderPdfThumbnail(tinyPdf());
    expect(res.width).toBe(612);
    expect(res.height).toBe(792);
    const meta = await sharp(res.thumb).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(640);
    expect(meta.height).toBe(829);
  }, 20_000);
});
