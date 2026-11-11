# Extração das regras da Convenção coletiva: variável e deploy

Ao subir o PDF da convenção, o sistema extrai as regras (jornada, hora extra de sábado, datas especiais, etc.) uma só vez e as grava
versionadas. A extração fica atrás da porta neutra `ExtratorDeRegrasPort` (ADR 0004): recebe os bytes do PDF e devolve parâmetros
candidatos, cada um com a cláusula e o trecho; o domínio valida (número presente no trecho, piso da legislação) e o cálculo nunca
chama o modelo.

| Variável | O que é | Segredo |
|---|---|---|
| `EXTRACAO_CONVENCAO_MODO` | `falso` (padrão: extrator determinístico, sem rede, usado em dev, CI e Preview) ou `indisponivel` (toda leitura falha e o envio da convenção é recusado) | não |

## Produção

**Não existe ainda o adapter do provedor real** (modelo de linguagem). Até ele existir, a Produção deve ficar em `indisponivel`: o
`falso` devolve sempre as regras da convenção de exemplo e gravaria regras inventadas para um Cliente de verdade.

```
vercel env add EXTRACAO_CONVENCAO_MODO production    # indisponivel
```

Quando o provedor real entrar, é um terceiro gateway de `ExtratorDeRegrasPort` e um novo valor da variável; nada mais muda. A
convenção é pública e pode ir a serviço externo (diferente da imagem do cartão de ponto, que tem ADR própria).

## Comportamento

- O PDF vai para o bucket privado `convencoes-coletivas` pelo servidor (service role); o bucket não tem policy para o usuário.
- Limite do anexo na tela: 4 MB (teto do corpo de uma Server Action na Vercel, ADR 0007); o servidor e o bucket aceitam até 10 MB.
- Extração que falha (ou `indisponivel`) recusa o envio e remove o PDF já guardado: nada é gravado.
- Só o Líder do RH e o Admin enviam; o Responsável do RH do Cliente lê as regras e liga os interruptores do Cliente.
