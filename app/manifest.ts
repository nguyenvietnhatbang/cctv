import type { MetadataRoute } from "next";
import { companyProfile } from "@/lib/company";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: companyProfile.appName,
    short_name: "An Việt Ops",
    description: "Ứng dụng điều phối và xử lý công việc kỹ thuật An Việt Tech.",
    start_url: "/technician",
    scope: "/",
    display: "standalone",
    launch_handler: {
      client_mode: "navigate-existing",
    },
    background_color: "#f8fafc",
    theme_color: "#1d4ed8",
    lang: "vi",
    orientation: "portrait",
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
