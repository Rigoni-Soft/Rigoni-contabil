import { ArrowDown } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ID_DO_PAINEL_DE_ACOES } from "@/presentation/components/organisms/painel-de-acoes.component";
import { cn } from "@/presentation/lib/utils";

type PainelDoChatProps = {
  estado: "vazio" | "abrindo" | "erro" | "pronto";
  onVoltar: () => void;
  comAcoes?: boolean;
  ref?: React.Ref<HTMLElement>;
  children?: React.ReactNode;
};

export function PainelDoChat({
  estado,
  onVoltar,
  comAcoes = false,
  ref,
  children,
}: PainelDoChatProps) {
  return (
    <Caixa
      como="section"
      aria-label="Conversa"
      ref={ref}
      tabIndex={-1}
      className={cn(
        "min-h-0 flex-1 flex-col gap-3 outline-none lg:flex",
        estado === "vazio" ? "hidden lg:flex" : "flex",
      )}
    >
      {estado !== "vazio" && (
        <Linha justificar="entre" alinhar="centro" espaco={3} className="shrink-0 lg:hidden">
          <Caixa
            como="button"
            type="button"
            onClick={onVoltar}
            className="inline-flex min-h-6 items-center rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background pointer-coarse:min-h-11"
          >
            ← Voltar à lista
          </Caixa>
          {estado === "pronto" && comAcoes && (
            <Caixa
              como="a"
              href={`#${ID_DO_PAINEL_DE_ACOES}`}
              className="inline-flex min-h-6 items-center gap-1 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background pointer-coarse:min-h-11"
            >
              Ir para as ações
              <ArrowDown aria-hidden="true" className="size-4" />
            </Caixa>
          )}
        </Linha>
      )}
      {estado === "vazio" && (
        <Texto variante="apoio" className="m-auto">
          Escolha um atendimento para conversar.
        </Texto>
      )}
      {estado === "abrindo" && (
        <Texto variante="apoio" role="status">
          Abrindo a conversa…
        </Texto>
      )}
      {estado === "erro" && (
        <Texto variante="alerta" role="alert">
          Não foi possível abrir a conversa.
        </Texto>
      )}
      {estado === "pronto" && children}
    </Caixa>
  );
}
