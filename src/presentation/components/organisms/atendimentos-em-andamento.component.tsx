import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { CartaoDeAtendimento } from "@/presentation/components/molecules/cartao-de-atendimento.component";
import { cn } from "@/presentation/lib/utils";

type AtendimentoEmAndamentoView = {
  id: string;
  href: string;
  titulo: string;
  detalhe: string;
  previa: string | null;
  aguardando: boolean;
  sinal: string;
};

type CartaoDaFilaView = AtendimentoEmAndamentoView & { soEmTelaEstreita?: boolean };

type AtendimentosEmAndamentoProps = {
  atendimentos: AtendimentoEmAndamentoView[];
  // Cartão da Fila do Setor (#70), quando ela não está à vista.
  fila?: CartaoDaFilaView | null;
};

// Fica no canto de toda tela autenticada: o Funcionário troca de tela sem perder o Atendimento.
export function AtendimentosEmAndamento({ atendimentos, fila }: AtendimentosEmAndamentoProps) {
  if (atendimentos.length === 0 && !fila) return null;
  // Na conversa a Fila tem barra lateral em tela larga: o cartão só vale para tela estreita.
  const filaSoEstreita = fila?.soEmTelaEstreita ?? false;

  return (
    <Caixa
      como="nav"
      aria-label="Atendimentos em andamento"
      aria-live="polite"
      className={cn(
        "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-xs",
        // Só o cartão da Fila e só em tela larga: sem nada para mostrar, o painel some.
        atendimentos.length === 0 && filaSoEstreita && "xl:hidden",
      )}
    >
      {/* A chave inclui o sinal: a cada mensagem nova o cartão é recriado e a animação de entrada
          roda de novo, sinalizando a atualização. */}
      {fila && (
        <Caixa
          key={`${fila.id}:${fila.sinal}`}
          className={filaSoEstreita ? "xl:hidden" : undefined}
        >
          <CartaoDeAtendimento
            href={fila.href}
            titulo={fila.titulo}
            detalhe={fila.detalhe}
            previa={fila.previa}
            aguardando={fila.aguardando}
          />
        </Caixa>
      )}
      {atendimentos.map(({ id, sinal, ...atendimento }) => (
        <CartaoDeAtendimento key={`${id}:${sinal}`} {...atendimento} />
      ))}
    </Caixa>
  );
}
