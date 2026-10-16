import "server-only";

import {
  CND_MODO,
  OBRIGACOES_FISCAIS_MODO,
  OBRIGACOES_FISCAIS_URL,
  SERPRO_AMBIENTE,
  SERPRO_CERTIFICADO_P12_BASE64,
  SERPRO_CERTIFICADO_SENHA,
  SERPRO_CND_CODIGO_IDENTIFICACAO,
  SERPRO_CND_CONSUMER_KEY,
  SERPRO_CND_CONSUMER_SECRET,
  SERPRO_CNPJ_ESCRITORIO,
  SERPRO_CONSUMER_KEY,
  SERPRO_CONSUMER_SECRET,
  SERPRO_TOKEN_TRIAL,
  SERPRO_URL_AUTENTICACAO,
  SERPRO_URL_CND_CERTIDAO,
  SERPRO_URL_CND_TOKEN,
  SERPRO_URL_INTEGRA_CONTADOR,
} from "@/env";

import type { CertidaoCndPort } from "@/modules/clientes/application/ports/out/certidao-cnd.provider";
import type { ObrigacoesFiscaisPort } from "@/modules/clientes/application/ports/out/obrigacoes-fiscais.provider";
import { CertidaoCndHttpGateway } from "@/modules/clientes/infra/gateways/certidao-cnd-http.gateway";
import { CertidaoCndSerproGateway } from "@/modules/clientes/infra/gateways/certidao-cnd-serpro.gateway";
import { ObrigacoesFiscaisHttpGateway } from "@/modules/clientes/infra/gateways/obrigacoes-fiscais-http.gateway";
import { ObrigacoesFiscaisSerproGateway } from "@/modules/clientes/infra/gateways/obrigacoes-fiscais-serpro.gateway";

// URLs por ambiente (docs/deploy/serpro.md); cada uma pode ser sobrescrita por variável.
const GATEWAY = "https://gateway.apiserpro.serpro.gov.br";
const URLS = {
  trial: {
    autenticacao: "", // trial não autentica: usa o token de demonstração
    integraContador: `${GATEWAY}/integra-contador-trial/v1`,
    cndToken: "",
    cndCertidao: `${GATEWAY}/consulta-cnd-trial/v1/certidao`,
  },
  producao: {
    autenticacao: "https://autenticacao.sapi.serpro.gov.br/authenticate",
    integraContador: `${GATEWAY}/integra-contador/v1`,
    cndToken: `${GATEWAY}/token`,
    cndCertidao: `${GATEWAY}/consulta-cnd/v1/certidao`,
  },
} as const;

// Token público de demonstração da documentação do Serpro (só vale no trial).
const TOKEN_TRIAL_PADRAO = "06aef429-a981-3ec5-a1f8-71d38d86481e";
// Código usado nos exemplos do trial da Consulta CND.
const CODIGO_CND_TRIAL = "9001";

// Instância única no modo real: guarda o token do Serpro entre chamadas.
let serpro: ObrigacoesFiscaisSerproGateway | undefined;

export function makeObrigacoesFiscais(): ObrigacoesFiscaisPort {
  if (OBRIGACOES_FISCAIS_MODO !== "serpro") {
    return new ObrigacoesFiscaisHttpGateway(OBRIGACOES_FISCAIS_URL);
  }
  const urls = URLS[SERPRO_AMBIENTE];
  // env.ts garante as variáveis de cada ambiente com o modo real.
  serpro ??= new ObrigacoesFiscaisSerproGateway({
    urlAutenticacao: SERPRO_URL_AUTENTICACAO ?? urls.autenticacao,
    urlBase: SERPRO_URL_INTEGRA_CONTADOR ?? urls.integraContador,
    cnpjEscritorio: SERPRO_CNPJ_ESCRITORIO!,
    acesso:
      SERPRO_AMBIENTE === "trial"
        ? { tipo: "trial", token: SERPRO_TOKEN_TRIAL ?? TOKEN_TRIAL_PADRAO }
        : {
            tipo: "producao",
            consumerKey: SERPRO_CONSUMER_KEY!,
            consumerSecret: SERPRO_CONSUMER_SECRET!,
            certificadoP12: Buffer.from(SERPRO_CERTIFICADO_P12_BASE64!, "base64"),
            certificadoSenha: SERPRO_CERTIFICADO_SENHA!,
          },
  });
  return serpro;
}

let cnd: CertidaoCndSerproGateway | undefined;

// A CND é outro produto do Serpro, com chave própria: modo independente das guias.
export function makeCertidaoCnd(): CertidaoCndPort {
  if (CND_MODO !== "serpro") return new CertidaoCndHttpGateway(OBRIGACOES_FISCAIS_URL);
  const urls = URLS[SERPRO_AMBIENTE];
  cnd ??= new CertidaoCndSerproGateway({
    urlToken: SERPRO_URL_CND_TOKEN ?? urls.cndToken,
    urlCertidao: SERPRO_URL_CND_CERTIDAO ?? urls.cndCertidao,
    codigoIdentificacao: SERPRO_CND_CODIGO_IDENTIFICACAO ?? CODIGO_CND_TRIAL,
    acesso:
      SERPRO_AMBIENTE === "trial"
        ? { tipo: "trial", token: SERPRO_TOKEN_TRIAL ?? TOKEN_TRIAL_PADRAO }
        : {
            tipo: "producao",
            consumerKey: SERPRO_CND_CONSUMER_KEY!,
            consumerSecret: SERPRO_CND_CONSUMER_SECRET!,
          },
  });
  return cnd;
}
