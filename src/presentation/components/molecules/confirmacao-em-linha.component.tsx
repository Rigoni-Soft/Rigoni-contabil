import { BotaoDaGuia } from "@/presentation/components/atoms/botao-da-guia.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

type ConfirmacaoEmLinhaProps = {
  // O que vai acontecer, dito antes (anunciado como alerta ao abrir).
  texto: React.ReactNode;
  // Liga a pergunta aos botões (aria-describedby): o foco que abre no botão ainda faz o leitor de tela ler o texto.
  idDoTexto?: string;
  rotuloDoConfirmar: string;
  rotuloEmCurso: string;
  nomeDoConfirmar: string;
  nomeDoCancelar: string;
  // Texto do botão de recusar; sem ele, "Cancelar".
  rotuloDoCancelar?: string;
  // Onde o foco abre: no cancelar (o gesto seguro, padrão) ou no confirmar, quando a pessoa acabou de pedir a ação.
  focoInicial?: "cancelar" | "confirmar";
  destrutiva?: boolean;
  // A pessoa já confirmou e o servidor ainda responde.
  emCurso: boolean;
  // Outra ação em curso: o botão segue focável, mas avisa em vez de agir.
  ocupado: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
};

// Pergunta de risco dentro da linha: o texto, "confirmar" e "Cancelar". O foco abre no Cancelar, o
// gesto seguro para quem abriu sem querer (`focoInicial` o leva ao confirmar quando o DESIGN.md pede).
export function ConfirmacaoEmLinha({
  texto,
  idDoTexto,
  rotuloDoConfirmar,
  rotuloEmCurso,
  nomeDoConfirmar,
  nomeDoCancelar,
  rotuloDoCancelar = "Cancelar",
  focoInicial = "cancelar",
  destrutiva,
  emCurso,
  ocupado,
  onConfirmar,
  onCancelar,
}: ConfirmacaoEmLinhaProps) {
  return (
    <>
      <Texto variante="corpo" role="alert" id={idDoTexto} className="basis-full">
        {texto}
      </Texto>
      <BotaoDaGuia
        variant={destrutiva ? "destructive" : "default"}
        ocupado={ocupado}
        autoFocus={focoInicial === "confirmar"}
        onClick={onConfirmar}
        aria-label={nomeDoConfirmar}
        aria-describedby={idDoTexto}
      >
        {emCurso ? rotuloEmCurso : rotuloDoConfirmar}
      </BotaoDaGuia>
      <BotaoDaGuia
        variant="outline"
        autoFocus={focoInicial === "cancelar"}
        onClick={onCancelar}
        aria-label={nomeDoCancelar}
        aria-describedby={idDoTexto}
      >
        {rotuloDoCancelar}
      </BotaoDaGuia>
    </>
  );
}
