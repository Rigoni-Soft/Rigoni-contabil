import { CartaoDeAtendimento } from "@/presentation/components/molecules/cartao-de-atendimento.component";

type AtendimentoEmAndamentoView = {
  id: string;
  href: string;
  titulo: string;
  detalhe: string;
  previa: string | null;
  aguardando: boolean;
  sinal: string;
};

type AtendimentosEmAndamentoProps = { atendimentos: AtendimentoEmAndamentoView[] };

// Fica no canto de toda tela autenticada: o Funcionário troca de tela sem perder o Atendimento.
export function AtendimentosEmAndamento({ atendimentos }: AtendimentosEmAndamentoProps) {
  if (atendimentos.length === 0) return null;

  return (
    <nav
      aria-label="Atendimentos em andamento"
      className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-xs"
    >
      {/* A chave inclui o sinal: a cada mensagem nova o cartão é recriado e a animação de entrada
          roda de novo, sinalizando a atualização. */}
      {atendimentos.map(({ id, sinal, ...atendimento }) => (
        <CartaoDeAtendimento key={`${id}:${sinal}`} {...atendimento} />
      ))}
    </nav>
  );
}
