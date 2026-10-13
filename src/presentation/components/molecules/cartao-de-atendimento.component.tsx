import Link from "next/link";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { IconeDeConversa } from "@/presentation/components/atoms/icone-de-conversa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type CartaoDeAtendimentoProps = {
  href: string;
  titulo: string;
  detalhe: string;
  // Início da última mensagem da conversa.
  previa?: string | null;
  // O cliente escreveu por último e espera resposta: ponto vermelho e prévia em destaque.
  aguardando?: boolean;
};

// Entra deslizando de baixo (só para quem não pediu movimento reduzido).
export function CartaoDeAtendimento({
  href,
  titulo,
  detalhe,
  previa,
  aguardando = false,
}: CartaoDeAtendimentoProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-md hover:bg-accent motion-safe:animate-dock-entrada"
    >
      <IconeDeConversa aguardando={aguardando} />
      <Caixa como="span" className="min-w-0">
        <Texto como="span" variante="destaque" className="block truncate">
          {titulo}
          {aguardando && (
            <Texto variante="somenteLeitor" como="span">
              {" "}
              — nova mensagem
            </Texto>
          )}
        </Texto>
        <Texto como="span" variante="apoio" className="block truncate">
          {detalhe}
        </Texto>
        {previa && (
          <Texto
            como="span"
            variante="nota"
            className={cn("block truncate", aguardando && "font-medium text-foreground")}
          >
            {previa}
          </Texto>
        )}
      </Caixa>
    </Link>
  );
}
