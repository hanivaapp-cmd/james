import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Schichtwerk – Dienstplan",
    short_name: "Schichtwerk",
    description: "Dienstpläne für Ihr Team",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#5e6ad2",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
