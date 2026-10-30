import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type {
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { ChaveGuia } from "@/modules/atendimento/domain/services/guia-guardada.service";
import type { AppError } from "@/shared/errors/app.error";
import { comTentativas, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { ok, type Result } from "@/shared/kernel/result";

type Pedido<T> = {
  guias: GuiasFiscaisPort;
  publicadas: GuiaPublicadaPort;
  esperaEntreTentativasMs: number;
  clienteId: string;
  tipo: TipoGuia;
  // O que o template exige da guia; erro aqui não publica nada.
  extrair: (guia: GuiaFiscal) => Result<T, AppError>;
  chave: ChaveGuia;
};

// Busca a guia no provedor fiscal, confere o que o template exige (`extrair`) e a publica. Falha
// do serviço externo repete antes de devolver o erro.
export function obterGuiaPublicada<T>({
  guias,
  publicadas,
  esperaEntreTentativasMs,
  clienteId,
  tipo,
  extrair,
  chave,
}: Pedido<T>): Promise<
  Result<T & { guia: { url: string; nomeArquivo: string }; caminho: string }, AppError>
> {
  return comTentativas(
    async () => {
      const buscada = await guias.buscar(clienteId, tipo);
      if (!buscada.ok) return buscada;
      const extraido = extrair(buscada.value);
      if (!extraido.ok) return extraido;
      const publicada = await publicadas.publicar(clienteId, buscada.value, chave);
      if (!publicada.ok) return publicada;
      return ok({
        ...extraido.value,
        guia: { url: publicada.value.url, nomeArquivo: buscada.value.nomeArquivo },
        caminho: publicada.value.caminho,
      });
    },
    TENTATIVAS,
    esperaEntreTentativasMs,
  );
}
