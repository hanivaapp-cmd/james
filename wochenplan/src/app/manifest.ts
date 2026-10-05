import type { MetadataRoute } from "next";

/** Ermöglicht „Zum Home-Bildschirm hinzufügen“ – die App startet dann wie eine normale Handy-App. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wochenplan – Arbeitsplan Küche & Fahrer",
    short_name: "Wochenplan",
    description: "Wöchentlicher Arbeitsplan – schnell erstellt und per WhatsApp geteilt.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#ffffff",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
