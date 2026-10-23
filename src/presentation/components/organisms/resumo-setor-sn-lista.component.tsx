import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
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

type Props = { clientes: Cliente[]; bucket: string };

function Parcelamentos({
  parcelamentos,
}: {
  parcelamentos: NonNullable<Cliente["parcelamentos"]>;
}) {
  return (
    <Pilha como="ul" espaco={1} aria-label="Parcelamentos">
      {parcelamentos.map((p) => (
        <Linha como="li" key={p.codigo} alinhar="centro" espaco={2} quebra>
          <Texto como="span" variante="apoio" className="min-w-0 break-all">
            {p.codigo}
          </Texto>
          {p.interno && (
            <Texto
              como="span"
              variante="nota"
              className="rounded-full border border-border px-2 py-0.5 font-medium"
            >
              Interno
            </Texto>
          )}
          <SeloDeParcelamento selo={p.status} />
        </Linha>
      ))}
    </Pilha>
  );
}

// Lista filtrada de um bucket do resumo, aberta como tela própria. `voltarPara` manda a própria URL
// desta lista, pra "Voltar" na tela de edição trazer de volta pra cá, não pro dashboard.
export function ResumoSetorSnLista({ clientes, bucket }: Props) {
  if (clientes.length === 0) {
    return <Texto variante="apoio">Nenhum cliente neste status.</Texto>;
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
