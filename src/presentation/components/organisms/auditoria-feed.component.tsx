import {
  CabecalhoDeColuna,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  LinhaDeRegistro,
  type RegistroAcaoView,
} from "@/presentation/components/molecules/linha-de-registro.component";

const COLUNAS = ["Data/hora", "Ator", "Setor", "Ação", "Alvo", "Resultado"];

type AuditoriaFeedProps = { registros: RegistroAcaoView[] };

export function AuditoriaFeed({ registros }: AuditoriaFeedProps) {
  if (registros.length === 0) {
    return (
      <Texto
        variante="apoio"
        className="rounded-lg border border-dashed border-border p-6 text-center"
      >
        Nenhuma ação registrada ainda.
      </Texto>
    );
  }

  return (
    <Tabela
      colunas={COLUNAS.map((coluna) => (
        <CabecalhoDeColuna key={coluna}>{coluna}</CabecalhoDeColuna>
      ))}
    >
      {registros.map((registro) => (
        <LinhaDeRegistro key={registro.id} registro={registro} />
      ))}
    </Tabela>
  );
}
