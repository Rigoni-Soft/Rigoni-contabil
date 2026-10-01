import { useState } from "react";

import type { ResumoSetorSnDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-sn.provider";
import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import { carregarCadastroOperacionalAction } from "@/modules/clientes/presentation/view-models/buscar-cliente/buscar-cliente.actions";
import { podeEditarCadastroOperacional } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.presenter";

export function useResumoSetorSn(resumo: ResumoSetorSnDto, papel: string, setor: string) {
  const [bucketAberto, setBucketAberto] = useState<string | null>(null);
  const [clienteSelecionado, setClienteSelecionado] =
    useState<CadastroOperacionalClienteDto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Clicar no card já aberto fecha o drill-down (toggle) — mesmo padrão de
  // "alterna" usado em outras seções expansíveis do dashboard.
  const abrirBucket = (id: string) => setBucketAberto((atual) => (atual === id ? null : id));

  const selecionarCliente = async (clienteId: string) => {
    const resultado = await carregarCadastroOperacionalAction(clienteId);
    // Falha técnica e "cliente não encontrado" não podem ter o mesmo efeito
    // silencioso (code-review) — só o segundo caso é esperado (ok: true,
    // data: null); o primeiro precisa de feedback, senão o clique não faz
    // nada visível.
    if (!resultado.ok) {
      setErro("Falha ao carregar o cadastro. Tente novamente.");
      return;
    }
    setErro(null);
    setClienteSelecionado(resultado.data);
  };

  const fecharPainel = () => setClienteSelecionado(null);

  return {
    cards: resumo.cards,
    totalClientes: resumo.totalClientes,
    bucketAberto,
    abrirBucket,
    clienteSelecionado,
    selecionarCliente,
    fecharPainel,
    erro,
    readOnly: !podeEditarCadastroOperacional(papel, setor),
  };
}
