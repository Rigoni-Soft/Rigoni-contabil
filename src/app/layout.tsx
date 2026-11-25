import type { Metadata } from "next";
import localFont from "next/font/local";

import { QueryProvider } from "@/presentation/providers/query.provider";
import { ThemeProvider } from "@/presentation/providers/theme.provider";
import { AvisoGlobalContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/aviso-global.container";

import "./globals.css";

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
            <AvisoGlobalContainer />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
