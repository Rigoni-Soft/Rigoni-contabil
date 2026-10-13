import type { ComponentProps, ElementType } from "react";

import { cn } from "@/presentation/lib/utils";

export type CaixaProps<T extends ElementType> = { como?: T } & Omit<ComponentProps<T>, "como">;

// Átomo estrutural: o contêiner de layout (div, section, form, ul, li…). É por aqui que molécula,
// organismo, template e page agrupam conteúdo, sem elemento HTML cru (arquitetura.md 4.4).
export function Caixa<T extends ElementType = "div">({ como, ...props }: CaixaProps<T>) {
  const Elemento: ElementType = como ?? "div";
  return <Elemento {...props} />;
}

// Ritmo vertical do produto (DESIGN.md → Layout): os filhos empilham com um espaço nomeado, em vez
// de `space-y-*`/`gap-*` soltos em cada tela.
const ESPACO = {
  1: "space-y-1",
  2: "space-y-2",
  3: "space-y-3",
  4: "space-y-4",
  6: "space-y-6",
  8: "space-y-8",
  // rótulo + campo + erro
  campo: "flex flex-col gap-1.5",
  // campos de um formulário
  formulario: "flex flex-col gap-5",
} as const;

type PilhaProps<T extends ElementType> = CaixaProps<T> & { espaco: keyof typeof ESPACO };

export function Pilha<T extends ElementType = "div">({
  espaco,
  como,
  className,
  ...props
}: PilhaProps<T>) {
  const Elemento: ElementType = como ?? "div";
  return <Elemento className={cn(ESPACO[espaco], className as string | undefined)} {...props} />;
}
