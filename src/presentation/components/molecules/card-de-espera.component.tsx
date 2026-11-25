import { Clock, Eye } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

export type CardDeEsperaProps = {
  id: string;
  contato: string;
  empresa: string;
  resumo: string | null;
  origem?: string | null;
  espera: string;
  assumivel: boolean;
  dirigido?: boolean;
  assumindo?: boolean;
  onAssumir: () => void;
  onLer?: () => void;
};

const MOLDURA = "w-full rounded-lg border border-border px-3 py-2 text-left";

export function CardDeEspera({
  id,
  contato,
  empresa,
  resumo,
  origem,
  espera,
  assumivel,
  dirigido = true,
  assumindo = false,
  onAssumir,
  onLer,
}: CardDeEsperaProps) {
  const clicavel = assumivel || onLer !== undefined;
  const conteudo = (
    <Linha alinhar="inicio" espaco={3}>
      <Caixa como="span" className="min-w-0 flex-1">
        <Texto como="span" variante="somenteLeitor" id={`${id}-acao`}>
          {assumivel ? "Assumir o atendimento de" : "Ler o atendimento de"}
        </Texto>
        <Texto como="span" variante="destaque" className="block truncate" id={`${id}-contato`}>
          {contato}
        </Texto>
        <Texto como="span" variante="apoio" className="block truncate" id={`${id}-empresa`}>
          {empresa}
        </Texto>
        {origem && (
          <Texto como="span" variante="nota" className="block truncate" id={`${id}-origem`}>
            {origem}
          </Texto>
        )}
        {resumo && (
          <Texto
            como="span"
            variante="nota"
            className="line-clamp-2 break-words"
            id={`${id}-resumo`}
          >
            {resumo}
          </Texto>
        )}
        {!assumivel && (
          <Texto como="span" variante="nota" className="block">
            {onLer && <Eye aria-hidden="true" className="mr-1 inline size-3.5 align-text-bottom" />}
            {dirigido ? "Dirigido a outro usuário" : "Espera do Setor"}
            {onLer && " · só leitura"}
          </Texto>
        )}
      </Caixa>
      <Caixa como="span" className="flex shrink-0 flex-col items-end gap-1.5">
        <Linha como="span" alinhar="centro" espaco={1} className="text-sm tabular-nums">
          <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
          <Texto como="span" variante="somenteLeitor">
            Esperando há{" "}
          </Texto>
          <Caixa como="span" suppressHydrationWarning id={`${id}-espera`}>
            {espera}
          </Caixa>
        </Linha>
        {assumivel && (
          <Caixa como="span" aria-hidden="true" className="text-sm font-medium text-primary">
            {assumindo ? "Assumindo…" : "Assumir"}
          </Caixa>
        )}
      </Caixa>
    </Linha>
  );

  return clicavel ? (
    <Caixa
      como="button"
      type="button"
      onClick={assumivel ? onAssumir : onLer}
      disabled={assumivel && assumindo}
      aria-labelledby={`${id}-acao ${id}-contato ${id}-empresa`}
      aria-describedby={[origem && `${id}-origem`, resumo && `${id}-resumo`, `${id}-espera`]
        .filter(Boolean)
        .join(" ")}
      className={cn(
        MOLDURA,
        "bg-card hover:bg-accent disabled:opacity-60 pointer-coarse:min-h-11",
        !assumivel && "border-dashed",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {conteudo}
    </Caixa>
  ) : (
    <Caixa className={cn(MOLDURA, "border-dashed bg-transparent")}>{conteudo}</Caixa>
  );
}
