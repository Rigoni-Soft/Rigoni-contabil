import { cn } from "@/presentation/lib/utils";

type AvisoDeStatusProps = { tipo: "erro" | "sucesso"; texto: string };

// Erro é anunciado como alerta; sucesso, como status.
export function AvisoDeStatus({ tipo, texto }: AvisoDeStatusProps) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={cn("text-xs", tipo === "erro" ? "text-destructive" : "text-success")}
    >
      {texto}
    </p>
  );
}
