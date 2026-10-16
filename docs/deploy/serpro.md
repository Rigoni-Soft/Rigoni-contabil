# Serpro: variáveis por ambiente e guarda do certificado (#66)

Dois ambientes na Vercel, dois comportamentos (`SERPRO_AMBIENTE`):

| | Preview (homolog) | Production (main) |
|---|---|---|
| Ambiente | `trial`: dados de **demonstração** do Serpro, token fixo, **sem certificado** | `producao`: dados reais, OAuth2 + e-CNPJ do escritório |
| Certificado e-CNPJ | não usa | **só aqui** |
| CNPJs que respondem | só os de teste do Serpro (ex.: `00000000000100`, `99999999999999`) | os CNPJs reais dos Clientes |

O `env.ts` recusa subir com `SERPRO_AMBIENTE=trial` em Production da Vercel (`VERCEL_ENV=production`) quando algum modo
Serpro está ligado: o trial devolveria guias de demonstração a Clientes reais.

## Preview (homolog)

| Variável | Valor |
|---|---|
| `OBRIGACOES_FISCAIS_MODO` | `serpro` (ou `mock`, para seguir no mock) |
| `CND_MODO` | `serpro` (ou `mock`) |
| `SERPRO_AMBIENTE` | `trial` |
| `SERPRO_CNPJ_ESCRITORIO` | `00000000000100` |

Opcionais: `SERPRO_TOKEN_TRIAL` (vazio = token público da documentação), `SERPRO_CND_CODIGO_IDENTIFICACAO` (vazio = `9001`)
e as quatro `SERPRO_URL_*` (vazio = URLs do trial). Nada disso é segredo; nenhuma credencial nem certificado entra no Preview.

## Production (main)

| Variável | Valor | Segredo |
|---|---|---|
| `OBRIGACOES_FISCAIS_MODO` | `serpro` | não |
| `CND_MODO` | `serpro` | não |
| `SERPRO_AMBIENTE` | `producao` | não |
| `SERPRO_CNPJ_ESCRITORIO` | CNPJ do escritório, 14 caracteres, sem máscara | não |
| `SERPRO_CONSUMER_KEY` | Área do Cliente Serpro, contrato Integra Contador | **sim** |
| `SERPRO_CONSUMER_SECRET` | idem | **sim** |
| `SERPRO_CERTIFICADO_P12_BASE64` | o `.p12` do e-CNPJ em base64 (abaixo) | **sim** |
| `SERPRO_CERTIFICADO_SENHA` | senha do `.p12` | **sim** |
| `SERPRO_CND_CONSUMER_KEY` | Área do Cliente Serpro, contrato **Consulta CND** | **sim** |
| `SERPRO_CND_CONSUMER_SECRET` | idem | **sim** |
| `SERPRO_CND_CODIGO_IDENTIFICACAO` | código de identificação informado na contratação da Consulta CND | não |

URLs padrão de `producao` (só sobrescreva por `SERPRO_URL_*` se o Serpro mudar):
`SERPRO_URL_AUTENTICACAO` = `https://autenticacao.sapi.serpro.gov.br/authenticate`,
`SERPRO_URL_INTEGRA_CONTADOR` = `https://gateway.apiserpro.serpro.gov.br/integra-contador/v1`,
`SERPRO_URL_CND_TOKEN` = `https://gateway.apiserpro.serpro.gov.br/token`,
`SERPRO_URL_CND_CERTIDAO` = `https://gateway.apiserpro.serpro.gov.br/consulta-cnd/v1/certidao`
(esta última é inferida do exemplo de trial: confirmar no Swagger com o contrato ativo).

## Guarda do certificado na Vercel

O `.p12` nunca entra no repositório nem no Preview. Ele vai como variável de ambiente **Sensitive** (o valor não pode ser
lido de volta nem no painel) e **só no escopo Production**.

1. Codifique sem quebra de linha (cabe folgado no limite de 64 KB da Vercel):
   - Git Bash/Linux: `base64 -w0 certificado.p12 > p12.b64`
   - PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12")) | Set-Content -NoNewline p12.b64`
2. Cadastre pelo CLI, lendo do arquivo (o valor não passa pelo histórico do terminal):
   ```
   vercel env add SERPRO_CERTIFICADO_P12_BASE64 production --sensitive < p12.b64
   vercel env add SERPRO_CERTIFICADO_SENHA production --sensitive
   vercel env add SERPRO_CONSUMER_KEY production --sensitive
   vercel env add SERPRO_CONSUMER_SECRET production --sensitive
   vercel env add SERPRO_CND_CONSUMER_KEY production --sensitive
   vercel env add SERPRO_CND_CONSUMER_SECRET production --sensitive
   ```
   Ou no painel: Settings → Environment Variables → marque **Sensitive** e desmarque Preview e Development.
3. Apague `p12.b64` e guarde o `.p12` original e a senha no cofre de senhas do escritório (a Vercel não devolve o valor).
4. Cadastre as não secretas (`SERPRO_AMBIENTE=producao`, `OBRIGACOES_FISCAIS_MODO=serpro`, `CND_MODO=serpro`,
   `SERPRO_CNPJ_ESCRITORIO`, `SERPRO_CND_CODIGO_IDENTIFICACAO`) e faça um novo deploy: variável nova só vale em deploy novo.
5. Troca/renovação do e-CNPJ (validade de 1 a 3 anos): repita os passos 1 a 4 (`vercel env rm` antes) e anote a data de vencimento.

## Local

`.env.local` com `SERPRO_AMBIENTE=trial` (o padrão) ou `OBRIGACOES_FISCAIS_MODO=mock` com `yarn mock:api`. Não use o e-CNPJ
real em máquina de desenvolvimento.
