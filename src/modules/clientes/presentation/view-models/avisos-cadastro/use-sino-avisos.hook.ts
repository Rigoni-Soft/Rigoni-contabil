import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { marcarAvisoVistoAction } from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.actions";
import {
  anuncioDeAvisos,
  avisoCadastroParaView,
  type AvisoDeCadastro,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.presenter";
import {
  avisosCadastroKeys,
  useContadorAvisosQuery,
  useListaAvisosQuery,
} from "@/modules/clientes/presentation/view-models/avisos-cadastro/avisos-cadastro.queries";

// O <dialog> do sino é aberto e fechado por aqui (a View só recebe props), como o painel de anexar.
function modalDo(painelId: string) {
  return document.getElementById(painelId) as HTMLDialogElement | null;
}

// O Admin não recebe Aviso de cadastro (o banco nunca o escolhe como destinatário): o sino fica sem
// selo e sem consultar o contador.
const PAPEL_SEM_AVISOS = "admin";

export function useSinoAvisos(painelId: string, papel: string) {
  const recebeAvisos = papel !== PAPEL_SEM_AVISOS;
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [abriu, setAbriu] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const contadorAnterior = useRef<number | null>(null);
  const contador = useContadorAvisosQuery(recebeAvisos);
  const lista = useListaAvisosQuery(abriu);
  const { refetch: recontar } = contador;

  // A cada navegação o contador relê, sem esperar os 30 s do polling.
  // A leitura do mount já é da própria query: só as navegações seguintes relêem.
  const primeiraRota = useRef(true);
  useEffect(() => {
    if (!recebeAvisos) return;
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    void recontar();
  }, [pathname, recontar, recebeAvisos]);

  // O leitor de tela só é avisado quando o número sobe depois da primeira leitura da tela: o nome do
  // sino já traz a contagem de quem acabou de chegar.
  const naoVistos = contador.data;
  useEffect(() => {
    if (naoVistos === undefined) return;
    const antes = contadorAnterior.current;
    contadorAnterior.current = naoVistos;
    if (antes === null) return;
    setAnuncio(naoVistos > antes ? anuncioDeAvisos(naoVistos) : "");
  }, [naoVistos]);

  const avisos = (lista.data?.pages ?? []).flatMap((pagina) => pagina.itens);

  return {
    // Falha de leitura (ex.: sessão expirada) mantém o último contador conhecido.
    contador: contador.data ?? 0,
    anuncio,
    avisos: avisos.map(avisoCadastroParaView),
    estado: lista.isError
      ? ("erro" as const)
      : lista.isPending
        ? ("carregando" as const)
        : ("pronto" as const),
    temMais: lista.hasNextPage,
    carregandoMais: lista.isFetchingNextPage,
    // Abrir não marca nada: só carrega a lista (e relê, se já tinha aberto antes).
    aoAbrir: () => {
      if (abriu) void lista.refetch();
      setAbriu(true);
      const modal = modalDo(painelId);
      if (modal && !modal.open) modal.showModal();
    },
    aoFechar: () => modalDo(painelId)?.close(),
    aoCarregarMais: () => void lista.fetchNextPage(),
    aoTentarDeNovo: () => void lista.refetch(),
    // Só o clique no aviso marca como visto e leva ao Cliente. Marca antes de navegar; se a
    // marcação falhar, navega mesmo assim e o aviso segue não visto na próxima leitura.
    aoSelecionar: async (aviso: AvisoDeCadastro) => {
      // Fecha já: a navegação entre Clientes não remonta o cabeçalho.
      modalDo(painelId)?.close();
      if (!aviso.visto) await marcarAvisoVistoAction(aviso.id);
      router.push(aviso.href);
      await queryClient.invalidateQueries({ queryKey: avisosCadastroKeys.todos() });
    },
  };
}
