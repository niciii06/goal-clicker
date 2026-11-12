import type { Metadata, Viewport } from "next";
import "./globals.css";
// The styles by area (audit P14), split from globals.css. This order is the cascade order: a rule that overrides a
// rule of another file only moved into an area file when the original order between the two stayed the same.
import "./styles/base.css";
import "./styles/match.css";
import "./styles/walkout.css";
import "./styles/album.css";
import "./styles/travel.css";
import "./styles/season.css";
import "./styles/coop.css";
import "./qol/qol.css";
import { PwaRegister } from "./pwa-register";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "./theme";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // Link previews need absolute image URLs; the preview image itself is app/opengraph-image.jpg.
  metadataBase: new URL("https://goalclicker.ch"),
  title: "Goal Clicker | Football Idle Club",
  description: "Klick den Ball, sammle Tore und baue dein eigenes Fussball Imperium.",
  openGraph: {
    title: "Goal Clicker | Football Idle Club",
    description: "Klick den Ball, sammle Tore und baue dein eigenes Fussball Imperium.",
    url: "/",
    siteName: "Goal Clicker",
    locale: "de_CH",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Goal Clicker", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Content runs under the notch and home indicator; the CSS keeps controls inside the safe area.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The boot script sets data-theme before React hydrates, so the attribute differs from the server HTML on purpose.
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
