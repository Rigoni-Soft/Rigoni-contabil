# ADR 0012 — O avatar do funcionário é guardado de propósito, e só o dono o vê

**Status:** aceita (2026-11-17)

## Contexto

Todo usuário, de qualquer Papel (o Admin inclusive), pode personalizar o próprio avatar em Meu perfil (mapa #263). Diferente da foto do Cartão de ponto
(ADR 0011, que nunca é guardada), a imagem do avatar é dado pessoal que o sistema **guarda**, vinculado ao
Funcionário, para voltar a aparecer em todo acesso. O Supabase Auth não tem armazenamento de avatar (só o
campo livre `user_metadata.avatar_url`), então o arquivo vai para o Storage. Sem imagem enviada, o avatar é
a logo do setor e, sem ela, a do escritório (arquivos estáticos em `public/logos/`, não dado pessoal).

## Decisão

- **Alcance mínimo**: só o próprio dono vê o avatar enviado (cabeçalho dele e Meu perfil). Nenhuma
  tela mostra a imagem de outro usuário, nem Líder, nem Admin. Mostrar o de outros é decisão e frente nova.
- **Onde fica**: bucket privado `avatares`, um objeto por usuário (`{usuario_id}`), sobrescrito, sem histórico,
  limite de 256 KB e só `image/webp`. A escrita é só do servidor (service role), depois da autorização, sem
  policy para `authenticated`. A coluna `avatar_atualizado_em` em `perfis` (nulo = sem foto) é gravada só
  pelo sistema (ADR 0008). A leitura é a rota autenticada `/api/avatar`, que serve só a foto do próprio
  usuário, com `Cache-Control: private`.
- **O que entra**: JPEG, PNG ou WebP até 5 MB escolhidos pelo usuário; o navegador recorta o centro, reduz
  para WebP 256×256 (o EXIF some) e o servidor confere os bytes e recusa mais de 256 KB. Sem GIF nem SVG.
- **Remoção**: botão "Remover foto" em Meu perfil, imediato, sem prazo de retenção. A desativação do usuário
  também apaga a foto. Em qualquer remoção o objeto é apagado antes de a coluna ser zerada; se o apagar
  falhar, a coluna continua preenchida e a operação se repete. Na desativação o banimento da conta e o apagar da foto rodam sempre, e a falha de um não impede o outro (a foto é dado pessoal e não espera um ban que falhou); repetir a ação refaz só o que falta. A desativação com a foto ainda gravada conta
  como desativação pendente, visível ao Admin, que repete a ação (idempotente).
- **Auditoria**: enviar e remover viram Registro de auditoria (`perfil.avatar.enviar`, `perfil.avatar.remover`),
  com ator e resultado, nunca com a imagem.
- **Transparência**: Meu perfil diz "Sua foto fica guardada no sistema e só você a vê. Remova quando quiser."
  Sem checkbox de consentimento (envio voluntário, feito pelo próprio titular).
- **Fora de escopo**: botão de Admin para remover foto de outra pessoa; histórico de versões; editor de
  enquadramento.

## Consequências

- É o primeiro dado de imagem de pessoa guardado pelo sistema; a política de retenção é "apaga ao remover ou
  ao desativar".
- A falha de apagar na desativação deixa o usuário numa pendência visível, não em silêncio.
- Mostrar o avatar de outros usuários (lista de equipe, chat) exige revisar este ADR.
