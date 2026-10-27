import type { Metadata } from "next";
import "./globals.css";
import { AudioProvider } from "@/components/AudioProvider";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Binary 1702",
  description:
    "Binary1702 is a studio for business owners who know something is wrong but not yet what it is. We start by finding out.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("theme-dark")}catch(e){}})();if("scrollRestoration"in history)history.scrollRestoration="manual";window.scrollTo(0,0);`,
          }}
        />
        <AudioProvider>
          {children}
        </AudioProvider>
        <Analytics />
      </body>
    </html>
  );
}
