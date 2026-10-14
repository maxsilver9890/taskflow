import type { Metadata, Viewport } from "next";
import "@fontsource/dela-gothic-one/400.css";
import "@fontsource-variable/archivo";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

import { Providers } from "@/lib/Providers";

export const metadata: Metadata = {
  title: { default: "TaskFlow — Reliable task execution for real teams", template: "%s · TaskFlow" },
  description:
    "TaskFlow is a multi-tenant project management platform: organize projects and tasks, assign work across your team, and trust background notifications to actually get delivered — with automatic retries and nothing silently lost.",
};

export const viewport: Viewport = {
  themeColor: "#f8f4e8",
};

// Sets the theme before first paint to avoid a flash of the wrong palette.
const themeScript = `
(function(){try{
  localStorage.removeItem('taskflow.theme');
  document.documentElement.setAttribute('data-theme', 'light');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
