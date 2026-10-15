import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import {
  CelulaDeTabela,
  LinhaDeTabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { cn } from "@/presentation/lib/utils";

export type RegistroAcaoView = {
  id: string;
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: string;
  dataHora: string;
};

// Resultado com ícone + texto + cor, nunca só cor. "falha_compensacao" ganha ícone próprio: ao
// contrário de uma falha comum, pode ter deixado estado inconsistente que exige reconciliação.
const ICONE_POR_RESULTADO: Record<string, typeof XCircle> = {
  sucesso: CheckCircle2,
  falha_compensacao: AlertTriangle,
};

// Uma linha do feed de auditoria: data/hora, ator, setor, ação, alvo e o resultado com ícone.
export function LinhaDeRegistro({ registro }: { registro: RegistroAcaoView }) {
  const Icone = ICONE_POR_RESULTADO[registro.resultado] ?? XCircle;
  return (
    <LinhaDeTabela>
      <CelulaDeTabela numerica>{registro.dataHora}</CelulaDeTabela>
      <CelulaDeTabela>{registro.ator}</CelulaDeTabela>
      <CelulaDeTabela>{registro.setor}</CelulaDeTabela>
      <CelulaDeTabela>{registro.acao}</CelulaDeTabela>
      <CelulaDeTabela>{registro.alvo}</CelulaDeTabela>
      <CelulaDeTabela>
        <Caixa
          como="span"
          className={cn(
            "inline-flex items-center gap-1.5",
            registro.resultado === "sucesso" ? "text-primary" : "text-destructive",
          )}
        >
          <Icone className="size-3.5 shrink-0" aria-hidden="true" />
          {registro.resultado}
        </Caixa>
      </CelulaDeTabela>
    </LinhaDeTabela>
  );
}
