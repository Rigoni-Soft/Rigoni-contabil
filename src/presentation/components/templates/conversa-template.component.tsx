import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { cn } from "@/presentation/lib/utils";

// Em tela larga: [Fila] | chat | [painel de ações], conforme os slots preenchidos. A Fila só entra
// a partir de xl: com as três colunas em lg (1024 px) o chat sobra com ~330 px.
const COLUNAS: Record<"" | "acoes" | "fila" | "filaacoes", string> = {
  "": "",
  acoes: "lg:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]",
  fila: "xl:grid-cols-[18rem_minmax(0,1fr)]",
  filaacoes:
    "lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[18rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[20rem_minmax(0,1fr)_22rem]",
};

type ConversaTemplateProps = {
  header: React.ReactNode;
  voltar: React.ReactNode;
  cabecalho: React.ReactNode;
  mensagens: React.ReactNode;
  compositor: React.ReactNode;
  // Sem `acoes` (Atendimento encerrado) o chat ocupa a largura toda.
  acoes?: React.ReactNode;
  // Barra lateral esquerda com a Fila do Setor (só de xl para cima; a Fila tem tela própria).
  fila?: React.ReactNode;
};

// Em tela larga a página ocupa exatamente a altura da janela e não rola: só `mensagens` rola, por
// dentro. Em tela estreita volta a ser uma página comum, com o painel de ações abaixo do chat.
export function ConversaTemplate({
  header,
  voltar,
  cabecalho,
  mensagens,
  compositor,
  acoes,
  fila,
}: ConversaTemplateProps) {
  return (
    <Caixa className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {/* O cabeçalho da aplicação fica fora do <main>: é landmark de topo. */}
      {header}
      <Caixa como="main" className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <Caixa className="mb-2 shrink-0">{voltar}</Caixa>
        <Caixa className="min-h-0 flex-1">
          <Caixa
            como="section"
            aria-label="Atendimento"
            className={cn(
              "grid grid-cols-[minmax(0,1fr)] gap-4 lg:h-full lg:min-h-0",
              COLUNAS[`${fila ? "fila" : ""}${acoes ? "acoes" : ""}` as const],
            )}
          >
            {fila && (
              <Caixa
                como="aside"
                aria-label="Fila de atendimento"
                className="hidden min-h-0 overflow-y-auto xl:block"
              >
                {fila}
              </Caixa>
            )}
            <Caixa className="flex min-h-0 flex-col gap-3">
              {cabecalho}
              {mensagens}
              {compositor}
            </Caixa>
            {acoes}
          </Caixa>
        </Caixa>
      </Caixa>
    </Caixa>
  );
}
