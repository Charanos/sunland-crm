import type { Metadata } from "next";
import { Cardo, JetBrains_Mono, Nunito, Libre_Baskerville } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const cardo = Cardo({
  variable: "--font-cardo",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Sunland ERP",
  description: "Internal Real Estate ERP for Sunland Real Estates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${jetbrains.variable} ${cardo.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
