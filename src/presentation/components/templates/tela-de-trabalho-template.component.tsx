import { cn } from "@/presentation/lib/utils";

// Larguras por categoria de tela (DESIGN.md → Layout): a largura é relativa, não um `max-w` fixo.
const LARGURA = {
  conta: "max-w-md",
  lista: "max-w-3xl",
  formulario: "w-[80%]",
  conteudo: "w-[90%]",
} as const;

type TelaDeTrabalhoTemplateProps = {
  header: React.ReactNode;
  // Barra de navegação por Setor (só nas telas de dashboard).
  nav?: React.ReactNode;
  largura: keyof typeof LARGURA;
  // "Voltar", título e descrição da tela (molécula `CabecalhoDeTela`).
  cabecalho?: React.ReactNode;
  conteudo: React.ReactNode;
};

// Estrutura comum das telas autenticadas: cabeçalho da aplicação, container centralizado e dois
// slots (cabeçalho da tela e conteúdo). Sempre Server.
export function TelaDeTrabalhoTemplate({
  header,
  nav,
  largura,
  cabecalho,
  conteudo,
}: TelaDeTrabalhoTemplateProps) {
  return (
    <main className="min-h-dvh bg-background">
      {header}
      {nav}
      <div className={cn("mx-auto px-4 py-8 sm:px-6", LARGURA[largura])}>
        {cabecalho}
        {conteudo}
      </div>
    </main>
  );
}
