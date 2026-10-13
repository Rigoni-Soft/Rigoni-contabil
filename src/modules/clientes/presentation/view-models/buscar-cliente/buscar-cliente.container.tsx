"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BuscaDeCliente } from "@/presentation/components/organisms/busca-de-cliente.component";
import { PainelDoCliente } from "@/presentation/components/organisms/painel-do-cliente.component";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";

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

  // Destaque de teclado (ArrowUp/ArrowDown/Enter) na lista de sugestões —
  // estado puramente visual/efêmero, então fica no Container, não no hook
  // (arquitetura.md §4.7: "UI efêmera e visual... useState no Container").
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  // Sem efeito pra "resetar ao mudar a lista": deriva direto no render (React
  // recomenda: evita o cascading render de setState dentro de useEffect).
  // Continua válido só enquanto apontar pra dentro da lista atual.
  const indiceAtivoValido =
    indiceAtivo !== null && indiceAtivo < sugestoesVisiveis.length ? indiceAtivo : null;

  // Foco move pro título do painel ao selecionar um cliente — sem isso, quem
  // navega por teclado/leitor de tela perde o contexto da troca (a lista de
  // sugestões desaparece e o formulário aparece sem nenhum anúncio).
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
      selecionarCliente(sugestoesVisiveis[indiceAtivoValido].id);
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
          readOnly={readOnly}
          podeAtribuirResponsavel={podeAtribuirResponsavel}
          onCancelar={fecharPainel}
          // Salvar fecha o painel (volta pra busca) e atualiza os dados da
          // página — se esta busca estiver embutida no resumo do setor
          // (/simples-nacional), os cards refletem a mudança na hora
          // (feedback de teste manual do #36).
          aoSalvarComSucesso={() => {
            fecharPainel();
            router.refresh();
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
      onSelecionar={selecionarCliente}
      idLista={ID_LISTA}
      idOpcao={idOpcao}
    />
  );
}
