import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import AuthenticatedMain from "@/components/AuthenticatedMain";
import ClientErrorRoot from "@/components/ClientErrorRoot";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { Toaster } from "react-hot-toast";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "AI DevCamp – Build with AI | GDG London",
  description:
    "A hands-on AI learning program by GDG London & Build with AI. Build multi-agent AI apps with TypeScript, Google ADK, Vertex AI, and the Model Context Protocol.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon-32x32.png",
  },
  openGraph: {
    title: "AI DevCamp – Build with AI",
    description: "3-week hands-on AI learning program by GDG London",
    images: ["/banner.jpeg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="bg-gray-950 text-white font-poppins antialiased">
        <AuthProvider>
          <AnalyticsTracker />
          <ClientErrorRoot>
            <Navbar />
            <AuthenticatedMain>{children}</AuthenticatedMain>
          </ClientErrorRoot>
          <CookieConsentBanner />
          <Toaster
            position="top-right"
            gutter={12}
            containerClassName="!z-[100]"
            containerStyle={{ top: 72, right: 12 }}
            toastOptions={{
              duration: 4200,
              className: "font-sans",
              style: {
                background: "#111827",
                color: "#f9fafb",
                border: "2px solid rgba(255,255,255,0.14)",
                borderRadius: "16px",
                fontSize: "16px",
                fontWeight: "600",
                lineHeight: 1.4,
                padding: "16px 20px",
                minWidth: "min(100vw - 2rem, 360px)",
                maxWidth: "420px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
              },
              success: {
                duration: 3800,
                style: {
                  background: "linear-gradient(135deg, #052e16 0%, #0f172a 100%)",
                  color: "#bbf7d0",
                  border: "2px solid rgba(34,197,94,0.45)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(34,197,94,0.2)",
                },
                iconTheme: {
                  primary: "#4ade80",
                  secondary: "#052e16",
                },
              },
              error: {
                duration: 5000,
                style: {
                  background: "linear-gradient(135deg, #2d0a0a 0%, #1f1315 100%)",
                  color: "#fecaca",
                  border: "2px solid rgba(248,113,113,0.4)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(248,113,113,0.2)",
                },
                iconTheme: {
                  primary: "#f87171",
                  secondary: "#2d0a0a",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
