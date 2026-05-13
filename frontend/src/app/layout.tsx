import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { AdvancedDrawerProvider } from "@/lib/advanced/AdvancedDrawerProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FFE — Teach a shared AI, privately.",
  description:
    "Collaboratively teach a shared AI assistant. Private contributions, encrypted before upload, co-owned results.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read persisted theme/surface from cookies so we can set the HTML
  // attributes server-side. Avoids the dark-mode flash without any
  // client-side script. When no cookie is present we omit the
  // attributes and let CSS fall back to prefers-color-scheme.
  const cookieStore = await cookies();
  const theme = cookieStore.get("ffe-theme")?.value;
  const surface = cookieStore.get("ffe-surface")?.value;
  const resolvedTheme =
    theme === "light" || theme === "dark" ? theme : undefined;
  const resolvedSurface =
    surface === "friendly" || surface === "technical" ? surface : "friendly";

  return (
    <html
      lang="en"
      data-theme={resolvedTheme}
      data-surface={resolvedSurface}
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <AuthProvider>
            <AdvancedDrawerProvider>{children}</AdvancedDrawerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
