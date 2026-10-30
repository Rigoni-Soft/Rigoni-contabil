import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UseFormGetValues, UseFormSetError, UseFormSetValue } from "react-hook-form";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { anexarGuiaParcelaPgfnAction } from "../anexar-guia-parcela-pgfn/anexar-guia-parcela-pgfn.actions";
import { atribuirResponsavelAction } from "./atribuir-responsavel.actions";
import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import {
  descartarLinhasEmBranco,
  mudouParcelamentos,
} from "./editar-cadastro-operacional.presenter";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import { salvarParcelamentosAction } from "./salvar-parcelamentos.actions";

type Valores = EditarCadastroOperacionalFormValues;

type Params = {
  dados: CadastroOperacionalClienteDto | null;
  podeAtribuirResponsavel: boolean;
  aoSalvar?: { tipo: "fechar"; executar: () => void } | { tipo: "voltar"; href: string };
  getValues: UseFormGetValues<Valores>;
  setValue: UseFormSetValue<Valores>;
  setError: UseFormSetError<Valores>;
};

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
class FalhaDeEtapa extends Error {
  constructor(readonly etapa: string | null) {
    super("falha de transporte");
  }
}

async function naEtapa<T>(etapa: string | null, passo: () => Promise<T>): Promise<T> {
  try {
    return await passo();
  } catch {
    throw new FalhaDeEtapa(etapa);
  }
}

const ETAPA_RESPONSAVEL = "atribuir o Responsável";

// Saga de salvar: cadastro, depois Parcelamentos (e suas guias), depois Responsável. Cada passo devolve a
// mensagem de erro que interrompe a saga, ou undefined para seguir.
export function useSalvarCadastroOperacional({
  dados,
  podeAtribuirResponsavel,
  aoSalvar,
  getValues,
  setValue,
  setError,
}: Params) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
  // Depois de salvar o cadastro e falhar só a atribuição, guarda o que foi persistido (campos sem o
  // Responsável); reenviar o mesmo formulário repete só a atribuição. Se a pessoa mexer em outro
  // campo, o retrato muda e o salvamento completo volta.
  const [cadastroSalvo, setCadastroSalvo] = useState<string | null>(null);

  const limparMensagens = () => {
    setErroServidor(undefined);
    setSucesso(false);
  };

  const salvarParcelamentos = async (
    cliente: CadastroOperacionalClienteDto,
    valores: Valores,
  ): Promise<string | undefined> => {
    // Parcelamentos têm PDF: vão por Server Action própria, depois do cadastro. Sem mudança, não vão.
    if (!mudouParcelamentos(valores.parcelamentos, cliente.parcelamentos)) return undefined;
    const salvos = await naEtapa("salvar os Parcelamentos", () =>
      salvarParcelamentosAction({
        clienteId: cliente.id,
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

  const atribuirResponsavel = async (
    cliente: CadastroOperacionalClienteDto,
    valores: Valores,
  ): Promise<string | undefined> => {
    if (!podeAtribuirResponsavel || valores.responsavelId === (cliente.responsavelId ?? "")) {
      return undefined;
    }
    const atribuicao = await atribuirResponsavelAction({
      clienteId: cliente.id,
      responsavelId: valores.responsavelId || null,
    });
    // O cadastro já foi salvo; reenviar o formulário repete só a atribuição.
    return atribuicao.ok
      ? undefined
      : `Os dados foram salvos, mas não foi possível atribuir o Responsável. ${atribuicao.error.message}`;
  };

  const concluir = () => {
    setCadastroSalvo(null);
    setSucesso(true);
    if (aoSalvar?.tipo === "fechar") {
      aoSalvar.executar();
    } else if (aoSalvar?.tipo === "voltar") {
      router.push(aoSalvar.href);
    }
  };

  const salvar = async (valores: Valores) => {
    if (!dados) return;
    setPendente(true);
    limparMensagens();
    // try/finally: rejeição de transporte da Server Action não pode deixar o botão preso em "Salvando…".
    try {
      // O Responsável é salvo à parte: fica fora do retrato que decide se o cadastro mudou.
      const cadastro = semChaves(valores, "responsavelId", "parcelamentos");
      const retrato = JSON.stringify(cadastro);
      if (cadastroSalvo !== retrato) {
        // `cadastro`, sem os Parcelamentos: os PDFs não podem viajar nesta chamada (teto de corpo da Vercel).
        const resultado = await naEtapa(null, () =>
          editarCadastroOperacionalAction({ ...cadastro, clienteId: dados.id }),
        );
        if (!resultado.ok) {
          setErroServidor(resultado.error.message);
          for (const [campo, mensagens] of Object.entries(resultado.error.fields ?? {})) {
            if (mensagens[0] && campo !== "clienteId") {
              setError(campo as keyof Valores, { message: mensagens[0] });
            }
          }
          return;
        }
      }
      // O retrato é guardado assim que o cadastro persiste, antes da atribuição, para valer também
      // quando a atribuição rejeita por erro de transporte.
      setCadastroSalvo(retrato);

      const erroParcelamentos = await salvarParcelamentos(dados, valores);
      if (erroParcelamentos) return setErroServidor(erroParcelamentos);

      const erroResponsavel = await naEtapa(ETAPA_RESPONSAVEL, async () => {
        const erro = await atribuirResponsavel(dados, valores);
        if (!erro) concluir();
        return erro;
      });
      if (erroResponsavel) setErroServidor(erroResponsavel);
    } catch (falha) {
      const etapa = falha instanceof FalhaDeEtapa ? falha.etapa : null;
      setErroServidor(
        etapa
          ? `Os dados foram salvos, mas não foi possível ${etapa}. Verifique a conexão e tente novamente.`
          : "Não foi possível salvar agora. Verifique a conexão e tente novamente.",
      );
    } finally {
      setPendente(false);
    }
  };

  return { salvar, pendente, erroServidor, sucesso, limparMensagens };
}
