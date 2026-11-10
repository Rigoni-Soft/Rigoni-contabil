import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UseFormGetValues, UseFormSetError, UseFormSetValue } from "react-hook-form";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { atribuirResponsavelAction } from "./atribuir-responsavel.actions";
import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import {
  FalhaDeEtapa,
  naEtapa,
  salvarParcelamentosDoSetor,
  semChaves,
} from "./salvar-parcelamentos-do-setor";

export { semChaves };

type Valores = EditarCadastroOperacionalFormValues;

type Params = {
  dados: CadastroOperacionalClienteDto | null;
  podeAtribuirResponsavel: boolean;
  aoSalvar?: { tipo: "fechar"; executar: () => void } | { tipo: "voltar"; href: string };
  getValues: UseFormGetValues<Valores>;
  setValue: UseFormSetValue<Valores>;
  setError: UseFormSetError<Valores>;
};

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

      // Esta tela é o cadastro operacional do Simples Nacional.
      const erroParcelamentos = await salvarParcelamentosDoSetor({
        clienteId: dados.id,
        setor: "simples_nacional",
        salvos: dados.parcelamentos,
        valores,
        getValues,
        setValue,
      });
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
