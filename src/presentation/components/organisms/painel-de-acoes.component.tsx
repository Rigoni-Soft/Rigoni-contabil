import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { SecaoComDivisor } from "@/presentation/components/atoms/secao-com-divisor.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

// Alvo do atalho "Ir para as ações" do chat central, em tela estreita.
export const ID_DO_PAINEL_DE_ACOES = "acoes-do-atendimento";

type PainelDeAcoesProps = {
  // Nome do Setor para onde o Atendimento acabou de ir; troca as ações por um aviso.
  transferidoPara?: string;
  // Ausentes na leitura de supervisão: só o encerramento resta.
  servicos?: React.ReactNode;
  transferencia?: React.ReactNode;
  encerramento: React.ReactNode;
};

// Moldura do painel lateral: junta os serviços, a transferência e o encerramento. Em janela baixa rola por dentro.
export function PainelDeAcoes({
  transferidoPara,
  servicos,
  transferencia,
  encerramento,
}: PainelDeAcoesProps) {
  return (
    <Pilha
      espaco={4}
      como="aside"
      id={ID_DO_PAINEL_DE_ACOES}
      aria-label="Ações do Atendimento"
      className="min-h-0 self-start overflow-y-auto rounded-xl border border-border bg-card p-3 lg:max-h-full"
    >
      {transferidoPara ? (
        <Pilha espaco={1} role="status">
          <Texto como="h2" variante="titulo">
            Atendimento transferido
          </Texto>
          <Texto variante="apoio">Foi para o Setor {transferidoPara}.</Texto>
        </Pilha>
      ) : (
        <>
          {servicos}
          {transferencia && <SecaoComDivisor>{transferencia}</SecaoComDivisor>}
          {/* Em leitura não há o que separar: sem divisor solto no topo do painel. */}
          {servicos || transferencia ? (
            <SecaoComDivisor>{encerramento}</SecaoComDivisor>
          ) : (
            encerramento
          )}
        </>
      )}
    </Pilha>
  );
}
