import { AlertTriangle } from "lucide-react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type DesativarUsuarioProps = {
  nome: string;
  // Conta já desativada cujo bloqueio no Auth falhou: um clique repete, sem confirmação.
  bloqueioPendente?: boolean;
  confirmando: boolean;
  pendente: boolean;
  erro?: string;
  aoPedirConfirmacao: () => void;
  aoCancelar: () => void;
  aoConfirmar: () => void;
};

export function DesativarUsuario({
  nome,
  bloqueioPendente = false,
  confirmando,
  pendente,
  erro,
  aoPedirConfirmacao,
  aoCancelar,
  aoConfirmar,
}: DesativarUsuarioProps) {
  return (
    <Caixa className="flex shrink-0 flex-col items-end gap-1">
      {bloqueioPendente ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendente}
          aria-label={`Concluir bloqueio de ${nome}`}
          onClick={aoConfirmar}
        >
          Concluir bloqueio
        </Button>
      ) : confirmando ? (
        <Caixa className="flex gap-2">
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
        </Caixa>
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
        <Texto
          variante="livre"
          role="alert"
          className="flex items-center gap-1 text-sm text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {erro}
        </Texto>
      )}
    </Caixa>
  );
}
