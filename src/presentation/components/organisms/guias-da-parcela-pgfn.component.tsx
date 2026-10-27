import { CalendarClock } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeArquivo } from "@/presentation/components/atoms/botao-de-arquivo.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { SeloDaGuia } from "@/presentation/components/molecules/selo-da-guia.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";
import { DIAS_DO_JOB_PARCELAMENTO } from "@/shared/kernel/dias-do-job-parcelamento";

type GuiaDaListaDto = {
  // Id do item no DOM (alvo do foco depois de confirmar).
  id: string;
  competencia: string;
  rotulo: string;
  contaNegociacao: string;
  confirmada: boolean;
  // O que conferir numa guia "a confirmar" (vem do leitor do PDF; some ao confirmar).
  motivo?: string;
  // Id do botão Remover (alvo do foco ao cancelar a confirmação).
  idDaRemocao: string;
  // Id do botão "Confirmar e liberar" (alvo do foco ao cancelar a conferência).
  idDaLiberacao: string;
  // Já tem registro de envio: só pode ser aberta, não troca nem remove.
  enviada: boolean;
  // A confirmar ou do mês corrente; as demais ficam recolhidas em "Ver histórico".
  recente: boolean;
};

type GuiasDaParcelaPgfnProps = {
  // Prefixo dos ids (um conjunto de campos por Parcelamento na mesma tela).
  id: string;
  // Código do Parcelamento: nomeia a região (há uma por Parcelamento PGFN na mesma tela).
  codigo: string;
  // Parcelamento interno: a guia vai ao financeiro do escritório, nunca ao Cliente.
  interno: boolean;
  // Id da região (alvo do foco depois de remover uma guia); vem pronto do presenter.
  idDaRegiao: string;
  guias: GuiaDaListaDto[];
  carregando: boolean;
  erroDaLista?: string;
  onTentarNovamente: () => void;
  competencia: string;
  onCompetencia: (valor: string) => void;
  contaNegociacao: string;
  onContaNegociacao: (valor: string) => void;
  arquivo?: File;
  onArquivo: (arquivo: File | undefined) => void;
  erros: { competencia?: string; contaNegociacao?: string; arquivo?: string };
  // Qualquer ação em curso (trava os controles); `anexando` é só o envio do PDF (rótulo do botão).
  pendente: boolean;
  anexando: boolean;
  erroServidor?: string;
  // Sucesso, ou atenção (anexada mas "a confirmar": o que fazer; não é sucesso nem erro).
  resultado?: { tipo: "sucesso" | "atencao"; texto: string };
  // Guia a que o erro ou resultado se refere: ele aparece no item dela; sem alvo, num ponto fixo acima do formulário.
  alvoDoAviso?: string;
  // Rótulo ("10/2026") da guia do mês corrente que ainda não foi anexada.
  competenciaEmFalta?: string;
  onAnexar: () => void;
  onConfirmar: (competencia: string) => void;
  onTrocar: (competencia: string, arquivo: File) => void;
  // Competência cuja liberação espera conferência (vai ao Cliente, sem desfazer).
  liberando?: string;
  onPedirLiberacao: (competencia: string) => void;
  onCancelarLiberacao: (competencia: string) => void;
  // Competência cuja confirmação está em curso.
  confirmando?: string;
  // Competência cuja remoção está em curso.
  apagando?: string;
  // Competência cuja remoção espera confirmação (apaga registro e PDF, sem desfazer).
  removendo?: string;
  onPedirRemocao: (competencia: string) => void;
  onCancelarRemocao: (competencia: string) => void;
  onRemover: (competencia: string) => void;
  onVisualizar: (competencia: string) => void;
};

// Nota que a pessoa precisa ler para agir: 14 px, não os 12 px da variante `nota`.
const NOTA_LEGIVEL = "text-sm";

const DIAS_DO_ENVIO = DIAS_DO_JOB_PARCELAMENTO.join(", ");

const DICA_DE_TROCAR = "Troca o PDF e a guia volta a «a confirmar».";

const BOTAO_DA_GUIA =
  "aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11";

