import { useEffect, useState } from "react";

import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import { itemDaFilaParaView } from "@/modules/atendimento/presentation/view-models/fila/fila.presenter";
import { useFilaQuery } from "@/modules/atendimento/presentation/view-models/fila/fila.queries";

// `inicial` é a carga do servidor para `setorInicial`; outro Setor (Admin) lê pela Server Action.
export function useFila(setorInicial: string, inicial: ItemDaFilaVisto[]) {
  const [setor, setSetor] = useState(setorInicial);
  const [agora, setAgora] = useState(() => Date.now());
  const query = useFilaQuery(setor, setor === setorInicial ? inicial : undefined);

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    setor,
    escolherSetor: setSetor,
    itens: (query.data ?? []).map((item) => itemDaFilaParaView(item, agora)),
    // Falha de leitura (ex.: sessão expirada) mantém o que já estava na tela.
    indisponivel: query.isError,
  };
}
