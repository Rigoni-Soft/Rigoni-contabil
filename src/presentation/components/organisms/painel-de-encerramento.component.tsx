import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
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
    <Pilha espaco={2}>
      <TituloDoGrupo>Encerrar Atendimento</TituloDoGrupo>
      {confirmando ? (
        <Pilha
          espaco={2}
          role="alertdialog"
          aria-label="Confirmar encerramento"
          aria-describedby="encerramento-pergunta"
        >
          <Texto variante="corpo" id="encerramento-pergunta">
            O cliente será avisado de que o Atendimento foi encerrado. Encerrar agora?
          </Texto>
          <Linha espaco={2}>
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
          </Linha>
        </Pilha>
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
    </Pilha>
  );
}
