import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type EntradaTemplateProps = {
  titulo: string;
  subtitulo: string;
  rodape: string;
  formulario: React.ReactNode;
};

// Tela de entrada (login): conteúdo único centralizado, sem cabeçalho nem navegação. Sempre Server.
export function EntradaTemplate({ titulo, subtitulo, rodape, formulario }: EntradaTemplateProps) {
  return (
    <Caixa
      como="main"
      className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 sm:px-6"
    >
      <Caixa className="w-full max-w-sm">
        <Caixa className="mb-8 flex flex-col items-center gap-1 text-center">
          <Texto
            variante="livre"
            como="h1"
            className="text-2xl font-bold tracking-tight text-primary"
          >
            {titulo}
          </Texto>
          <Texto variante="livre" className="text-sm text-muted-foreground">
            {subtitulo}
          </Texto>
        </Caixa>

        <Caixa className="rc-guilloche-frame rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          {formulario}
        </Caixa>

        <Texto variante="livre" className="mt-6 text-center text-xs text-muted-foreground">
          {rodape}
        </Texto>
      </Caixa>
    </Caixa>
  );
}
