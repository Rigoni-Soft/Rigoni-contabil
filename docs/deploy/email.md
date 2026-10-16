# E-mail real pelo Resend (#86): variáveis e onde obter

| Variável | O que é | Segredo |
|---|---|---|
| `EMAIL_MODO` | `real` liga o adapter do Resend; `falso` (padrão) só registra no log e, em produção, o canal de e-mail falha de forma explícita | não |
| `RESEND_API_KEY` | chave de API do Resend (começa com `re_`) | **sim** |
| `EMAIL_REMETENTE` | o `from`, num domínio verificado: `Rigoni Contábil <no-reply@seudominio.com.br>` | não |

Com `EMAIL_MODO=real` o `env.ts` exige `RESEND_API_KEY` e `EMAIL_REMETENTE`.

## Onde pegar

1. **Conta**: <https://resend.com> (login do escritório).
2. **Domínio de envio e remetente** (Dashboard → *Domains* → *Add Domain*): informe o domínio (ou um subdomínio como
   `mail.seudominio.com.br`, que isola a reputação do domínio principal). O Resend mostra os registros DNS (SPF, DKIM e o
   MX/retorno); cadastre-os no painel de DNS de onde o domínio é gerenciado (Registro.br, Cloudflare, etc.) e clique em
   *Verify* até o status ficar **Verified**. O remetente é qualquer endereço desse domínio, ex.: `no-reply@mail.seudominio.com.br`.
3. **Chave** (Dashboard → *API Keys* → *Create API Key*): permissão **Sending access**, restrita ao domínio acima. O valor
   aparece **uma única vez**: copie na hora.

Antes de ter domínio verificado, o Resend só deixa enviar de `onboarding@resend.dev` e só para o e-mail do dono da conta:
serve para testar o adapter, não para o job real.

## Na Vercel

```
vercel env add EMAIL_MODO preview            # real
vercel env add EMAIL_REMETENTE preview       # Rigoni Contábil <no-reply@...>
vercel env add RESEND_API_KEY preview --sensitive
```

Para o Production, repita com o escopo `production` (de preferência com uma chave só dele). O job de lembrete só liga com
`LEMBRETES_AUTOMATICOS=ligada`, e em produção ele exige o e-mail real.

## Comportamento do adapter

- Anexo: o Resend baixa o PDF da URL assinada do bucket `guias-fiscais` (`attachments[].path`).
- Idempotência: a chave é o hash de destinatário, assunto, nome do anexo e dia; a retentativa do job no mesmo dia não duplica.
- `400`/`422` (destinatário ou campo inválido) → `ValidationError`, sem repetir. `401/403`, `429`, `5xx` e rede → `ServicoExternoError`.
