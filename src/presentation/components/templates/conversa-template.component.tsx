import { cn } from "@/presentation/lib/utils";

type ConversaTemplateProps = {
  header: React.ReactNode;
  voltar: React.ReactNode;
  cabecalho: React.ReactNode;
  mensagens: React.ReactNode;
  compositor: React.ReactNode;
  // Sem `acoes` (Atendimento encerrado) o chat ocupa a largura toda.
  acoes?: React.ReactNode;
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
}: ConversaTemplateProps) {
  return (
    <main className="flex min-h-screen flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {header}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <div className="mb-2 shrink-0">{voltar}</div>
        <div className="min-h-0 flex-1">
          <section
            aria-label="Atendimento"
            className={cn(
              "grid gap-4 lg:h-full lg:min-h-0",
              acoes && "lg:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]",
            )}
          >
            <div className="flex min-h-0 flex-col gap-3">
              {cabecalho}
              {mensagens}
              {compositor}
            </div>
            {acoes}
          </section>
        </div>
      </div>
    </main>
  );
}
