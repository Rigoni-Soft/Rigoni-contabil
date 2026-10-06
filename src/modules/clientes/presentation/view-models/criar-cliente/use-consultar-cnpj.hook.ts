import { useCallback } from "react";

import type { RegimeValor } from "@/shared/kernel/regimes";

export type DadosCnpjPublico = { empresa?: string; regime?: RegimeValor };

// Nunca deixa a consulta travar o preenchimento manual: timeout curto,
// AbortController cancela a requisição em vez de deixá-la pendurada.
const TIMEOUT_MS = 5000;

// BrasilAPI (brasilapi.com.br/api/cnpj/v1/{cnpj}) — pública, sem chave, sem
// custo. Autopreenche Empresa e, quando a API tem certeza (Simples Nacional
// ou MEI), Regime. Não distingue Lucro Presumido de Lucro Real — não é dado
// público estruturado — então nesses casos o campo Regime fica em branco pro
// Admin escolher (decisão tomada com o usuário em 2026-09-29). Falha de rede
// ou CNPJ não encontrado: devolve null, sem travar o cadastro manual.
//
// Sem estado de "pendente" aqui de propósito: um indicador de loading
// provocaria um re-render do formulário (e do useFieldArray de alterações
// contratuais) bem na janela em que o Admin ainda está preenchendo os outros
// campos — reproduzido num teste E2E como corrida real entre esse re-render e
// `append()` de uma alteração contratual. A resposta chega em ~100ms na
// prática; o ganho de UX de um indicador não paga esse risco.
export function useConsultarCnpj() {
  const consultar = useCallback(async (cnpjDigitos: string): Promise<DadosCnpjPublico | null> => {
    if (cnpjDigitos.length !== 14) return null;

    try {
      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigitos}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) return null;

      const dados = (await resposta.json()) as {
        razao_social?: string;
        opcao_pelo_simples?: boolean;
        opcao_pelo_mei?: boolean;
      };

      const regime: RegimeValor | undefined = dados.opcao_pelo_mei
        ? "mei"
        : dados.opcao_pelo_simples
          ? "simples_nacional"
          : undefined;

      return { empresa: dados.razao_social || undefined, regime };
    } catch {
      return null;
    }
  }, []);

  return { consultar };
}
