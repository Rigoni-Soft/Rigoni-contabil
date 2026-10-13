import type { ComponentProps, ElementType } from "react";

type CaixaProps<T extends ElementType> = { como?: T } & Omit<ComponentProps<T>, "como">;

// Átomo estrutural: o contêiner de layout (div, section, form, ul, li…). É por aqui que molécula,
// organismo, template e page agrupam conteúdo, sem elemento HTML cru (arquitetura.md 4.4).
export function Caixa<T extends ElementType = "div">({ como, ...props }: CaixaProps<T>) {
  const Elemento: ElementType = como ?? "div";
  return <Elemento {...props} />;
}
