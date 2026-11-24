import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import { cn } from "@/presentation/lib/utils";

type AvisoDeStatusProps = {
  tipo: "erro" | "sucesso" | "atencao";
  texto: React.ReactNode;
  // Texto que a pessoa precisa ler para agir (resultado de uma ação): 14 px em vez dos 12 px do aviso
  // padrão; o ícone desce 2 px para ficar na primeira linha de 20 px.
  legivel?: boolean;
  className?: string;
  // Para o campo apontar para o aviso (aria-describedby).
  id?: string;
  // Para levar o foco ao resultado quando o botão que o pediu sai da tela (tabIndex -1: só por código).
  ref?: React.Ref<HTMLParagraphElement>;
  tabIndex?: number;
};

// Erro é anunciado como alerta; sucesso e atenção, como status. Ícone + texto + cor, nunca só cor
// (DESIGN.md "Indicadores de estado"): sucesso é `primary`, não `success` (o dourado é do selo "em
// dia"). Atenção é o que não falhou nem terminou, algo que pede conferência: `Clock` em cor neutra,
// o mesmo par do selo "A confirmar".
const POR_TIPO = {
  erro: { Icone: AlertCircle, cor: "text-destructive", role: "alert" },
  sucesso: { Icone: CheckCircle2, cor: "text-primary", role: "status" },
  atencao: { Icone: Clock, cor: "text-foreground", role: "status" },
} as const;

export function AvisoDeStatus({
  tipo,
  texto,
  legivel,
  className,
  id,
  ref,
  tabIndex,
}: AvisoDeStatusProps) {
  const { Icone, cor, role } = POR_TIPO[tipo];
  return (
    <p
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      role={role}
      className={cn("flex items-start gap-1.5", legivel ? "text-sm" : "text-xs", cor, className)}
    >
      <Icone
        className={cn("size-3.5 shrink-0", legivel ? "mt-[3px]" : "mt-px")}
        aria-hidden="true"
      />
      <span>{texto}</span>
    </p>
  );
}
