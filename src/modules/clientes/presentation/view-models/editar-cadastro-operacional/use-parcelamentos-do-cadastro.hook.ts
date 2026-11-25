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
  naEtapa,
  parcelamentoNovo,
  resumoDoAcordo,
  semChaves,
} from "./editar-cadastro-operacional.presenter";
import type { EditarCadastroOperacionalFormValues as Valores } from "./editar-cadastro-operacional.schema";
import { salvarParcelamentosAction } from "./salvar-parcelamentos.actions";
import { useLeituraDoPdf } from "./use-leitura-do-pdf.hook";

type Params = {
  clienteId: string;
  setor: SetorSlug;
  salvos: ParcelamentoDto[];
  control: Control<Valores>;
  getValues: UseFormGetValues<Valores>;
  setValue: UseFormSetValue<Valores>;
};

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

  const salvar = async (valores: Valores): Promise<string | undefined> => {
    if (!mudouParcelamentos(valores.parcelamentos, gravados)) return undefined;
    const salvos = await naEtapa("salvar os Parcelamentos", () =>
      salvarParcelamentosAction({
        clienteId,
        setor,
        parcelamentos: valores.parcelamentos.map((p) => semChaves(p, "guia")),
      }),
    );
    if (!salvos.ok) {
      return `Os dados foram salvos, mas não foi possível salvar os Parcelamentos. ${salvos.error.message}`;
    }

    const indicesNaTela = descartarLinhasEmBranco(getValues()).parcelamentos;
    salvos.data.ids.forEach((id, indice) =>
      setValue(`parcelamentos.${indicesNaTela[indice]}.id`, id),
    );

    for (const [indice, linha] of valores.parcelamentos.entries()) {
      if (!linha.guia || linha.acordo?.origem !== "pgfn") continue;
      const arquivo = linha.guia;
      const guia = await naEtapa("anexar a guia", () =>
        anexarGuiaParcelaPgfnAction({ parcelamentoId: salvos.data.ids[indice], arquivo }),
      );
      const tela = getValues("parcelamentos").findIndex((p) => p.guia === arquivo);
      if (tela >= 0) setValue(`parcelamentos.${tela}.guia`, undefined);
      if (!guia.ok) {
        return `O Parcelamento foi salvo, mas a guia não foi anexada. ${guia.error.message} Anexe-a em "Guias da parcela", na linha do Parcelamento.`;
      }
    }
    return undefined;
  };

  return {
    parcelamentos: (getValues("parcelamentos") ?? gravados).map((p) => ({
      ...p,
      acordoResumo: resumoDoAcordo(p.acordo),
    })),
    parcelamentoCampos: campos.fields,
    onAdicionarParcelamento: () => campos.append(parcelamentoNovo()),
    onRemoverParcelamento: (indice: number) => {
      void leitura.ler(campos.fields[indice].id, undefined);
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
