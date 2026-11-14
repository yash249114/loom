import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loom — Local-first AI coding agent",
  description:
    "Loom is a local-first, multi-model AI coding agent for the terminal. Connect your models, bring your own keys, route every task to the right model.",
  openGraph: {
    title: "Loom — Local-first AI coding agent",
    description:
      "Loom is a local-first, multi-model AI coding agent for the terminal. Connect your models, bring your own keys, route every task to the right model.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap"
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-black text-ink-on-black">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-[#F4F0E9] focus:text-[#8A4526]"
        >
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}