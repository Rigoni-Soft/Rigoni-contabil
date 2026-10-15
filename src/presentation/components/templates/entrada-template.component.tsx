import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
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
    <Linha
      alinhar="centro"
      como="main"
      className="min-h-dvh justify-center bg-background px-4 py-12 sm:px-6"
    >
      <Caixa className="w-full max-w-sm">
        <Caixa className="mb-8 flex flex-col items-center gap-1 text-center">
          <Texto variante="marca" como="h1">
            {titulo}
          </Texto>
          <Texto variante="apoio">{subtitulo}</Texto>
        </Caixa>

        <Caixa className="rc-guilloche-frame rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
          {formulario}
        </Caixa>

        <Texto variante="nota" className="mt-6 text-center">
          {rodape}
        </Texto>
      </Caixa>
    </Linha>
  );
}
