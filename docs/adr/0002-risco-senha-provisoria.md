# Risco de corrida na senha provisória e mitigações aceitas

O ticket #30 cria a conta com senha provisória ativa na hora (`email_confirm: true`, sem etapa de verificação por e-mail — decisão original do ticket, não um invite-link). O #31 (troca obrigatória no primeiro login, ainda não implementado) bloqueia qualquer tela até a troca, mas **não elimina** um risco de corrida: quem autenticar primeiro com a senha provisória é quem define a senha definitiva da conta. Se essa senha vazar antes do primeiro acesso do Funcionário/Líder real (ex.: repassada por um canal inseguro), quem a interceptou toma a conta, e o #31 não tem como distinguir "dono legítimo" de "quem chegou primeiro" — nenhuma tela de troca resolve isso, porque a única credencial que existe naquele momento é a senha provisória em si.

**Decisão:** aceitar esse risco residual, mitigado por controles fora do código — não perseguir uma solução 100% em software para um problema de canal de entrega. Mitigações já em vigor ou combinadas:

1. **Rate limit do GoTrue já ativo** (`supabase/config.toml`, `[auth.rate_limit]`): 30 tentativas de login por IP a cada 5 minutos. Não impede a corrida (a senha provisória não é adivinhada, é vazada), mas limita brute-force. **Confirmar que o projeto Supabase de homolog/produção tem a mesma configuração** — `config.toml` só se aplica sozinho ao ambiente local; um projeto hospedado não herda isso automaticamente.
2. **Entrega segura da senha é processo, não código**: o Admin deve repassar a senha provisória por um canal que só o funcionário real acesse (pessoalmente, ramal interno), nunca por um canal que um terceiro possa interceptar.
3. **Trilha de auditoria da troca** (sugerida para o #31, ainda não implementada): registrar `usuario.trocar_senha_primeiro_acesso` via a mesma `AuditoriaPort` que o #30 já usa, para que um Admin consiga investigar discrepâncias (ex.: funcionário relata nunca ter acessado, mas há uma troca registrada horas antes).
4. **Expiração em 48h** (decisão revisada no #19, substitui "sem expiração de tempo"): reduz a janela em que uma senha vazada continua utilizável, sem exigir nada novo do fluxo de cadastro do Admin (#30). O #31 checa o vencimento no login **e em toda leitura de sessão** (`ObterSessao`, devolutiva técnica PR #62 ponto 3) — uma sessão aberta antes do vencimento não continua válida depois dele dentro do app.

   **Risco residual aceito (mesma devolutiva, ponto 3):** essa checagem vive só na aplicação (Next.js), não nas policies de RLS. Quem tiver o JWT da sessão (válido até o refresh token expirar) ainda consegue ler/escrever via Data API/RPC do Supabase diretamente — sem passar pelo app — mesmo depois da senha provisória vencida, porque `meu_papel()`/`meu_setor()` (as funções `SECURITY DEFINER` que toda policy de RLS do projeto reusa pra RBAC) não checam `senha_provisoria_expira_em`. Fechar isso por completo exigiria endurecer essas duas funções, o que toca RLS de **todos** os módulos existentes (não só `perfis`) e pede uma bateria de testes de RLS própria antes de ser seguro — desproporcional ao escopo do #31/#62. Aceito por ora, mesmo raciocínio dos itens acima (mitigado pela janela curta de 48h); candidato a ticket próprio se o risco virar preocupação concreta (ex.: write de dado por uma sessão vencida sendo reportado de verdade).

**Decisão sobre conta vencida sem troca (fechada na implementação do #31):** o login é bloqueado com uma mensagem pedindo pra falar com o Admin; o Admin resolve manualmente (Supabase Studio/Dashboard → Authentication → Users → Reset password), já que a API de criação de conta (`SupabaseAuthAdminGateway.criarConta`) falha com `email_exists` pra um e-mail já cadastrado — "recriar" não é literal, é resetar a senha da conta existente. Não foi criado nenhum endpoint de auto-regeneração no app: não era critério de aceite do #31, e o risco residual já é aceito por este ADR. Se isso virar operação frequente o bastante pra doer, é candidato a um ticket novo (ação de Admin "resetar senha provisória" reaproveitando `AuthAdminPort`/`admin.updateUserById`).

**Correção (devolutiva técnica PR #62, ponto 6): o passo acima, sozinho, não desbloqueia a conta.** Resetar a senha pelo Studio só muda o Auth — `perfis.senha_trocada_em` continua `NULL` e `senha_provisoria_expira_em` continua no passado, então o próximo login é rejeitado de novo como "senha provisória expirada" (`Login.execute`/`senhaProvisoriaVencida`), mesmo com a senha nova certa. O procedimento manual tem **duas etapas**, as duas obrigatórias:

1. Supabase Studio/Dashboard → Authentication → Users → Reset password (reseta o Auth, como já descrito acima).
2. SQL Editor do mesmo projeto, resetando o estado de senha provisória do perfil pra uma nova janela de 48h:
   ```sql
   update public.perfis
   set senha_trocada_em = null,
       senha_provisoria_expira_em = now() + interval '48 hours'
   where id = '<uuid do usuário>';
   ```

Continua sem endpoint no app pelo mesmo motivo de antes (risco aceito, não era critério de aceite) — a mudança aqui é só deixar as duas etapas explícitas, já que a ausência da segunda é um bug de documentação, não uma escolha consciente.
