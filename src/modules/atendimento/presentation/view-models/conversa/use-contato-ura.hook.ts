import { useEffect, useRef, useState } from "react";

import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import type {
  ClienteParaConfirmar,
  ResultadoCadastroContatoUra,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import { avisoDoPainelDeContatoUra } from "@/modules/atendimento/presentation/view-models/conversa/conversa.presenter";
import {
  useBuscarClienteParaContatoMutation,
  useCadastrarContatoUraMutation,
} from "@/modules/atendimento/presentation/view-models/conversa/conversa.queries";

type Etapa = "fechado" | "cliente" | "contato";

function fechaPainel(resultado: ResultadoCadastroContatoUra | undefined) {
  return resultado?.status === "criado" || resultado?.status === "existente";
}

export function useContatoUra(atendimentoId: string) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [cliente, setCliente] = useState<ClienteParaConfirmar | undefined>();
  const [resultado, setResultado] = useState<ResultadoCadastroContatoUra | undefined>();
  const busca = useBuscarClienteParaContatoMutation(atendimentoId);
  const cadastro = useCadastrarContatoUraMutation(atendimentoId);

  const concluido = fechaPainel(resultado);
  const refDoAviso = useRef<HTMLParagraphElement>(null);
  const [focoNoBotao, setFocoNoBotao] = useState(false);

  useEffect(() => {
    if (concluido) refDoAviso.current?.focus();
  }, [concluido]);

  function limparAvisos() {
    busca.reset();
    cadastro.reset();
    setResultado(undefined);
  }

  const aviso = avisoDoPainelDeContatoUra(
    {
      busca: busca.isError ? busca.error.message : undefined,
      cadastro: cadastro.isError ? cadastro.error.message : undefined,
    },
    resultado,
    cliente?.empresa,
  );

  return {
    etapa,
    concluido,
    aviso,
    cliente: cliente ? { empresa: cliente.empresa, cnpj: formatarCnpj(cliente.cnpj) } : undefined,
    buscando: busca.isPending,
    cadastrando: cadastro.isPending,
    focoNoBotao,
    refDoAviso,
    aoAbrir: () => {
      limparAvisos();
      setFocoNoBotao(false);
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
      setFocoNoBotao(true);
      setEtapa("fechado");
    },
  };
}
