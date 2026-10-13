import { CabecalhoDeColuna } from "@/presentation/components/atoms/celula-de-tabela.component";
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
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-muted-foreground">
          <tr>
            {COLUNAS.map((coluna) => (
              <CabecalhoDeColuna key={coluna}>{coluna}</CabecalhoDeColuna>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <LinhaDeRegistro key={registro.id} registro={registro} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
