import { Clock } from "lucide-react";

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
  espera: string;
  // Dirigido a outro usuário: o card só informa, não assume.
  assumivel: boolean;
  assumindo?: boolean;
  onAssumir: () => void;
};

const MOLDURA = "w-full rounded-lg border border-border bg-card px-3 py-2 text-left";

export function CardDeEspera({
  id,
  contato,
  empresa,
  resumo,
  espera,
  assumivel,
  assumindo = false,
  onAssumir,
}: CardDeEsperaProps) {
  const conteudo = (
    <Linha alinhar="inicio" espaco={3}>
      <Caixa como="span" className="min-w-0 flex-1">
        <Texto como="span" variante="somenteLeitor" id={`${id}-acao`}>
          Assumir o atendimento de
        </Texto>
        <Texto como="span" variante="destaque" className="block truncate" id={`${id}-contato`}>
          {contato}
        </Texto>
        <Texto como="span" variante="apoio" className="block truncate" id={`${id}-empresa`}>
          {empresa}
        </Texto>
        {resumo && (
          <Texto como="span" variante="nota" className="block truncate" id={`${id}-resumo`}>
            {resumo}
          </Texto>
        )}
        {!assumivel && (
          <Texto como="span" variante="nota" className="block">
            Dirigido a outro usuário
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

  return assumivel ? (
    <Caixa
      como="button"
      type="button"
      onClick={onAssumir}
      disabled={assumindo}
      // O nome é a ação e quem espera; o resumo e o tempo de espera entram como descrição, para o
      // leitor de tela dizer o que decide quem assumir (um aria-label os esconderia).
      aria-labelledby={`${id}-acao ${id}-contato ${id}-empresa`}
      aria-describedby={resumo ? `${id}-resumo ${id}-espera` : `${id}-espera`}
      className={cn(MOLDURA, "hover:bg-accent disabled:opacity-60 pointer-coarse:min-h-11")}
    >
      {conteudo}
    </Caixa>
  ) : (
    <Caixa className={MOLDURA}>{conteudo}</Caixa>
  );
}
