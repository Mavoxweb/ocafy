import { StoreBoot } from "@/components/shell/store-boot";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ocafy — Deixa a casa ok.",
  description: "App de gestão doméstica gamificada para casais",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Ocafy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFB7C5",
};

// Aplica o tema salvo antes da primeira pintura (evita flash claro → escuro).
const themeScript = `try{var t=localStorage.getItem('ocafy-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático (constante local) que aplica o tema antes da pintura */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <StoreBoot />
        {children}
      </body>
    </html>
  );
}
