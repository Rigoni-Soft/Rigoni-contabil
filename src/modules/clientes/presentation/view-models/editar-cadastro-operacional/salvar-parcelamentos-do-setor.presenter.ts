import type { UseFormGetValues, UseFormSetValue } from "react-hook-form";

import type { ParcelamentoDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SetorSlug } from "@/shared/kernel/setores";

import { anexarGuiaParcelaPgfnAction } from "../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.actions";
import {
  descartarLinhasEmBranco,
  mudouParcelamentos,
} from "./editar-cadastro-operacional.presenter";
import type { EditarCadastroOperacionalFormValues as Valores } from "./editar-cadastro-operacional.schema";
import { salvarParcelamentosAction } from "./salvar-parcelamentos.actions";

// Cópia do objeto sem as chaves dadas (descartar campos sem variável não usada).
export function semChaves<T extends object, K extends keyof T>(
  objeto: T,
  ...chaves: K[]
): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(objeto).filter(([chave]) => !(chaves as string[]).includes(chave)),
  ) as Omit<T, K>;
}

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
  // Os Parcelamentos gravados, para saber se algo mudou.
  salvos: ParcelamentoDto[];
  valores: Valores;
  getValues: UseFormGetValues<Valores>;
  setValue: UseFormSetValue<Valores>;
};

// Salva os Parcelamentos do Setor (e a primeira guia dos PGFN novos); devolve a mensagem de erro que
// interrompe quem chama, ou undefined para seguir.
export async function salvarParcelamentosDoSetor({
  clienteId,
  setor,
  salvos: gravados,
  valores,
  getValues,
  setValue,
}: Params): Promise<string | undefined> {
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
}
