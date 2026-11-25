import type { ComponentProps, ElementType } from "react";

import { cn } from "@/presentation/lib/utils";

export type CaixaProps<T extends ElementType> = { como?: T } & Omit<ComponentProps<T>, "como">;

export function Caixa<T extends ElementType = "div">({ como, ...props }: CaixaProps<T>) {
  const Elemento: ElementType = como ?? "div";
  const papel = Elemento === "ul" || Elemento === "ol" ? "list" : undefined;
  return <Elemento role={papel} {...props} />;
}

function comClasses(props: unknown, ...classes: (string | false | undefined)[]) {
  const { className, ...resto } = props as { className?: string };
  return { ...resto, className: cn(...classes, className) } as CaixaProps<ElementType>;
}

const ESPACO_VERTICAL = {
  1: "space-y-1",
  2: "space-y-2",
  3: "space-y-3",
  4: "space-y-4",
  6: "space-y-6",
  8: "space-y-8",
  campo: "flex flex-col gap-1.5",
  formulario: "flex flex-col gap-5",
} as const;

type PilhaProps<T extends ElementType> = CaixaProps<T> & {
  espaco: keyof typeof ESPACO_VERTICAL;
};

export function Pilha<T extends ElementType = "div">({ espaco, ...props }: PilhaProps<T>) {
  return <Caixa {...comClasses(props, ESPACO_VERTICAL[espaco])} />;
}

const GAP = { 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 5: "gap-5" } as const;
const ALINHAR = { inicio: "items-start", centro: "items-center", fim: "items-end" } as const;
const JUSTIFICAR = { entre: "justify-between", fim: "justify-end" } as const;

type LinhaProps<T extends ElementType> = CaixaProps<T> & {
  alinhar?: keyof typeof ALINHAR;
  justificar?: keyof typeof JUSTIFICAR;
  espaco?: keyof typeof GAP;
  quebra?: boolean;
};

export function Linha<T extends ElementType = "div">({
  alinhar,
  justificar,
  espaco,
  quebra,
  ...props
}: LinhaProps<T>) {
  return (
    <Caixa
      {...comClasses(
        props,
        "flex",
        alinhar && ALINHAR[alinhar],
        justificar && JUSTIFICAR[justificar],
        espaco && GAP[espaco],
        quebra && "flex-wrap",
      )}
    />
  );
}

const COLUNAS = {
  duas: "grid-cols-2",
  "1>2": "grid-cols-1 sm:grid-cols-2",
  "1>3": "grid-cols-1 sm:grid-cols-3",
  "1>2>4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  "2>3": "grid-cols-2 sm:grid-cols-3",
  "2>4": "grid-cols-2 sm:grid-cols-4",
  "2>3>5": "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  parcelamentos: "grid-cols-[fit-content(20ch)_auto_auto] justify-start",
  rotuloValor: "grid-cols-[auto_1fr]",
  "1>rotulo-valor": "grid-cols-1 sm:grid-cols-[12rem_1fr]",
  "1>2>cabecalho": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1.2fr_1.2fr_2fr]",
} as const;

type GradeProps<T extends ElementType> = CaixaProps<T> & {
  colunas: keyof typeof COLUNAS;
  espaco?: keyof typeof GAP;
};

export function Grade<T extends ElementType = "div">({ colunas, espaco, ...props }: GradeProps<T>) {
  return <Caixa {...comClasses(props, "grid", COLUNAS[colunas], espaco && GAP[espaco])} />;
}
