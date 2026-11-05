import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Salon SaaS",
    short_name: "Salon",
    description: "Salon operations, scheduling, billing, inventory, and team management in one workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#202b25",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
