import type { Metadata } from "next";
import { Crimson_Text, Geist, Geist_Mono } from "next/font/google";

import { DataProvider } from "@/components/data-provider";
import { carregarDataset } from "@/db/queries/dataset";
import { HOJE } from "@/db/queries/fixtures";
import { getCurrentUserId } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Serif reservada aos números grandes de indicador — ver StatCard. */
const crimson = Crimson_Text({
  variable: "--font-crimson",
  weight: ["400", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "airdrop-tracker",
  description: "Controle de farming de airdrops: capital, tarefas e resultado.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Os dados agora vêm do Postgres. As telas não mudaram: o Dataset tem a
  // mesma forma que as fixtures tinham.
  const dataset = await carregarDataset(await getCurrentUserId());

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* `initialToday` é só o valor que o HTML carrega; o provider troca
            pela data real do navegador ao hidratar. */}
        <DataProvider initialDataset={dataset} initialToday={HOJE}>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
