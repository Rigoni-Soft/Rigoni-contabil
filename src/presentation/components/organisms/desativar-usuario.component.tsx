import { AlertTriangle } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

type DesativarUsuarioProps = {
  nome: string;
  confirmando: boolean;
  pendente: boolean;
  erro?: string;
  aoPedirConfirmacao: () => void;
  aoCancelar: () => void;
  aoConfirmar: () => void;
};

export function DesativarUsuario({
  nome,
  confirmando,
  pendente,
  erro,
  aoPedirConfirmacao,
  aoCancelar,
  aoConfirmar,
}: DesativarUsuarioProps) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {confirmando ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            autoFocus
            aria-label={`Confirmar desativação de ${nome}`}
            onClick={aoConfirmar}
          >
            Confirmar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={aoCancelar}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendente}
          aria-label={`Desativar ${nome}`}
          onClick={aoPedirConfirmacao}
        >
          Desativar
        </Button>
      )}
      {erro && (
        <p role="alert" className="flex items-center gap-1 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
    </div>
  );
}
