import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UseFormSetError } from "react-hook-form";

import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";

import { atribuirResponsavelAction } from "./atribuir-responsavel.actions";
import { editarCadastroOperacionalAction } from "./editar-cadastro-operacional.actions";
import {
  mensagemDeFalhaDeEtapa,
  naEtapa,
  semChaves,
} from "./editar-cadastro-operacional.presenter";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";

type Valores = EditarCadastroOperacionalFormValues;

type Params = {
  dados: CadastroOperacionalClienteDto | null;
  podeAtribuirResponsavel: boolean;
  aoSalvar?: { tipo: "fechar"; executar: () => void } | { tipo: "voltar"; href: string };
  salvarParcelamentos: (valores: Valores) => Promise<string | undefined>;
  setError: UseFormSetError<Valores>;
};

const ETAPA_RESPONSAVEL = "atribuir o Responsável";

export function useSalvarCadastroOperacional({
  dados,
  podeAtribuirResponsavel,
  aoSalvar,
  salvarParcelamentos,
  setError,
}: Params) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | undefined>();
  const [sucesso, setSucesso] = useState(false);
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
    try {
      const cadastro = semChaves(valores, "responsavelId", "parcelamentos");
      const retrato = JSON.stringify(cadastro);
      if (cadastroSalvo !== retrato) {
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
      setCadastroSalvo(retrato);

      const erroParcelamentos = await salvarParcelamentos(valores);
      if (erroParcelamentos) return setErroServidor(erroParcelamentos);

      const erroResponsavel = await naEtapa(ETAPA_RESPONSAVEL, async () => {
        const erro = await atribuirResponsavel(dados, valores);
        if (!erro) concluir();
        return erro;
      });
      if (erroResponsavel) setErroServidor(erroResponsavel);
    } catch (falha) {
      setErroServidor(
        mensagemDeFalhaDeEtapa(
          falha,
          "Não foi possível salvar agora. Verifique a conexão e tente novamente.",
        ),
      );
    } finally {
      setPendente(false);
    }
  };

  return { salvar, pendente, erroServidor, sucesso, limparMensagens };
}
