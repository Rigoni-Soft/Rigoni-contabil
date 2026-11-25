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

- O PDF vai para o bucket privado `convencoes-coletivas` com a sessão do usuário: policy de INSERT só para o Líder do RH e o Admin, e leitura e DELETE só do arquivo solto (que nenhuma convenção referencia); o PDF de uma convenção gravada não sai nem se remove pelo usuário.
- Limite do anexo na tela: 4 MB (teto do corpo de uma Server Action na Vercel, ADR 0007); o servidor e o bucket aceitam até 10 MB.
- Só o PDF é enviado: o sindicato e a vigência saem dele, na mesma extração, e a porta os exige de todo provedor (não passam pela citação de cláusula, que vale para os parâmetros das regras).
- Extração que falha (ou `indisponivel`), ou que não identifica o sindicato e uma vigência válida, recusa o envio antes de guardar o PDF: nada é gravado, nem no armazenamento.
- O falso lê `Sindicato: X` e `Vigência: dd/mm/aaaa a dd/mm/aaaa` do texto do PDF; sem essas linhas devolve Comércio, 01/05/2026 a 30/04/2027.
- Só o Líder do RH e o Admin enviam; o Responsável do RH do Cliente lê as regras e liga os interruptores do Cliente.
