# Regras dos componentes de apresentação

Conhecimento que vivia em comentários de `src/presentation/components/molecules` e `organisms`.

## Estado nunca só por cor
Selos e indicadores de resultado levam ícone + texto + cor (DESIGN.md "Indicadores de estado"). Enviado/confirmada é `primary`; pendente, quitado e "a confirmar" são neutros; `success` dourado é do selo "em dia" do Simples Nacional; falha de leitura é neutra (cai no "digite à mão"). `falha_compensacao` tem ícone próprio: pode ter deixado estado inconsistente.
Onde vive: src/presentation/components/molecules/selo-da-guia.component.tsx, selo-do-parcelamento.component.tsx, indicador-de-leitura.component.tsx, linha-de-registro.component.tsx, donut-de-fatias.component.tsx

## Foco seguro em confirmações
Perguntas de risco em linha abrem o foco no "Cancelar" (gesto seguro); `focoInicial` leva ao confirmar quando a pessoa acabou de pedir a ação. A pergunta descreve os botões via aria-describedby.
Onde vive: src/presentation/components/molecules/confirmacao-em-linha.component.tsx; spec: linha-de-contato.component.spec.tsx

## Botões com aria-disabled, não disabled
Botões de ação seguem focáveis e o leitor de tela ouve o motivo (aria-disabled); campos de horário usam readOnly fora da edição (disabled tira da tabulação). Depois de salvar o foco não cai no body.
Onde vive: src/presentation/components/organisms/cartao-de-ponto.component.tsx, molecules/linha-do-cartao-de-ponto.component.tsx, molecules/linha-de-parcelamento.component.tsx

## Contato: readOnly e não disabled
O valor segue no formulário e volta intacto ao salvar o cadastro. Contato de outro Setor tem nome/WhatsApp/e-mail só de leitura; os envios são do Setor. A falta dos dois canais é erro da linha. A numeração "Contato N" conta só os contatos visíveis (1-based). Enquanto uma linha edita, o Salvar do cadastro espera.
Onde vive: src/presentation/components/molecules/linha-de-contato.component.tsx, organisms/contatos-do-cadastro.component.tsx

## Região aria-live repetida
A região segue montada e a vez ímpar acrescenta um caractere invisível para o leitor anunciar de novo a mesma frase.
Onde vive: src/presentation/components/organisms/contatos-do-cadastro.component.tsx:CARACTERE_INVISIVEL, avisoDeVezImpar

## Cartão de ponto
Folga e feriado só têm a coluna Extra (toda hora neles é extra), salvo batida já salva. Dia abonado não tem horário. A tela mostra dois pares de batida + Extra (o banco guarda até quatro). Totalização usa a legislação quando não há convenção vigente. Borda do campo sobre linha com tom precisa de 3:1 (WCAG 1.4.11).
Onde vive: src/presentation/components/molecules/linha-do-cartao-de-ponto.component.tsx, organisms/cartao-de-ponto.component.tsx

## Comparativos RH/SN duplicados
O esqueleto de comparativos-rh repete o de comparativos-sn; parametrizar um só quando um 3º Setor tiver comparativos.
Onde vive: src/presentation/components/organisms/comparativos-rh.component.tsx, comparativos-sn.component.tsx

## Compositor de mensagem
Sem maxLength (conta UTF-16, emoji valeria 2): o limite é conferido ao enviar. Ctrl+V com imagem vira anexo. Enter de composição (IME) não envia; Safari entrega isComposing falso com keyCode 229. Há um único compositor por tela (id fixo liga o microfone ao motivo).
Onde vive: src/presentation/components/organisms/compositor-de-mensagem.component.tsx:ehEnterDeEnvio, KEY_CODE_DE_COMPOSICAO_NO_SAFARI

## DAS enviado é do sistema
Depois de concluído o envio nem o Admin troca o DAS nem a data; campos desativados são esmaecidos (DESIGN.md).
Onde vive: src/presentation/components/organisms/das-do-cadastro.component.tsx

## Fotos de avatar
Texto de transparência sempre à vista, sem checkbox de consentimento (ADR 0012).
Onde vive: src/presentation/components/organisms/avatar-da-conta.component.tsx

## Views burras
Listas de useFieldArray e estado de seletores vêm montados pelo Container; as Views não têm hooks.
Onde vive: src/presentation/components/organisms/criar-cliente-form.component.tsx, contatos-do-cadastro.component.tsx, compositor-de-mensagem.component.tsx

## Avisos de CNPJ
Avisos da consulta de CNPJ não são erro de validação (o Zod não sabe se um CNPJ existe), por isso ficam fora de `errors`.
Onde vive: src/presentation/components/organisms/criar-cliente-form.component.tsx