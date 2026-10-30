import type { Metadata } from "next";
import localFont from "next/font/local";

import { QueryProvider } from "@/presentation/providers/query.provider";
import { ThemeProvider } from "@/presentation/providers/theme.provider";
import { AvisoGlobalContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/aviso-global.container";

import "./globals.css";

// Roboto variável (latin) servida do repositório, não do Google: o build não depende de rede
// externa (o CI e a Vercel compilam sem buscar a fonte).
const roboto = localFont({
  src: "./fonts/roboto-latin.woff2",
  variable: "--font-roboto",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rigoni Contábil",
  description: "Sistema interno de atendimento e controle da Rigoni Contábil.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <QueryProvider>
            {children}
            {/* Persiste entre as telas: o contador e o aviso sonoro não dependem da tela aberta. */}
            <AvisoGlobalContainer />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
