# ADR 0006 — Conversão de áudio com ffmpeg no servidor (plano B da gravação)

**Status:** aceita (2026-10-14)

## Contexto

O Funcionário grava áudio pelo navegador (#80). A Cloud API do WhatsApp aceita ogg com Opus e mp4/AAC,
mas **não webm**. O `MediaRecorder` do Firefox grava ogg/opus e o do Safari grava mp4, mas o do
Chrome/Edge grava `audio/webm;codecs=opus` por padrão (versões recentes já aceitam mp4, mas não dá
para contar com isso em todas as versões instaladas).

## Decisão

- O navegador negocia o formato por `MediaRecorder.isTypeSupported` (ogg/opus, depois mp4/AAC) e só
  cai em webm quando nenhum dos dois existe.
- Webm é convertido **no servidor**, no caso de uso, por uma porta OUT neutra
  (`ConversorDeAudioPort.paraOggOpus`) antes de guardar e entregar. A porta de envio nunca recebe
  webm, e o arquivo tocado na conversa é o convertido.
- O gateway chama o binário do ffmpeg por `child_process.spawn` (pipe de entrada e saída, mono, Opus
  32 kbps). O binário vem do pacote `ffmpeg-static`, que o baixa na instalação; `FFMPEG_PATH` troca
  por outro binário.
- Para a função levar menos peso, o `prebuild` comprime o binário em brotli (`.ffmpeg/ffmpeg.br`,
  cerca de 83 MB → 26 MB); a rota da conversa leva só esse arquivo (`outputFileTracingIncludes`, com o
  binário bruto em `outputFileTracingExcludes`) e `resolverFfmpeg` o descomprime em `/tmp` na
  primeira conversão da instância (só quando há webm a converter). Em desenvolvimento, sem o `.br`, usa o binário do pacote.
- Se o binário não executar, o envio falha com mensagem clara; a gravação continua no navegador.

## Alternativas

- `fluent-ffmpeg`: só embrulha o `spawn` em API fluente; o comando é um só, não compensa a dependência.
- Encoder Opus/ogg em WASM no navegador (`opus-recorder`): tira a conversão do servidor, mas é código
  de terceiros no cliente e precisa de gravação por AudioWorklet.

## Consequências

Chrome/Edge funcionam sem configurar nada no ambiente. A primeira conversão de cada instância paga a
descompressão (cerca de 1 s). Se o limite de tamanho da hospedagem ainda apertar, o caminho é o
encoder WASM no navegador.
