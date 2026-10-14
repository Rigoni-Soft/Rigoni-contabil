# ADR 0006 — Conversão de áudio com ffmpeg no servidor (plano B da gravação)

**Status:** aceita (2026-10-14)

## Contexto

O Funcionário grava áudio pelo navegador (#80). A Cloud API do WhatsApp aceita ogg com Opus e mp4/AAC,
mas **não webm**. O `MediaRecorder` do Firefox grava ogg/opus e o do Safari grava mp4, mas o do
Chrome/Edge (a maioria dos usuários) grava `audio/webm;codecs=opus`.

## Decisão

- O navegador negocia o formato por `MediaRecorder.isTypeSupported` (ogg/opus, depois mp4/AAC) e só
  cai em webm quando nenhum dos dois existe.
- Webm é convertido **no servidor**, no caso de uso, por uma porta OUT neutra
  (`ConversorDeAudioPort.paraOggOpus`) antes de guardar e entregar. A porta de envio nunca recebe
  webm, e o arquivo tocado na conversa é o convertido.
- O gateway chama o binário `ffmpeg` do ambiente por `child_process.spawn` (pipe de entrada e saída,
  mono, Opus 32 kbps), localizado por `FFMPEG_PATH` ou pelo PATH. Sem dependência nova no `package.json`.
- Sem o binário, o envio falha com mensagem clara; a gravação continua no navegador para nova tentativa.

## Alternativas

- `ffmpeg-static` + `fluent-ffmpeg`: traz o binário (dezenas de MB) para o bundle da função; na
  Vercel exige `outputFileTracingIncludes` e pesa no limite de tamanho. Adotar só se o deploy não
  puder fornecer ffmpeg.
- Encoder Opus/ogg em WASM no navegador (`opus-recorder`): tira a conversão do servidor, mas é código
  de terceiros no cliente e precisa de gravação por AudioWorklet.

## Consequências

Em desenvolvimento e em hospedagem com ffmpeg, Chrome/Edge funcionam. Em ambiente sem ffmpeg
(a Vercel padrão), só Firefox e Safari enviam áudio até o deploy escolher uma das alternativas;
essa escolha é pendência de deploy, não de código.
