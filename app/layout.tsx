import type { Metadata } from "next";
import { Crimson_Text, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { DataProvider } from "@/components/data-provider";
import { Nav } from "@/components/nav";
import { RestaurarDados } from "@/components/restaurar-dados";
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
            e os dados voltam a vir de Server Components. */}
        <DataProvider initialDataset={datasetInicial()} initialToday={HOJE}>
          <a
            href="#conteudo"
            className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
          >
            Pular para o conteúdo
          </a>

          <div className="lg:grid lg:min-h-screen lg:grid-cols-[240px_1fr]">
            {/* Um único <nav> no DOM: em telas estreitas fica ao lado da marca,
                em telas largas empilha abaixo. Duplicar faria o leitor de tela
                anunciar dois menus idênticos. */}
            <aside className="bg-sidebar border-border sticky top-0 z-40 border-b lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
              <div className="flex items-center justify-between gap-2 lg:block">
                <div className="shrink-0 px-5 py-4">
                  <Link
                    href="/"
                    className="focus-visible:ring-ring rounded-sm text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
                  >
                    airdrop
                    <span className="text-primary">·</span>
                    tracker
                  </Link>
                  <p className="text-muted-foreground mt-0.5 hidden text-xs lg:block">
                    Controle de farming
                  </p>
                </div>
                <Nav />
              </div>
              <div className="mt-auto hidden lg:block">
                <RestaurarDados />
              </div>
            </aside>

            <main id="conteudo" className="px-6 py-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </main>
          </div>
        </DataProvider>
      </body>
    </html>
  );
}
