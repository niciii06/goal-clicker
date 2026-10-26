import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "./theme";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // Link previews need absolute image URLs; the preview image itself is app/opengraph-image.jpg.
  metadataBase: new URL("https://goal-clicker.vercel.app"),
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
  icons: {
    icon: "/favicon.svg",
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
      </body>
    </html>
  );
}
