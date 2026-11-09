import Link from "next/link";

import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { BarrasDeFatias } from "@/presentation/components/molecules/barras-de-fatias.component";
import { DonutDeFatias } from "@/presentation/components/molecules/donut-de-fatias.component";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";
import { ROTA_RH_FUNCIONARIOS } from "@/shared/kernel/setores";

type Props = {
  acompanhamento: Fatia[];
  parcelamento: Fatia[];
  // Só quem vê o acompanhamento dos funcionários (Líder e Admin) recebe; o card inteiro abre a lista deles.
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
          <Link
            href={ROTA_RH_FUNCIONARIOS}
            className="rounded-lg hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <BarrasDeFatias
              titulo="Clientes por Responsável"
              fatias={responsaveis}
              totalClientes={totalClientes}
              nota="Clientes da carteira do RH, por Responsável. Clique para ver o acompanhamento de cada Funcionário."
            />
          </Link>
        )}
      </Caixa>
    </Pilha>
  );
}
