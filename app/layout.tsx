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
  title: "LVL Airdrops",
  description: "Controle de farming de airdrops: capital, tarefas e resultado.",
  /*
   * `app/favicon.ico` já é servido pela convenção do App Router. Os demais
   * ficam declarados porque cada um atende um contexto diferente: o de 180px é
   * o que o iOS usa ao salvar na tela de início, e sem ele o sistema recorta o
   * favicon pequeno e o resultado fica borrado.
   */
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  applicationName: "LVL Airdrops",
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
