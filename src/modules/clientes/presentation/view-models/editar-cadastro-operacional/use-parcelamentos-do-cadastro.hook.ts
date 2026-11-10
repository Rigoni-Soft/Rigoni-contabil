import {
  useFieldArray,
  type Control,
  type UseFormGetValues,
  type UseFormSetValue,
} from "react-hook-form";

import type { ParcelamentoDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SetorSlug } from "@/shared/kernel/setores";

import { anexarGuiaParcelaPgfnAction } from "../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.actions";
import {
  descartarLinhasEmBranco,
  leituraDaLinha,
  mudouParcelamentos,
  parcelamentoNovo,
  resumoDoAcordo,
  semChaves,
} from "./editar-cadastro-operacional.presenter";
import type { EditarCadastroOperacionalFormValues as Valores } from "./editar-cadastro-operacional.schema";
import { salvarParcelamentosAction } from "./salvar-parcelamentos.actions";
import { useLeituraDoPdf } from "./use-leitura-do-pdf.hook";

// Rejeição de transporte numa etapa: `etapa` é o que faltava concluir; null = o cadastro nem foi salvo.
export class FalhaDeEtapa extends Error {
  constructor(readonly etapa: string | null) {
    super("falha de transporte");
  }
}

export async function naEtapa<T>(etapa: string | null, passo: () => Promise<T>): Promise<T> {
  try {
    return await passo();
  } catch {
    throw new FalhaDeEtapa(etapa);
  }
}

type Params = {
  clienteId: string;
  // O Setor dono dos Parcelamentos: cada Setor salva os seus.
  setor: SetorSlug;
  // Os Parcelamentos gravados, para saber se algo mudou e o que exibir antes de o formulário montar.
  salvos: ParcelamentoDto[];
  control: Control<Valores>;
  getValues: UseFormGetValues<Valores>;
  setValue: UseFormSetValue<Valores>;
};

// Os Parcelamentos de um Setor num cadastro: a lista editável, a leitura do PDF por linha e o salvamento
// (com a primeira guia dos PGFN novos). O Container do SN e o do RH só repassam o resultado à View.
export function useParcelamentosDoCadastro({
  clienteId,
  setor,
  salvos: gravados,
  control,
  getValues,
  setValue,
}: Params) {
  const campos = useFieldArray({ control, name: "parcelamentos" });
  const leitura = useLeituraDoPdf(clienteId, setValue, campos.fields);

  // Salva os Parcelamentos do Setor; devolve a mensagem de erro que interrompe quem chama, ou undefined.
  const salvar = async (valores: Valores): Promise<string | undefined> => {
    // Parcelamentos têm PDF: vão por Server Action própria, depois do cadastro. Sem mudança, não vão.
    if (!mudouParcelamentos(valores.parcelamentos, gravados)) return undefined;
    const salvos = await naEtapa("salvar os Parcelamentos", () =>
      salvarParcelamentosAction({
        clienteId,
        setor,
        // A guia sobe à parte, depois: o corpo desta chamada tem o teto de 4,5 MB.
        parcelamentos: valores.parcelamentos.map((p) => semChaves(p, "guia")),
      }),
    );
    if (!salvos.ok) {
      return `Os dados foram salvos, mas não foi possível salvar os Parcelamentos. ${salvos.error.message}`;
    }

    // Os ids voltam para as linhas antes de anexar: uma nova tentativa (guia recusada, falha de
    // transporte) atualiza os acordos já salvos, em vez de recriá-los e apagar suas guias em cascata.
    // `ids` segue a lista enviada, sem as linhas em branco: o índice da tela vem do mesmo descarte do resolver.
    const indicesNaTela = descartarLinhasEmBranco(getValues()).parcelamentos;
    salvos.data.ids.forEach((id, indice) =>
      setValue(`parcelamentos.${indicesNaTela[indice]}.id`, id),
    );

    // Guia recusada (ex.: CNPJ de outra empresa) não desfaz o Parcelamento: avisa e a guia se anexa na linha.
    for (const [indice, linha] of valores.parcelamentos.entries()) {
      // O campo some se o PDF do acordo passa a não ser da PGFN, mas o arquivo escolhido fica no formulário.
      if (!linha.guia || linha.acordo?.origem !== "pgfn") continue;
      const arquivo = linha.guia;
      const guia = await naEtapa("anexar a guia", () =>
        anexarGuiaParcelaPgfnAction({ parcelamentoId: salvos.data.ids[indice], arquivo }),
      );
      // Anexada ou recusada, a guia sai do formulário: a linha já é um acordo salvo (sem o campo da
      // guia) e a retentativa não reenvia o arquivo; a recusada se anexa em "Guias da parcela".
      const tela = getValues("parcelamentos").findIndex((p) => p.guia === arquivo);
      if (tela >= 0) setValue(`parcelamentos.${tela}.guia`, undefined);
      if (!guia.ok) {
        return `O Parcelamento foi salvo, mas a guia não foi anexada. ${guia.error.message} Anexe-a em "Guias da parcela", na linha do Parcelamento.`;
      }
    }
    return undefined;
  };

  return {
    // Lido no render, sem assinar o campo: o que a tela exibe (resumo, selo, quitado, nome do PDF) só
    // muda quando uma linha entra ou sai (`campos` re-renderiza), não a cada tecla.
    parcelamentos: (getValues("parcelamentos") ?? gravados).map((p) => ({
      ...p,
      acordoResumo: resumoDoAcordo(p.acordo),
    })),
    parcelamentoCampos: campos.fields,
    onAdicionarParcelamento: () => campos.append(parcelamentoNovo()),
    onRemoverParcelamento: (indice: number) => {
      void leitura.ler(campos.fields[indice].id, undefined); // esquece a leitura da linha
      campos.remove(indice);
    },
    leituras: Object.fromEntries(
      Object.entries(leitura.leituras).map(([id, estado]) => [id, leituraDaLinha(estado)]),
    ),
    onArquivoEscolhido: (indice: number, arquivo: File | undefined) =>
      void leitura.ler(campos.fields[indice].id, arquivo),
    esquecerLeituras: leitura.esquecerTodas,
    salvar,
  };
}
