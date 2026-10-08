import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import { QueryProvider } from "@/presentation/providers/query.provider";
import { ThemeProvider } from "@/presentation/providers/theme.provider";
import { MeusAtendimentosContainer } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.container";

import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
            {/* Persiste entre as telas: o Funcionário não perde o Atendimento ao trocar de aba. */}
            <MeusAtendimentosContainer />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
