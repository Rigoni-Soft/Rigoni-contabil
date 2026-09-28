import { CheckCircle2, XCircle } from "lucide-react";

type RegistroAcaoView = {
  id: string;
  ator: string;
  setor: string;
  acao: string;
  alvo: string;
  resultado: string;
  dataHora: string;
};

type AuditoriaFeedProps = { registros: RegistroAcaoView[] };

export function AuditoriaFeed({ registros }: AuditoriaFeedProps) {
  if (registros.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhuma ação registrada ainda.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Data/hora
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Ator
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Setor
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Ação
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Alvo
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Resultado
            </th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => {
            const sucesso = registro.resultado === "sucesso";
            return (
              <tr key={registro.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                  {registro.dataHora}
                </td>
                <td className="px-3 py-2">{registro.ator}</td>
                <td className="px-3 py-2">{registro.setor}</td>
                <td className="px-3 py-2">{registro.acao}</td>
                <td className="px-3 py-2">{registro.alvo}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1.5 ${sucesso ? "text-primary" : "text-destructive"}`}
                  >
                    {sucesso ? (
                      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    {registro.resultado}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
