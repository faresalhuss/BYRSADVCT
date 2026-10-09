import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BYRSADVCT",
    short_name: "BYRSADVCT",
    description: "Dealer offers, itemized and ranked by all-in price.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#1f6f6a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
