import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { cn } from "@/presentation/lib/utils";

// Larguras por categoria de tela (DESIGN.md → Layout): a largura é relativa, não um `max-w` fixo.
const LARGURA = {
  conta: "max-w-md",
  lista: "max-w-3xl",
  // cadastro com muitos campos: colunas lado a lado, sem esticar os campos em tela larga
  cadastro: "w-full max-w-4xl",
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
    <Caixa className="min-h-dvh bg-background">
      {/* Cabeçalho e navegação da aplicação ficam fora do <main>: são landmarks de topo. */}
      {header}
      {nav}
      <Caixa como="main" className={cn("mx-auto px-4 py-8 sm:px-6", LARGURA[largura])}>
        {cabecalho}
        {conteudo}
      </Caixa>
    </Caixa>
  );
}
