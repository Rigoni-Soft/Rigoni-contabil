import { MessageCircle } from "lucide-react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type CardDeConversaProps = {
  titulo: string;
  detalhe: string;
  previa?: string | null;
  // O cliente escreveu por último e espera resposta.
  aguardando?: boolean;
  aberto?: boolean;
  onAbrir: () => void;
};

// O Atendimento do usuário na aba "Em atendimento": abre o chat no centro, sem trocar de rota.
export function CardDeConversa({
  titulo,
  detalhe,
  previa,
  aguardando = false,
  aberto = false,
  onAbrir,
}: CardDeConversaProps) {
  return (
    <Caixa
      como="button"
      type="button"
      onClick={onAbrir}
      aria-current={aberto ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-accent pointer-coarse:min-h-11",
        aberto && "border-primary bg-accent",
      )}
    >
      <Caixa como="span" className="relative shrink-0">
        <MessageCircle aria-hidden="true" className="size-5 text-primary" />
        {aguardando && (
          <Caixa
            como="span"
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive"
          />
        )}
      </Caixa>
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
    </Caixa>
  );
}
