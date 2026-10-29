import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Everyday Essentials Retail",
    short_name: "Everyday Retail",
    description: "Retail workspace for Everyday Essentials Shop.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0b111b",
    theme_color: "#0e1724",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/crud-logo-no-wordmark-192.jpg", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/crud-logo-no-wordmark-512.jpg", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
