import { cn } from "@/presentation/lib/utils";

type HoraDaMensagemProps = {
  hora: string;
  // Sobre o fundo primário a hora herda a cor do balão (contraste ≥ 4,5:1 nos dois temas).
  sobrePrimario?: boolean;
};

export function HoraDaMensagem({ hora, sobrePrimario = false }: HoraDaMensagemProps) {
  return (
    <p
      className={cn(
        "mt-0.5 text-right text-xs",
        sobrePrimario ? "opacity-90" : "text-muted-foreground",
      )}
    >
      {hora}
    </p>
  );
}
