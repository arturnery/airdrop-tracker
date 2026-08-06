import type { Metadata } from "next";
import { Crimson_Text, Geist, Geist_Mono } from "next/font/google";

import { DataProvider } from "@/components/data-provider";
import { carregarDataset } from "@/db/queries/dataset";
import { HOJE } from "@/db/queries/fixtures";
import { emptyDataset } from "@/lib/dataset";
import { sessaoAtual } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Serif reservada aos números grandes de indicador: ver StatCard. */
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
  /*
   * As telas de entrada compartilham este layout, e quem ainda não entrou não
   * tem dado para carregar. Sem sessão o Dataset fica vazio: nenhuma consulta
   * é feita, então não há o que vazar.
   */
  const sessao = await sessaoAtual();
  const dataset = sessao ? await carregarDataset(sessao.id) : emptyDataset();

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
