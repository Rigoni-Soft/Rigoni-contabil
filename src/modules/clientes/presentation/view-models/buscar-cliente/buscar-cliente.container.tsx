"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BuscaDeCliente } from "@/presentation/components/organisms/busca-de-cliente.component";
import { PainelDoCliente } from "@/presentation/components/organisms/painel-do-cliente.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import { usaCadastroDoRh } from "@/shared/kernel/papeis";
import { ROTA_RH } from "@/shared/kernel/setores";

import { useBuscarCliente } from "./use-buscar-cliente.hook";

type Props = { papel: string; setor: string; apenasSnMei?: boolean };

const ID_LISTA = "buscar-cliente-lista";
const idOpcao = (indice: number) => `buscar-cliente-opcao-${indice}`;

export function BuscarClienteContainer({ papel, setor, apenasSnMei = false }: Props) {
  const router = useRouter();
  const {
    termo,
    setTermo,
    buscando,
    sugestoesVisiveis,
    clienteSelecionado,
    selecionarCliente,
    fecharPainel,
    readOnly,
    podeAtribuirResponsavel,
  } = useBuscarCliente(papel, setor, apenasSnMei);

  const aoSelecionar = (id: string) => {
    if (papel === "admin") return router.push(`/clientes/${id}`);
    if (usaCadastroDoRh(papel, setor)) return router.push(`/clientes/${id}?voltarPara=${ROTA_RH}`);
    selecionarCliente(id);
  };

  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  const indiceAtivoValido =
    indiceAtivo !== null && indiceAtivo < sugestoesVisiveis.length ? indiceAtivo : null;

  const tituloPainelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (clienteSelecionado) tituloPainelRef.current?.focus();
  }, [clienteSelecionado]);

  const aoTeclar: React.KeyboardEventHandler<HTMLInputElement> = (evento) => {
    if (sugestoesVisiveis.length === 0) return;

    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo((atual) =>
        atual === null ? 0 : Math.min(atual + 1, sugestoesVisiveis.length - 1),
      );
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((atual) =>
        atual === null ? sugestoesVisiveis.length - 1 : Math.max(atual - 1, 0),
      );
    } else if (evento.key === "Enter" && indiceAtivoValido !== null) {
      evento.preventDefault();
      aoSelecionar(sugestoesVisiveis[indiceAtivoValido].id);
    } else if (evento.key === "Escape") {
      setTermo("");
    }
  };

  if (clienteSelecionado) {
    return (
      <PainelDoCliente
        titulo={readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional"}
        tituloRef={tituloPainelRef}
        onNovaBusca={fecharPainel}
      >
        <EditarCadastroOperacionalContainer
          dados={clienteSelecionado}
          ator={{ papel, setor }}
          readOnly={readOnly}
          podeAtribuirResponsavel={podeAtribuirResponsavel}
          onCancelar={fecharPainel}
          aoSalvar={{
            tipo: "fechar",
            executar: () => {
              fecharPainel();
              router.refresh();
            },
          }}
        />
      </PainelDoCliente>
    );
  }

  return (
    <BuscaDeCliente
      termo={termo}
      onTermoChange={setTermo}
      onKeyDown={aoTeclar}
      buscando={buscando}
      sugestoes={sugestoesVisiveis.map((sugestao) => ({
        id: sugestao.id,
        empresa: sugestao.empresa,
        cnpj: formatarCnpj(sugestao.cnpj),
      }))}
      indiceAtivo={indiceAtivoValido}
      onDestacar={setIndiceAtivo}
      onSelecionar={aoSelecionar}
      idLista={ID_LISTA}
      idOpcao={idOpcao}
    />
  );
}
