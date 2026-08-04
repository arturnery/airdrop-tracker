import type { Metadata } from "next";
import { Crimson_Text, Geist, Geist_Mono } from "next/font/google";

import { DataProvider } from "@/components/data-provider";
import { datasetInicial, HOJE } from "@/db/queries/fixtures";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* O dataset das fixtures é o ponto de partida; o provider passa a usar
            o localStorage assim que monta. Na fase de backend este provider sai
            e os dados voltam a vir de Server Components.

            `initialToday` é só o valor que o HTML estático carrega: usar
            `new Date()` aqui congelaria a data no momento do build, que é pior.
            O provider troca pela data real do navegador ao hidratar. */}
        <DataProvider initialDataset={datasetInicial()} initialToday={HOJE}>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
