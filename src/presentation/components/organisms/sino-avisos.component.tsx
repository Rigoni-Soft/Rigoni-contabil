import { Bell, X } from "lucide-react";

import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  ItemDeAviso,
  type AvisoDeCadastro,
} from "@/presentation/components/molecules/item-de-aviso.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type SinoAvisosProps = {
  // Liga o sino ao modal; único na página.
  painelId: string;
  contador: number;
  avisos: AvisoDeCadastro[];
  estado: "carregando" | "erro" | "pronto";
  temMais: boolean;
  carregandoMais: boolean;
  // Chamado ao abrir: o Container carrega a lista. Abrir não marca nada como visto.
  aoAbrir: () => void;
  aoSelecionar: (aviso: AvisoDeCadastro) => void;
  aoCarregarMais: () => void;
};

const TETO_DO_SELO = 99;

// Sino fixo do cabeçalho (DESIGN.md → Sino de Avisos de cadastro): maior que o ícone padrão de
// 44 px, com selo de contador e cor de destaque enquanto houver aviso não visto. Abre direto um
// modal nativo (popover) com a lista; só o clique no aviso o marca como visto.
export function SinoAvisos({
  painelId,
  contador,
  avisos,
  estado,
  temMais,
  carregandoMais,
  aoAbrir,
  aoSelecionar,
  aoCarregarMais,
}: SinoAvisosProps) {
  const destaque = contador > 0;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        popoverTarget={painelId}
        onClick={aoAbrir}
        aria-label={destaque ? `Avisos de cadastro, ${contador} não vistos` : "Avisos de cadastro"}
        data-destaque={destaque}
        className={cn(
          "relative size-12 shrink-0 rounded-full pointer-coarse:size-12",
          destaque && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        <Bell aria-hidden="true" className="size-6" />
        {destaque && (
          <Caixa
            como="span"
            data-testid="selo-avisos"
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex min-w-6 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-xs font-bold text-destructive-foreground"
          >
            {contador > TETO_DO_SELO ? `${TETO_DO_SELO}+` : contador}
          </Caixa>
        )}
      </Button>
      <Caixa
        id={painelId}
        popover="auto"
        role="dialog"
        aria-label="Avisos de cadastro"
        className="m-auto max-h-[80dvh] w-[min(92vw,32rem)] flex-col overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-overlay [&:popover-open]:flex"
      >
        <Linha alinhar="centro" justificar="entre" className="border-b border-border px-4 py-1">
          <Texto variante="subtitulo" como="h2">
            Avisos de cadastro
          </Texto>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            popoverTarget={painelId}
            popoverTargetAction="hide"
            aria-label="Fechar avisos"
            className="shrink-0 rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </Linha>
        <Pilha espaco={2} className="min-h-0 flex-1 overflow-auto p-3">
          {estado === "erro" && (
            <Texto variante="alerta" role="alert">
              Não foi possível carregar os avisos.
            </Texto>
          )}
          {estado === "carregando" && (
            <Texto variante="apoio" role="status">
              Carregando…
            </Texto>
          )}
          {estado === "pronto" && avisos.length === 0 && (
            <Texto variante="apoio">Nenhum aviso de cadastro.</Texto>
          )}
          {avisos.map((aviso) => (
            <ItemDeAviso
              key={aviso.id}
              aviso={aviso}
              painelId={painelId}
              aoSelecionar={aoSelecionar}
            />
          ))}
          {temMais && (
            <Button
              type="button"
              variant="outline"
              disabled={carregandoMais}
              onClick={aoCarregarMais}
            >
              Carregar mais
            </Button>
          )}
        </Pilha>
      </Caixa>
    </>
  );
}
