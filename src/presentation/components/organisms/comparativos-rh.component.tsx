import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { BarrasDeFatias } from "@/presentation/components/molecules/barras-de-fatias.component";
import type { Fatia } from "@/presentation/lib/fatia-de-grafico";

type Props = {
  // Só o Líder recebe: Clientes da carteira por Responsável do RH.
  responsaveis: Fatia[];
  totalClientes: number;
};

export function ComparativosRh({ responsaveis, totalClientes }: Props) {
  return (
    <Pilha espaco={4} como="section" aria-labelledby="comparativos-rh-titulo">
      <Texto variante="subtitulo" como="h2" id="comparativos-rh-titulo">
        Comparativos
      </Texto>
      <BarrasDeFatias
        titulo="Clientes por Responsável"
        fatias={responsaveis}
        totalClientes={totalClientes}
        nota="Clientes da carteira do RH, por Responsável."
      />
    </Pilha>
  );
}
