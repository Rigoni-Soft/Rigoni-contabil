import { useEffect, useState } from "react";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { itemDaFilaParaView } from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";
import { ehSetor, type SetorSlug } from "@/shared/kernel/setores";

// `inicial` é a carga do servidor para `setorInicial`; outro Setor (Admin) lê pela Server Action.
// Só o Admin escolhe o Setor; os demais leem sempre a Fila do próprio Setor.
export function useFila(
  setorInicial: SetorSlug,
  inicial: ItemDaFilaVisto[],
  podeEscolherSetor: boolean,
) {
  const [setor, setSetor] = useState<SetorSlug>(setorInicial);
  const [agora, setAgora] = useState(() => Date.now());
  const query = useFilaQuery(
    podeEscolherSetor ? setor : null,
    setor === setorInicial ? inicial : undefined,
  );

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    setor,
    // Só Setor da lista vale (o `<select>` entrega string).
    escolherSetor: (valor: string) => {
      if (ehSetor(valor)) setSetor(valor);
    },
    itens: (query.data ?? []).map((item) => itemDaFilaParaView(item, agora)),
    // Falha de leitura (ex.: sessão expirada) mantém o que já estava na tela.
    // Setor ainda sem leitura (ex.: o Admin acabou de trocar): não é o mesmo que Fila vazia.
    carregando: query.isPending,
    indisponivel: query.isError,
  };
}
