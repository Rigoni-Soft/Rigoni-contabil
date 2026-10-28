import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type AtendimentoTemplateProps = {
  header: React.ReactNode;
  nav: React.ReactNode;
  lista: React.ReactNode;
  // Sem conversa aberta o centro mostra o convite para escolher uma.
  chat?: React.ReactNode;
  acoes?: React.ReactNode;
  // "Voltar à lista", só em tela estreita.
  voltar?: React.ReactNode;
};

// Lista à esquerda, chat ao centro e ações à direita. Em tela estreita só uma coluna por vez: a
// lista, ou o chat quando há conversa aberta. Em tela larga a página não rola; cada coluna rola
// por dentro.
export function AtendimentoTemplate({
  header,
  nav,
  lista,
  chat,
  acoes,
  voltar,
}: AtendimentoTemplateProps) {
  const aberto = chat !== undefined;
  return (
    <Caixa className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {header}
      {nav}
      <Caixa como="main" className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <Caixa
          className={cn(
            "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]",
            acoes &&
              "xl:grid-cols-[20rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[22rem_minmax(0,1fr)_22rem]",
          )}
        >
          <Caixa className={cn("min-h-0 overflow-y-auto", aberto && "hidden lg:block")}>
            {lista}
          </Caixa>
          <Caixa className={cn("min-h-0 flex-col gap-3 lg:flex", aberto ? "flex" : "hidden")}>
            {voltar && <Caixa className="shrink-0 lg:hidden">{voltar}</Caixa>}
            {chat ?? (
              <Texto variante="apoio" className="m-auto">
                Escolha um atendimento para conversar.
              </Texto>
            )}
          </Caixa>
          {acoes}
        </Caixa>
      </Caixa>
    </Caixa>
  );
}
