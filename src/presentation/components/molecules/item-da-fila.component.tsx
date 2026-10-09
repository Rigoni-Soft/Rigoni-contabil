import { Clock } from "lucide-react";

export type ItemDaFilaProps = {
  posicao: number;
  contato: string;
  empresa: string;
  cnpj: string | null;
  telefone: string;
  resumo: string | null;
  daFilaDeUsuario: boolean;
  espera: string;
};

export function ItemDaFila({
  posicao,
  contato,
  empresa,
  cnpj,
  telefone,
  resumo,
  daFilaDeUsuario,
  espera,
}: ItemDaFilaProps) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        <span className="sr-only">Posição </span>
        {posicao}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words text-foreground">{contato}</p>
        <p className="text-sm break-words text-muted-foreground">
          {empresa}
          {cnpj && (
            <>
              {" · "}
              <span className="whitespace-nowrap">{cnpj}</span>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground">{telefone}</p>
        {resumo && <p className="mt-1 text-sm break-words text-foreground">{resumo}</p>}
        {daFilaDeUsuario && (
          <p className="mt-1 text-sm text-muted-foreground">Fila de um usuário</p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm text-foreground tabular-nums">
        <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="sr-only">Esperando há </span>
        <span>{espera}</span>
      </span>
    </li>
  );
}
