---
name: graphify-integration
description: Instala, inicializa e atualiza o Graphify (github.com/Graphify-Labs/graphify) — grafo de conhecimento do código que o Claude Code consulta antes de ler arquivos brutos — num projeto que seja um repositório git. Use quando o usuário pedir para inicializar/instalar o Graphify, ou depois de um git pull num projeto que já usa Graphify (o grafo não atualiza sozinho nesse caso).
---

# Graphify: instalação, inicialização e atualização

O projeto precisa ser um repositório git (`git init` já feito, por exemplo pela skill `next-project-init`).

Conteúdo confirmado direto no `README.md` de [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) (lido via `gh api`, não por resumo automático). **Nomenclatura:** o comando do dia a dia é `graphify`, com um "y" só. `graphifyy`, com dois "y", é *apenas* o nome do pacote no PyPI/uv — usado só na linha de instalação do pacote (passo 1), nunca depois disso.

## 1. Instalar a ferramenta na máquina (uma vez só, fora do projeto)

Precisa do `uv` (gerenciador de pacotes Python; o Graphify roda em Python 3.10+):

```powershell
winget install --id=astral-sh.uv -e
```

Feche e reabra o terminal (o PATH só atualiza assim), depois instale o pacote — **aqui, e só aqui, o nome leva dois "y"**:

```bash
uv tool install graphifyy
```

Se `graphify` não for reconhecido depois de instalado:

```bash
uv tool update-shell
```

Pule este passo se `graphify --version` já funcionar. Alternativa ao `uv`: `pipx install graphifyy` (o README recomenda `uv`/`pipx` em vez de `pip` puro, porque os dois isolam o pacote no próprio ambiente e evitam um `ModuleNotFoundError` se o `pip` instalar num Python diferente do que o Graphify resolve em tempo de execução).

## 2. Inicializar no projeto

Rode dentro de `.`, na raiz do projeto (repositório git). Três passos, nesta ordem — `install` e `hook install` **não criam o grafo sozinhos**:

```bash
# 1. instala a skill do Claude Code neste projeto (não no perfil global do usuário)
#    + ativa o modo estrito: bloqueia a PRIMEIRA leitura bruta de código-fonte
#    da sessão até o grafo ser consultado, depois volta a só sugerir — não
#    trava a sessão inteira, dispara no máximo uma vez por sessão.
graphify install --project --strict

# 2. cria o grafo pela primeira vez, offline e sem custo de LLM
#    (equivalente ao /graphify . rodado dentro do próprio Claude Code)
graphify extract . --code-only

# 3. instala os hooks de git que mantêm o grafo atualizado sozinho
#    + um merge driver, para graph.json nunca mostrar conflito de merge
graphify hook install
```

`graphify install --project` escreve a própria skill em `.claude/skills/graphify/SKILL.md` (mais um `references/` que ela carrega sob demanda) e configura o hook `PreToolUse` do Claude Code — **não precisa (e não deve) escrever nada manualmente em `CLAUDE.md`**; isso é coisa de outras plataformas (Codex, Cursor etc.), não do Claude Code.

Saída em `graphify-out/`: `graph.json` (o grafo), `GRAPH_REPORT.md` (god nodes, conexões inesperadas, perguntas sugeridas) e `graph.html` (visualização interativa).

Confira que os hooks ficaram ativos:

```bash
graphify hook status
```

Se o projeto já tiver rodado `graphify install --project` sem `--strict` antes, rode o comando do passo 1 de novo — ele sobrescreve a configuração anterior (o próprio README trata reinstalar como o caminho normal de atualizar a versão da skill: `uv tool upgrade graphifyy && graphify install`).

## 3. Atualização

| Você faz | O Graphify faz |
|---|---|
| `git commit` | reconstrói sozinho — só AST, sem custo de API |
| `git checkout` / `git switch` (troca de branch) | reconstrói sozinho (um `git checkout -- <arquivo>` isolado não conta) |
| `git pull` / `git merge` | **não atualiza sozinho** — rode `graphify update .` logo depois |
| `git push` | nada a fazer |

```bash
graphify update .
```

Se o usuário pedir só para "atualizar o Graphify" num projeto que já tem `graphify-out/`, este é o único comando necessário — não repita os passos 1–2. Para automatizar, o README sugere um alias de git:

```bash
git config --global alias.gpull '!git pull && graphify update .'
```

## Referência rápida (dentro do Claude Code, depois de instalado)

A própria skill do Graphify já orienta o Claude Code a preferir isto a `Grep`/`Read` cru:

```
/graphify query "<pergunta>"
graphify path "<A>" "<B>"
graphify explain "<conceito>"
```

`GRAPH_REPORT.md` continua disponível para uma visão geral de arquitetura sem nenhuma consulta pontual.
