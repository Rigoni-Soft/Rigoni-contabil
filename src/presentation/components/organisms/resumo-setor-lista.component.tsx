import { Caixa, Grade } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ListaDeClientes } from "@/presentation/components/molecules/lista-de-clientes.component";
import {
  SeloDeParcelamento,
  type SeloDoParcelamento,
} from "@/presentation/components/molecules/selo-do-parcelamento.component";

type Cliente = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  parcelamentos?: { codigo: string; interno: boolean; status: SeloDoParcelamento }[];
};

type Props = { clientes: Cliente[]; bucket: string; vazio?: string; rotaBase: string };

function Parcelamentos({
  parcelamentos,
}: {
  parcelamentos: NonNullable<Cliente["parcelamentos"]>;
}) {
  return (
    <Grade como="ul" colunas="parcelamentos" espaco={2} aria-label="Parcelamentos">
      {parcelamentos.map((p) => (
        <Caixa como="li" key={p.codigo} className="col-span-3 grid grid-cols-subgrid items-center">
          <Texto como="span" variante="apoio" className="min-w-0 break-all">
            {p.codigo}
          </Texto>
          {p.interno ? (
            <Texto
              como="span"
              variante="nota"
              className="rounded-full border border-border px-2 py-0.5 font-medium"
            >
              Interno
            </Texto>
          ) : (
            <Caixa como="span" aria-hidden />
          )}
          <SeloDeParcelamento selo={p.status} />
        </Caixa>
      ))}
    </Grade>
  );
}

export function ResumoSetorLista({ clientes, bucket, vazio, rotaBase }: Props) {
  if (clientes.length === 0) {
    return <Texto variante="apoio">{vazio ?? "Nenhum cliente neste status."}</Texto>;
  }

  return (
    <ListaDeClientes
      clientes={clientes.map((cliente) => ({
        clienteId: cliente.clienteId,
        empresa: cliente.empresa,
        cnpj: cliente.cnpj,
        href: `/clientes/${cliente.clienteId}?voltarPara=${encodeURIComponent(`${rotaBase}/${bucket}`)}`,
        detalhes: cliente.parcelamentos && <Parcelamentos parcelamentos={cliente.parcelamentos} />,
      }))}
    />
  );
}
