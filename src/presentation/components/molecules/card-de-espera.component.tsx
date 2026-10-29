import { Clock, Eye } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

export type CardDeEsperaProps = {
  // Base dos ids que ligam o nome e a descrição do botão ao texto do card.
  id: string;
  contato: string;
  empresa: string;
  // O que o cliente já disse ou escolheu antes de chegar à espera.
  resumo: string | null;
  // De onde veio, se foi transferido ("Transferido de Financeiro por Fulano").
  origem?: string | null;
  espera: string;
  // Dirigido a outro usuário ou sem permissão de assumir: o card só informa, não assume.
  assumivel: boolean;
  // A espera é dirigida a um usuário (e não a do Setor): muda o motivo de não assumir.
  dirigido?: boolean;
  assumindo?: boolean;
  onAssumir: () => void;
  // Dirigido a outro, para quem supervisiona: abre a conversa só para leitura.
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
          <Texto como="span" variante="nota" className="block truncate" id={`${id}-resumo`}>
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
      <Linha como="span" alinhar="centro" espaco={1} className="shrink-0 text-sm tabular-nums">
        <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
        <Texto como="span" variante="somenteLeitor">
          Esperando há{" "}
        </Texto>
        {/* O relógio do navegador difere do servidor: o texto muda de propósito a cada segundo. */}
        <Caixa como="span" suppressHydrationWarning id={`${id}-espera`}>
          {espera}
        </Caixa>
      </Linha>
    </Linha>
  );

  return clicavel ? (
    <Caixa
      como="button"
      type="button"
      onClick={assumivel ? onAssumir : onLer}
      disabled={assumivel && assumindo}
      // O nome é a ação e quem espera; o resumo e o tempo de espera entram como descrição, para o
      // leitor de tela dizer o que decide quem assumir (um aria-label os esconderia).
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
    // Só informa: sem o fundo de cartão clicável, para não parecer um botão.
    <Caixa className={cn(MOLDURA, "border-dashed bg-transparent")}>{conteudo}</Caixa>
  );
}
