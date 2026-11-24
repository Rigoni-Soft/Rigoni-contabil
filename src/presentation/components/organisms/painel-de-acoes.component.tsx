import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { SecaoComDivisor } from "@/presentation/components/atoms/secao-com-divisor.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export const ID_DO_PAINEL_DE_ACOES = "acoes-do-atendimento";

type PainelDeAcoesProps = {
  transferidoPara?: string;
  servicos?: React.ReactNode;
  contatoUra?: React.ReactNode;
  transferencia?: React.ReactNode;
  encerramento: React.ReactNode;
};

export function PainelDeAcoes({
  transferidoPara,
  servicos,
  contatoUra,
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
          {contatoUra && <SecaoComDivisor>{contatoUra}</SecaoComDivisor>}
          {transferencia && <SecaoComDivisor>{transferencia}</SecaoComDivisor>}
          {servicos || contatoUra || transferencia ? (
            <SecaoComDivisor>{encerramento}</SecaoComDivisor>
          ) : (
            encerramento
          )}
        </>
      )}
    </Pilha>
  );
}
