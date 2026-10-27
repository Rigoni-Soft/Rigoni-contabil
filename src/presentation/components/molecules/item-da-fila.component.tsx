import { Clock } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export type ItemDaFilaProps = {
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  dirigido: boolean;
  espera: string;
};

export function ItemDaFila({
  contato,
  empresa,
  cnpj,
  telefone,
  resumo,
  dirigido,
  espera,
}: ItemDaFilaProps) {
  return (
    <Linha
      alinhar="inicio"
      espaco={3}
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
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
        {dirigido && (
          <Texto variante="apoio" className="mt-1">
            Dirigido a um usuário
          </Texto>
        )}
      </Caixa>
      <Linha como="span" alinhar="centro" espaco={1} className="shrink-0 text-sm tabular-nums">
        <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
        <Texto como="span" variante="somenteLeitor">
          Esperando há{" "}
        </Texto>
        {/* A espera nasce de relógios diferentes (servidor, cache compartilhado com o aviso do Dock e
            navegador): o texto muda de propósito a cada segundo. */}
        <Caixa como="span" suppressHydrationWarning>
          {espera}
        </Caixa>
      </Linha>
    </Linha>
  );
}
