import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Open_Sans } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const arabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Transguard · Workforce Intelligence",
  description: "AI workforce operations demo prepared for Transguard Group by NinjaTech",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${openSans.variable} ${arabic.variable} antialiased`}>
        <LangProvider>
          <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            <Sidebar />
            <main className="min-w-0 px-4 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-9">
              <div className="mx-auto w-full max-w-[1240px]">{children}</div>
            </main>
          </div>
        </LangProvider>
      </body>
    </html>
  );
}
