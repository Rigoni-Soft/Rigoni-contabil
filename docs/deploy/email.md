# E-mail real por SMTP do Gmail (#86): variáveis e onde obter

O escritório não tem domínio próprio para envio, então o adapter usa o SMTP do Gmail com a conta de um dos setores. Quando
houver domínio, troque o adapter por um provedor transacional (a porta `EnvioEmailPort` não muda).

| Variável | O que é | Segredo |
|---|---|---|
| `EMAIL_MODO` | `real` liga o adapter; `falso` (padrão) só registra no log e, em produção, o canal de e-mail falha de forma explícita | não |
| `EMAIL_SMTP_USUARIO` | a conta Gmail que envia (ex.: `rigonicontadm@gmail.com`) | não |
| `EMAIL_SMTP_SENHA` | **senha de app** de 16 letras dessa conta (não é a senha do e-mail) | **sim** |
| `EMAIL_REMETENTE` | o `from`: `Rigoni Contábil <rigonicontadm@gmail.com>` | não |

Com `EMAIL_MODO=real` o `env.ts` exige as três últimas.

## Onde pegar a senha de app

1. Entre na conta Gmail que vai enviar e abra <https://myaccount.google.com/security>.
2. Ative a **Verificação em duas etapas** (obrigatória para senha de app).
3. Abra <https://myaccount.google.com/apppasswords>, dê um nome (ex.: `Sistema Rigoni`) e clique em **Criar**.
4. Copie os 16 caracteres (aparecem uma única vez; pode colar com ou sem espaços, mas sem espaços é mais seguro).

Se a conta for Google Workspace, o administrador pode ter bloqueado senhas de app.

## Na Vercel

```
vercel env add EMAIL_MODO preview             # real
vercel env add EMAIL_SMTP_USUARIO preview     # rigonicontadm@gmail.com
vercel env add EMAIL_REMETENTE preview        # Rigoni Contábil <rigonicontadm@gmail.com>
vercel env add EMAIL_SMTP_SENHA preview --sensitive
```

Para o Production, repita com o escopo `production`. O job de lembrete só liga com `LEMBRETES_AUTOMATICOS=ligada`, e em
produção ele exige o e-mail real.

## Comportamento e limites

- Todo e-mail leva no fim o aviso "mensagem automática, não responda". O Gmail não permite um endereço `no-reply` de verdade:
  o `from` é a própria conta, e respostas caem na caixa dela.
- Limite do Gmail: cerca de 500 destinatários por dia. Acima disso o envio falha (`ServicoExternoError`) até o dia seguinte.
- O anexo da guia vai pela URL assinada do bucket `guias-fiscais`.
- O SMTP não deduplica envios: se a conexão cair depois de o Gmail aceitar a mensagem, a retentativa do job pode repetir o e-mail.
- Endereço recusado (`EENVELOPE`, 550 a 553) → `ValidationError`, sem repetir. Senha de app inválida, limite, indisponibilidade e
  rede → `ServicoExternoError`.