// "Anexar guia do mês" na linha de um Parcelamento PGFN. Fica dentro do formulário do cadastro, então
// nada aqui é <form> (nem submete): os botões são `button` e cada ação vai por Server Action própria.
export function GuiasDaParcelaPgfn({
  id,
  codigo,
  interno,
  idDaRegiao,
  guias,
  carregando,
  erroDaLista,
  onTentarNovamente,
  competencia,
  onCompetencia,
  contaNegociacao,
  onContaNegociacao,
  arquivo,
  onArquivo,
  erros,
  pendente,
  anexando,
  erroServidor,
  resultado,
  alvoDoAviso,
  competenciaEmFalta,
  onAnexar,
  onConfirmar,
  onTrocar,
  liberando,
  onPedirLiberacao,
  onCancelarLiberacao,
  confirmando: confirmandoGuia,
  apagando,
  removendo,
  onPedirRemocao,
  onCancelarRemocao,
  onRemover,
  onVisualizar,
}: GuiasDaParcelaPgfnProps) {
  const recentes = guias.filter((g) => g.recente);
  const historico = guias.filter((g) => !g.recente);
  const temDigitado = Boolean(
    competencia || contaNegociacao || erros.competencia || erros.contaNegociacao,
  );

  const avisos = (
    <>
      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {resultado && <AvisoDeStatus tipo={resultado.tipo} texto={resultado.texto} legivel />}
    </>
  );
  const avisoNoItem = Boolean(alvoDoAviso) && guias.some((g) => g.competencia === alvoDoAviso);
  const abrirManual = temDigitado || Boolean(erroServidor && !alvoDoAviso);

  const formularioDeAnexo = (
    <>
      <CampoDeArquivo
        id={`${id}-arquivo`}
        rotulo="PDF da guia"
        accept="application/pdf"
        dica="PDF até 4 MB"
        compacto
        file={arquivo}
        onChange={onArquivo}
        erro={erros.arquivo}
      />
      {/* O sistema lê o mês e a conta do PDF: os campos só se abrem para quem precisa digitar. Abre
          sozinho se já tem valor ou erro, para a recusa nunca ficar escondida. */}
      <Caixa como="details" open={abrirManual || undefined}>
        <Caixa
          como="summary"
          className="w-fit cursor-pointer rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:py-2"
        >
          Preencher mês e conta à mão
        </Caixa>
        <Pilha espaco={3} className="pt-3">
          <Texto variante="nota" id={`${id}-leitura`}>
            O sistema lê o PDF; digite só se ele não conseguir.
          </Texto>
          <Linha alinhar="fim" espaco={3} quebra>
            <CampoDeTexto
              id={`${id}-competencia`}
              rotulo="Competência"
              type="month"
              // Navegador sem seletor de mês (ex.: Firefox no desktop) mostra texto livre: o formato vai no placeholder.
              placeholder="AAAA-MM"
              aria-describedby={`${id}-leitura`}
              value={competencia}
              onChange={(evento) => onCompetencia(evento.target.value)}
              erro={erros.competencia}
              disabled={anexando}
              className="min-w-[10rem] flex-1 gap-1"
            />
            <CampoDeTexto
              id={`${id}-conta`}
              rotulo="Conta de negociação"
              maxLength={40}
              aria-describedby={`${id}-leitura`}
              value={contaNegociacao}
              onChange={(evento) => onContaNegociacao(evento.target.value)}
              erro={erros.contaNegociacao}
              disabled={anexando}
              className="min-w-[10rem] flex-1 gap-1"
            />
          </Linha>
        </Pilha>
      </Caixa>
      <Button
        type="button"
        variant={arquivo ? "default" : "outline"}
        size="sm"
        aria-disabled={pendente || undefined}
        onClick={onAnexar}
        className={cn(BOTAO_DA_GUIA, "self-start")}
      >
        {anexando ? "Enviando..." : "Anexar guia"}
      </Button>
    </>
  );
  // Com a guia do mês já anexada, o formulário não pesa tanto quanto a lista: fica recolhido.
  const recolherAnexo = guias.length > 0 && !competenciaEmFalta;

  const renderGuia = (guia: GuiaDaListaDto) => {
    const confirmando = removendo === guia.competencia;
    return (
      <Caixa
        como="li"
        key={guia.competencia}
        id={guia.id}
        tabIndex={-1}
        className="rounded-sm py-3 outline-none first:pt-0 last:pb-0 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Linha alinhar="centro" justificar="entre" espaco={3} quebra>
          <Texto
            variante="corpo"
            className="min-w-0 font-medium [overflow-wrap:anywhere] tabular-nums"
          >
            {guia.rotulo} · conta {guia.contaNegociacao}
          </Texto>
          <SeloDaGuia confirmada={guia.confirmada} enviada={guia.enviada} />
        </Linha>
        {guia.confirmada && !guia.enviada && (
          <Texto variante="nota" className={cn("mt-1", NOTA_LEGIVEL)}>
            Trocar o PDF devolve a guia a «a confirmar».
          </Texto>
        )}
        {guia.enviada && (
          <Texto variante="nota" className={cn("mt-1", NOTA_LEGIVEL)}>
            Já enviada ao Cliente: só pode ser aberta.
          </Texto>
        )}
        {!guia.confirmada && guia.motivo && (
          <Texto
            variante="nota"
            id={`${guia.id}-motivo`}
            className={cn("mt-1 [overflow-wrap:anywhere]", NOTA_LEGIVEL)}
          >
            {guia.motivo}
          </Texto>
        )}
        <Linha alinhar="centro" espaco={2} quebra className="mt-2">
          {!confirmando && (
            <Button
              type="button"
              variant="link"
              size="sm"
              aria-disabled={pendente || undefined}
              onClick={() => onVisualizar(guia.competencia)}
              aria-label={`Ver guia de ${guia.rotulo}`}
              className={BOTAO_DA_GUIA}
            >
              Ver
            </Button>
          )}
          {!guia.confirmada &&
            !guia.enviada &&
            (liberando === guia.competencia ? (
              <>
                <Texto variante="corpo" role="alert" className="basis-full">
                  Libera a guia de {guia.rotulo} (conta {guia.contaNegociacao}).{" "}
                  {interno
                    ? "Vai ao WhatsApp do financeiro do escritório, não ao Cliente."
                    : "Vai ao Cliente, pela forma de envio do cadastro."}{" "}
                  Sai no envio automático (dias {DIAS_DO_ENVIO}) ou quando o Cliente pedir; até lá
                  ainda dá para trocar ou remover. Depois de enviada, não se altera.
                </Texto>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  aria-disabled={pendente || undefined}
                  onClick={() => onConfirmar(guia.competencia)}
                  aria-label={`Liberar ${guia.rotulo} ao envio`}
                  className={BOTAO_DA_GUIA}
                >
                  {confirmandoGuia === guia.competencia ? "Liberando..." : `Liberar ${guia.rotulo}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  // Quem abriu a conferência sem querer cai no gesto seguro.
                  autoFocus
                  onClick={() => onCancelarLiberacao(guia.competencia)}
                  aria-label={`Cancelar liberação da guia de ${guia.rotulo}`}
                  className={BOTAO_DA_GUIA}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                type="button"
                id={guia.idDaLiberacao}
                variant="default"
                size="sm"
                aria-disabled={pendente || undefined}
                onClick={() => onPedirLiberacao(guia.competencia)}
                aria-label={`Confirmar e liberar guia de ${guia.rotulo} ao envio`}
                aria-describedby={guia.motivo ? `${guia.id}-motivo` : undefined}
                className={BOTAO_DA_GUIA}
              >
                Confirmar e liberar
              </Button>
            ))}
          <Linha alinhar="centro" espaco={1} quebra className="ml-auto pointer-coarse:gap-3">
            {!guia.enviada && (
              <>
                {!confirmando && (
                  <BotaoDeArquivo
                    rotulo="Trocar"
                    rotuloAcessivel={`Trocar guia de ${guia.rotulo}. ${DICA_DE_TROCAR}`}
                    dica={DICA_DE_TROCAR}
                    aceitar="application/pdf"
                    ocupado={pendente}
                    onEscolher={(novo) => onTrocar(guia.competencia, novo)}
                  />
                )}
                {confirmando ? (
                  <>
                    <Texto variante="nota" role="alert" className={NOTA_LEGIVEL}>
                      Apaga a guia de {guia.rotulo} e o PDF, sem desfazer.
                    </Texto>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-disabled={pendente || undefined}
                      onClick={() => onRemover(guia.competencia)}
                      aria-label={`Confirmar remoção da guia de ${guia.rotulo}`}
                      className={BOTAO_DA_GUIA}
                    >
                      {apagando === guia.competencia ? "Removendo..." : "Confirmar remoção"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      // Quem abriu a confirmação sem querer cai no gesto seguro.
                      autoFocus
                      onClick={() => onCancelarRemocao(guia.competencia)}
                      aria-label={`Cancelar remoção da guia de ${guia.rotulo}`}
                      className={BOTAO_DA_GUIA}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    id={guia.idDaRemocao}
                    variant="link"
                    size="sm"
                    aria-disabled={pendente || undefined}
                    onClick={() => onPedirRemocao(guia.competencia)}
                    aria-label={`Remover guia de ${guia.rotulo}`}
                    className={cn(
                      BOTAO_DA_GUIA,
                      "text-muted-foreground hover:text-destructive focus-visible:text-destructive",
                    )}
                  >
                    Remover
                  </Button>
                )}
              </>
            )}
          </Linha>
        </Linha>
        {/* Região viva sempre presente: o aviso inserido nela é anunciado (uma região nova nem sempre é). */}
        <Caixa aria-live="polite" className="mt-2 space-y-1 empty:hidden">
          {avisoNoItem && alvoDoAviso === guia.competencia && avisos}
        </Caixa>
      </Caixa>
    );
  };

  return (
    <Pilha
      espaco={3}
      role="group"
      aria-label={`Guias da parcela ${codigo}`}
      aria-busy={pendente || undefined}
      id={idDaRegiao}
      tabIndex={-1}
      className="rounded-sm border-t border-border pt-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Pilha espaco={1}>
        <Texto variante="rotulo">Guias da parcela (PGFN)</Texto>
        <Texto variante="nota">As ações das guias valem na hora, sem precisar de Salvar.</Texto>
        {erroDaLista && (
          <AvisoComAcao
            texto={erroDaLista}
            rotuloDaAcao="Tentar novamente"
            onAcao={onTentarNovamente}
          />
        )}
        {carregando && (
          <Texto variante="nota" className={NOTA_LEGIVEL}>
            Carregando guias...
          </Texto>
        )}
        {!carregando && !erroDaLista && guias.length === 0 && (
          <Texto
            variante="nota"
            className={cn("flex items-start gap-1.5 text-foreground", NOTA_LEGIVEL)}
          >
            <CalendarClock className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
            Nenhuma guia anexada.
          </Texto>
        )}
      </Pilha>
      {competenciaEmFalta && (
        <Texto
          variante="nota"
          className={cn("flex items-start gap-1.5 text-foreground", NOTA_LEGIVEL)}
        >
          <CalendarClock className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
          Falta a guia de {competenciaEmFalta}.
        </Texto>
      )}
      {recentes.length > 0 && (
        <Pilha como="ul" espaco={1} className="divide-y divide-border">
          {recentes.map(renderGuia)}
        </Pilha>
      )}
      {historico.length > 0 && (
        <Caixa
          como="details"
          open={historico.some((g) => g.competencia === alvoDoAviso) || undefined}
        >
          <Caixa
            como="summary"
            className="w-fit cursor-pointer rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:py-2"
          >
            Ver histórico ({historico.length})
          </Caixa>
          <Pilha como="ul" espaco={1} className="divide-y divide-border pt-3">
            {historico.map(renderGuia)}
          </Pilha>
        </Caixa>
      )}

      <Caixa aria-live="polite" className="space-y-1 empty:hidden">
        {!avisoNoItem && avisos}
      </Caixa>

      {recolherAnexo ? (
        <Caixa
          como="details"
          open={arquivo || abrirManual || erros.arquivo || undefined ? true : undefined}
        >
          <Caixa
            como="summary"
            className="w-fit cursor-pointer rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:py-2"
          >
            Anexar outra guia
          </Caixa>
          <Pilha espaco={3} className="pt-3">
            {formularioDeAnexo}
          </Pilha>
        </Caixa>
      ) : (
        <Pilha espaco={3}>{formularioDeAnexo}</Pilha>
      )}
    </Pilha>
  );
}
