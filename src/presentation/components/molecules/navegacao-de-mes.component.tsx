import { ChevronLeft, ChevronRight } from "lucide-react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type NavegacaoDeMesProps = {
  rotuloMes: string;
  anteriorHref: string;
  // Sem próximo no mês corrente.
  proximoHref?: string;
  // Cabeçalho do cartão: faixa com borda e mês maior, para o mês de referência ser o que se vê primeiro.
  destaque?: boolean;
  className?: string;
};

// Só texto e seta; ativo em cor de ação, inativo apagado (a cor carrega o estado).
// justify-self-start: o link do mês anterior fica rente à esquerda, simétrico ao Próximo mês rente à direita (sem ele o link
// se estica na coluna e o texto fica perto do mês).
const ATIVO = "px-2 font-semibold text-primary hover:text-primary";
const INATIVO = "inline-flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground";

// Mês anterior, mês em tela e próximo: o mês fica no centro mesmo quando falta o próximo.
export function NavegacaoDeMes({
  rotuloMes,
  anteriorHref,
  proximoHref,
  destaque,
  className,
}: NavegacaoDeMesProps) {
  return (
    <Caixa
      como="nav"
      aria-label="Mês do acompanhamento"
      className={cn(
        "grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]",
        destaque && "rounded-md border border-border bg-muted/50 px-3 py-2",
        className,
      )}
    >
      <LinkDeAcao href={anteriorHref} variant="ghost" className={cn(ATIVO, "justify-self-start")}>
        <ChevronLeft className="size-4" aria-hidden="true" />
        Mês anterior
      </LinkDeAcao>
      <Texto
        como="span"
        variante="subtitulo"
        aria-current="date"
        className={cn(
          "col-span-2 text-center first-letter:uppercase sm:order-none sm:col-span-1",
          "order-first",
          destaque && "text-lg font-semibold",
        )}
      >
        {rotuloMes}
      </Texto>
      <Caixa className="justify-self-end">
        {proximoHref ? (
          <LinkDeAcao href={proximoHref} variant="ghost" className={ATIVO}>
            Próximo mês
            <ChevronRight className="size-4" aria-hidden="true" />
          </LinkDeAcao>
        ) : (
          // Mês corrente: o avanço aparece apagado e sem link, o estado se lê pela cor.
          <Texto como="span" variante="apoio" className={INATIVO}>
            Próximo mês
            <Texto como="span" variante="somenteLeitor">
              indisponível: este é o mês corrente
            </Texto>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Texto>
        )}
      </Caixa>
    </Caixa>
  );
}
