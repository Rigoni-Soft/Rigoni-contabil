import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { NumeroEmCirculo } from "@/presentation/components/atoms/numero-em-circulo.component";
import { TempoDeEspera } from "@/presentation/components/atoms/tempo-de-espera.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type ItemDaFilaProps = {
  posicao: number;
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  daFilaDeUsuario: boolean;
  espera: string;
};

export function ItemDaFila({
  posicao,
  contato,
  empresa,
  cnpj,
  telefone,
  resumo,
  daFilaDeUsuario,
  espera,
}: ItemDaFilaProps) {
  return (
    <Linha
      alinhar="inicio"
      espaco={3}
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
      <NumeroEmCirculo valor={posicao} prefixo="Posição" />
      <Caixa className="min-w-0 flex-1">
        <Texto variante="destaque" className="break-words">
          {contato}
        </Texto>
        <Texto variante="apoio" className="break-words">
          {empresa}
          {cnpj && (
            <>
              {" · "}
              <Caixa como="span" className="whitespace-nowrap">
                {cnpj}
              </Caixa>
            </>
          )}
        </Texto>
        <Texto variante="apoio">{telefone}</Texto>
        {resumo && (
          <Texto variante="corpo" className="mt-1 break-words">
            {resumo}
          </Texto>
        )}
        {daFilaDeUsuario && (
          <Texto variante="apoio" className="mt-1">
            Fila de um usuário
          </Texto>
        )}
      </Caixa>
      <TempoDeEspera valor={espera} />
    </Linha>
  );
}
