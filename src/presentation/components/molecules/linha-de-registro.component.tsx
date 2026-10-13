import { CelulaDeTabela } from "@/presentation/components/atoms/celula-de-tabela.component";
import { SeloDeResultado } from "@/presentation/components/atoms/selo-de-resultado.component";

export type RegistroAcaoView = {
  id: string;
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: string;
  dataHora: string;
};

// Uma linha do feed de auditoria: data/hora, ator, setor, ação, alvo e o resultado com ícone.
export function LinhaDeRegistro({ registro }: { registro: RegistroAcaoView }) {
  return (
    <tr className="border-b border-border last:border-0">
      <CelulaDeTabela numerica>{registro.dataHora}</CelulaDeTabela>
      <CelulaDeTabela>{registro.ator}</CelulaDeTabela>
      <CelulaDeTabela>{registro.setor}</CelulaDeTabela>
      <CelulaDeTabela>{registro.acao}</CelulaDeTabela>
      <CelulaDeTabela>{registro.alvo}</CelulaDeTabela>
      <CelulaDeTabela>
        <SeloDeResultado resultado={registro.resultado} />
      </CelulaDeTabela>
    </tr>
  );
}
