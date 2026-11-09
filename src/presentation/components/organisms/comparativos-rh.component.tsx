import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { BarrasDeFatias } from "@/presentation/components/molecules/barras-de-fatias.component";
import { DonutDeFatias } from "@/presentation/components/molecules/donut-de-fatias.component";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";

type Props = {
  acompanhamento: Fatia[];
  parcelamento: Fatia[];
  // Só quem vê o acompanhamento dos funcionários (Líder e Admin) recebe; cada Responsável leva ao detalhe dele.
  responsaveis?: Fatia[];
  totalClientes: number;
};

// ponytail: esqueleto repetido de comparativos-sn.component.tsx; parametrizar um só quando um 3º Setor tiver comparativos.
export function ComparativosRh({
  acompanhamento,
  parcelamento,
  responsaveis,
  totalClientes,
}: Props) {
  return (
    <Pilha espaco={4} como="section" aria-labelledby="comparativos-rh-titulo">
      <Texto variante="subtitulo" como="h2" id="comparativos-rh-titulo">
        Comparativos
      </Texto>
      <Caixa
        className={
          responsaveis ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "grid gap-4 md:grid-cols-2"
        }
      >
        <DonutDeFatias titulo="Status do acompanhamento" fatias={acompanhamento} />
        <BarrasDeFatias
          titulo="Status do parcelamento"
          fatias={parcelamento}
          totalClientes={totalClientes}
          nota="Um cliente pode estar em mais de uma situação."
        />
        {responsaveis && (
          <BarrasDeFatias
            titulo="Clientes por Responsável"
            fatias={responsaveis}
            totalClientes={totalClientes}
            nota="Clientes da carteira do RH, por Responsável. Clique no nome para ver o acompanhamento dele."
          />
        )}
      </Caixa>
    </Pilha>
  );
}
