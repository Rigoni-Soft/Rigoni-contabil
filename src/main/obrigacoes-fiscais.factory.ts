import "server-only";

import {
  CND_MODO,
  OBRIGACOES_FISCAIS_MODO,
  OBRIGACOES_FISCAIS_URL,
  SERPRO_CERTIFICADO_P12_BASE64,
  SERPRO_CERTIFICADO_SENHA,
  SERPRO_CND_CODIGO_IDENTIFICACAO,
  SERPRO_CND_CONSUMER_KEY,
  SERPRO_CND_CONSUMER_SECRET,
  SERPRO_CNPJ_ESCRITORIO,
  SERPRO_CONSUMER_KEY,
  SERPRO_CONSUMER_SECRET,
} from "@/env";

import type { CertidaoCndPort } from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import type { ObrigacoesFiscaisPort } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import { CertidaoCndHttpGateway } from "@/modules/clientes/infra/gateways/certidao-cnd-http.gateway";
import { CertidaoCndSerproGateway } from "@/modules/clientes/infra/gateways/certidao-cnd-serpro.gateway";
import { ObrigacoesFiscaisHttpGateway } from "@/modules/clientes/infra/gateways/obrigacoes-fiscais-http.gateway";
import { ObrigacoesFiscaisSerproGateway } from "@/modules/clientes/infra/gateways/obrigacoes-fiscais-serpro.gateway";

// Instância única no modo real: guarda o token do Serpro entre chamadas.
let serpro: ObrigacoesFiscaisSerproGateway | undefined;

export function makeObrigacoesFiscais(): ObrigacoesFiscaisPort {
  if (OBRIGACOES_FISCAIS_MODO !== "serpro") {
    return new ObrigacoesFiscaisHttpGateway(OBRIGACOES_FISCAIS_URL);
  }
  // env.ts garante as cinco variáveis com o modo real.
  serpro ??= new ObrigacoesFiscaisSerproGateway({
    consumerKey: SERPRO_CONSUMER_KEY!,
    consumerSecret: SERPRO_CONSUMER_SECRET!,
    certificadoP12: Buffer.from(SERPRO_CERTIFICADO_P12_BASE64!, "base64"),
    certificadoSenha: SERPRO_CERTIFICADO_SENHA!,
    cnpjEscritorio: SERPRO_CNPJ_ESCRITORIO!,
  });
  return serpro;
}

let cnd: CertidaoCndSerproGateway | undefined;

// A CND é outro produto do Serpro, com chave própria: modo independente das guias.
export function makeCertidaoCnd(): CertidaoCndPort {
  if (CND_MODO !== "serpro") return new CertidaoCndHttpGateway(OBRIGACOES_FISCAIS_URL);
  // env.ts garante as três variáveis com o modo real.
  cnd ??= new CertidaoCndSerproGateway({
    consumerKey: SERPRO_CND_CONSUMER_KEY!,
    consumerSecret: SERPRO_CND_CONSUMER_SECRET!,
    codigoIdentificacao: SERPRO_CND_CODIGO_IDENTIFICACAO!,
  });
  return cnd;
}
