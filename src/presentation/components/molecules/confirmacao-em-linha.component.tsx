import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

// Botões da linha de uma guia: ficam aria-disabled (não perdem o foco) durante uma ação em curso.
export const BOTAO_DA_GUIA =
  "aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11";

type ConfirmacaoEmLinhaProps = {
  // O que vai acontecer, dito antes (anunciado como alerta ao abrir).
  texto: React.ReactNode;
  rotuloDoConfirmar: string;
  rotuloEmCurso: string;
  nomeDoConfirmar: string;
  nomeDoCancelar: string;
  destrutiva?: boolean;
  // A pessoa já confirmou e o servidor ainda responde.
  emCurso: boolean;
  // Outra ação em curso: o botão segue focável, mas avisa em vez de agir.
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

// Pergunta de risco dentro da linha: o texto, "confirmar" e "Cancelar". O foco abre no Cancelar, o
// gesto seguro para quem abriu sem querer.
export function ConfirmacaoEmLinha({
  texto,
  rotuloDoConfirmar,
  rotuloEmCurso,
  nomeDoConfirmar,
  nomeDoCancelar,
  destrutiva,
  emCurso,
  ocupado,
  onConfirmar,
  onCancelar,
}: ConfirmacaoEmLinhaProps) {
  return (
    <>
      <Texto variante="corpo" role="alert" className="basis-full">
        {texto}
      </Texto>
      <Button
        type="button"
        variant={destrutiva ? "destructive" : "default"}
        size="sm"
        aria-disabled={ocupado || undefined}
        onClick={onConfirmar}
        aria-label={nomeDoConfirmar}
        className={BOTAO_DA_GUIA}
      >
        {emCurso ? rotuloEmCurso : rotuloDoConfirmar}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        autoFocus
        onClick={onCancelar}
        aria-label={nomeDoCancelar}
        className={BOTAO_DA_GUIA}
      >
        Cancelar
      </Button>
    </>
  );
}
