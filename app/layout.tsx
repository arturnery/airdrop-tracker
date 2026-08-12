import type { Metadata } from "next";
import { Crimson_Text, Geist, Geist_Mono } from "next/font/google";

import { DataProvider } from "@/components/data-provider";
import { carregarDataset } from "@/db/queries/dataset";
import { hojeNoServidor } from "@/lib/dates";
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
  const hoje = hojeNoServidor();
  const dataset = sessao
    ? await carregarDataset(sessao.id, hoje)
    : emptyDataset();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${crimson.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* A data do servidor já nasce correta; o provider ainda troca pela do
            navegador ao hidratar, que é o que vale para quem está em outro
            fuso. */}
        <DataProvider initialDataset={dataset} initialToday={hoje}>
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
