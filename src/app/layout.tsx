import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-var.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

const playfair = localFont({
  src: "./fonts/playfair-display-var.woff2",
  variable: "--font-playfair",
  display: "swap",
  weight: "400 900",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

const themeScript = `(function(){try{var stored=localStorage.getItem("salon-theme");var dark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark){document.documentElement.dataset.theme="dark";}}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "Salon SaaS",
    template: "%s · Salon SaaS",
  },
  description: "Salon operations, scheduling, billing, inventory, and team management in one workspace.",
  applicationName: "Salon SaaS",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Salon SaaS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#100e0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
