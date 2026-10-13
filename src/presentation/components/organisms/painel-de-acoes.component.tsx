import { SecaoComDivisor } from "@/presentation/components/atoms/secao-com-divisor.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type PainelDeAcoesProps = {
  // Nome do Setor para onde o Atendimento acabou de ir; troca as ações por um aviso.
  transferidoPara?: string;
  servicos: React.ReactNode;
  transferencia: React.ReactNode;
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
    <aside
      aria-label="Ações do Atendimento"
      className="min-h-0 space-y-4 self-start overflow-y-auto rounded-xl border border-border bg-card p-3 lg:max-h-full"
    >
      {transferidoPara ? (
        <div role="status" className="space-y-1">
          <Texto como="h2" variante="titulo">
            Atendimento transferido
          </Texto>
          <Texto variante="apoio">Foi para o Setor {transferidoPara}.</Texto>
        </div>
      ) : (
        <>
          {servicos}
          <SecaoComDivisor>{transferencia}</SecaoComDivisor>
          <SecaoComDivisor>{encerramento}</SecaoComDivisor>
        </>
      )}
    </aside>
  );
}
