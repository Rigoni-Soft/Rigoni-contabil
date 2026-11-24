import { useState } from "react";

import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import type {
  ClienteParaConfirmar,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import { avisoDoContatoUra } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useBuscarClienteParaContatoMutation,
  useCadastrarContatoUraMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

type Etapa = "fechado" | "cliente" | "contato";

function fechaPainel(resultado: ResultadoCadastroContatoUra | undefined) {
  return resultado?.status === "criado" || resultado?.status === "existente";
}

// "Cadastrar como contato deste Cliente": confirma o Cliente (passo 1) e cadastra o número (passo 2).
// Criado e já existente concluem; número em outro Cliente e e-mail repetido avisam e deixam trocar o Cliente.
export function useContatoUra(atendimentoId: string) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [cliente, setCliente] = useState<ClienteParaConfirmar | undefined>();
  const [resultado, setResultado] = useState<ResultadoCadastroContatoUra | undefined>();
  const busca = useBuscarClienteParaContatoMutation(atendimentoId);
  const cadastro = useCadastrarContatoUraMutation(atendimentoId);

  const concluido = fechaPainel(resultado);

  function limparAvisos() {
    busca.reset();
    cadastro.reset();
    setResultado(undefined);
  }

  const aviso = busca.isError
    ? { tipo: "erro" as const, texto: busca.error.message }
    : cadastro.isError
      ? { tipo: "erro" as const, texto: cadastro.error.message }
      : resultado && cliente
        ? avisoDoContatoUra(resultado, cliente.empresa)
        : undefined;

  return {
    etapa,
    concluido,
    aviso,
    cliente: cliente ? { empresa: cliente.empresa, cnpj: formatarCnpj(cliente.cnpj) } : undefined,
    buscando: busca.isPending,
    cadastrando: cadastro.isPending,
    aoAbrir: () => {
      limparAvisos();
      setEtapa("cliente");
    },
    aoBuscar: (cnpj: string) => {
      limparAvisos();
      busca.mutate(cnpj, {
        onSuccess: (achado) => {
          setCliente(achado);
          setEtapa("contato");
        },
      });
    },
    aoTrocarCliente: () => {
      limparAvisos();
      setEtapa("cliente");
    },
    aoCadastrar: (nome: string, email: string) => {
      if (!cliente) return;
      limparAvisos();
      cadastro.mutate(
        { clienteId: cliente.id, nome, email },
        {
          onSuccess: (resultado) => {
            setResultado(resultado);
            if (fechaPainel(resultado)) setEtapa("fechado");
          },
        },
      );
    },
    aoCancelar: () => {
      limparAvisos();
      setCliente(undefined);
      setEtapa("fechado");
    },
  };
}
