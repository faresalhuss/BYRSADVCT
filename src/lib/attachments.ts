export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"] as const;
export type AttachmentKind = "sticker" | "worksheet" | "buyers_order" | "photo" | "other";
export const ATTACHMENT_KINDS: { value: AttachmentKind; label: string }[] = [
  { value: "sticker", label: "Window sticker" },
  { value: "worksheet", label: "Dealer worksheet" },
  { value: "buyers_order", label: "Buyer's order" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

export function extensionFor(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

/** Browsers often report HEIC files with an empty type; fall back to the extension. */
export function sniffMime(file: { type: string; name: string }): string | null {
  if (file.type && (ATTACHMENT_MIMES as readonly string[]).includes(file.type)) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "pdf") return "application/pdf";
  if (ext === "webp") return "image/webp";
  return null;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}
