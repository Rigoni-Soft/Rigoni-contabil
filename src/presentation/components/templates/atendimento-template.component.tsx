import { Caixa } from "@/presentation/components/atoms/caixa.component";

type AtendimentoTemplateProps = {
  header: React.ReactNode;
  nav: React.ReactNode;
  lista: React.ReactNode;
  chat: React.ReactNode;
  acoes: React.ReactNode;
};

// Lista à esquerda, chat ao centro e ações à direita. Em tela larga a página não rola; cada coluna
// rola por dentro. Em tela estreita as colunas empilham (os slots se escondem sozinhos: a lista
// quando há conversa aberta, o chat quando não há) e o wrapper some do layout (`contents`).
export function AtendimentoTemplate({ header, nav, lista, chat, acoes }: AtendimentoTemplateProps) {
  return (
    <Caixa className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      {header}
      {nav}
      <Caixa como="main" className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 lg:px-8">
        <Caixa className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] xl:has-[[data-acoes]:not(:empty)]:grid-cols-[20rem_minmax(0,1fr)_19rem] 2xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:has-[[data-acoes]:not(:empty)]:grid-cols-[22rem_minmax(0,1fr)_22rem]">
          <Caixa className="contents lg:row-span-2 lg:block lg:min-h-0 lg:overflow-y-auto">
            {lista}
          </Caixa>
          <Caixa className="contents lg:flex lg:min-h-0 lg:flex-col xl:row-span-2">{chat}</Caixa>
          {/* Abaixo de xl as ações ficam sob o chat, com altura limitada e rolagem própria: sem o
              teto elas tomam a coluna e deixam as mensagens com uma fresta. Sem ações (nenhuma
              conversa aberta, ou ela já encerrada) o slot fica vazio e a terceira coluna não existe:
              o chat ocupa a largura. */}
          <Caixa
            data-acoes=""
            className="contents lg:col-start-2 lg:max-h-[28dvh] lg:overflow-y-auto lg:not-empty:block xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:max-h-none"
          >
            {acoes}
          </Caixa>
        </Caixa>
      </Caixa>
    </Caixa>
  );
}
