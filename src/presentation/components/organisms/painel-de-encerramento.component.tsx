import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { TituloDoGrupo } from "@/presentation/components/atoms/titulo-de-grupo.component";
import { Button } from "@/presentation/components/ui/button";

type PainelDeEncerramentoProps = {
  confirmando: boolean;
  encerrando: boolean;
  onPedir: () => void;
  onCancelar: () => void;
  onConfirmar: () => void;
  aviso?: { tipo: "erro" | "sucesso"; texto: string };
};

// Encerrar não tem volta: o primeiro clique só pede a confirmação.
export function PainelDeEncerramento({
  confirmando,
  encerrando,
  onPedir,
  onCancelar,
  onConfirmar,
  aviso,
}: PainelDeEncerramentoProps) {
  return (
    <div className="space-y-2">
      <TituloDoGrupo>Encerrar Atendimento</TituloDoGrupo>
      {confirmando ? (
        <div
          role="alertdialog"
          aria-label="Confirmar encerramento"
          aria-describedby="encerramento-pergunta"
          className="space-y-2"
        >
          <p id="encerramento-pergunta" className="text-sm text-foreground">
            O cliente será avisado de que o Atendimento foi encerrado. Encerrar agora?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="pointer-coarse:h-11"
              disabled={encerrando}
              onClick={onConfirmar}
            >
              {encerrando ? "Encerrando..." : "Confirmar encerramento"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              // O botão que pediu a confirmação sumiu: leva o foco do teclado para a saída segura.
              autoFocus
              // aria-disabled (não disabled) para o foco não se perder enquanto encerra.
              aria-disabled={encerrando}
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:h-11"
              onClick={() => !encerrando && onCancelar()}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="pointer-coarse:h-11"
          onClick={onPedir}
        >
          Encerrar atendimento
        </Button>
      )}
      {aviso && <AvisoDeStatus {...aviso} />}
    </div>
  );
}
