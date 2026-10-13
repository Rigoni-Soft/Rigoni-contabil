import { BarrasDeFatias } from "@/presentation/components/molecules/barras-de-fatias.component";
import { DonutDeFatias } from "@/presentation/components/molecules/donut-de-fatias.component";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";

type Props = {
  comparativos: { das: Fatia[]; parcelamento: Fatia[]; atividade: Fatia[] };
  // Só o Líder recebe (#65): 4º comparativo, Funcionários por DAS enviada.
  responsaveis?: Fatia[];
  totalClientes: number;
};

export function ComparativosSn({ comparativos, responsaveis, totalClientes }: Props) {
  return (
    <section aria-labelledby="comparativos-titulo" className="space-y-4">
      <h2 id="comparativos-titulo" className="text-lg font-semibold text-foreground">
        Comparativos
      </h2>
      <div
        className={
          responsaveis ? "grid gap-4 md:grid-cols-2" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        }
      >
        <DonutDeFatias titulo="Status do DAS" fatias={comparativos.das} />
        <DonutDeFatias titulo="Status do parcelamento" fatias={comparativos.parcelamento} />
        <BarrasDeFatias
          titulo="Atividade do mês"
          fatias={comparativos.atividade}
          totalClientes={totalClientes}
          nota="Um cliente pode estar em mais de uma atividade no mês."
          className={responsaveis ? "" : "md:col-span-2 lg:col-span-1"}
        />
        {responsaveis && (
          <BarrasDeFatias
            titulo="Envio de DAS por Responsável"
            fatias={responsaveis}
            totalClientes={totalClientes}
            nota="Clientes com DAS enviada, por Responsável."
          />
        )}
      </div>
    </section>
  );
}
