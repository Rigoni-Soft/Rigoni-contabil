import { Caixa, Grade } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { LinhaDeCliente } from "@/presentation/components/molecules/linha-de-cliente.component";
import {
  SeloDeParcelamento,
  type SeloDoParcelamento,
} from "@/presentation/components/molecules/selo-do-parcelamento.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

// Só os cards do grupo Parcelamento trazem `parcelamentos`.
type Cliente = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  parcelamentos?: { codigo: string; interno: boolean; status: SeloDoParcelamento }[];
};

// `vazio`: por que a lista está vazia (cada card sabe o seu); sem ele, a mensagem padrão.
type Props = { clientes: Cliente[]; bucket: string; vazio?: string };

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

// Lista filtrada de um bucket do resumo, aberta como tela própria. `voltarPara` manda a própria URL
// desta lista, pra "Voltar" na tela de edição trazer de volta pra cá, não pro dashboard.
export function ResumoSetorSnLista({ clientes, bucket, vazio }: Props) {
  if (clientes.length === 0) {
    return <Texto variante="apoio">{vazio ?? "Nenhum cliente neste status."}</Texto>;
  }

  return (
    <ListaComDivisores>
      {clientes.map((cliente) => (
        <Caixa como="li" key={cliente.clienteId}>
          <LinhaDeCliente
            href={`/clientes/${cliente.clienteId}?voltarPara=/clientes/resumo/${bucket}`}
            empresa={cliente.empresa}
            cnpj={formatarCnpj(cliente.cnpj)}
            detalhes={
              cliente.parcelamentos && <Parcelamentos parcelamentos={cliente.parcelamentos} />
            }
          />
        </Caixa>
      ))}
    </ListaComDivisores>
  );
}
