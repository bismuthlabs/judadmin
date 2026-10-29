import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Crud",
    short_name: "Crud",
    description: "Management workspace for Everyday Shop.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0b111b",
    theme_color: "#0e1724",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/app-icon-192.jpg", sizes: "192x192", type: "image/jpeg", purpose: "any" },
      { src: "/icons/app-icon-512.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
      { src: "/icons/app-icon-512.jpg", sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
    ],
  };
}
