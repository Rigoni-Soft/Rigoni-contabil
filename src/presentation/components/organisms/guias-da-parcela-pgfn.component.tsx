import { CalendarClock, ChevronRight } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDaGuia } from "@/presentation/components/atoms/botao-da-guia.component";
import { BotaoDeArquivo } from "@/presentation/components/atoms/botao-de-arquivo.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { ConfirmacaoEmLinha } from "@/presentation/components/molecules/confirmacao-em-linha.component";
import { SeloDaGuia } from "@/presentation/components/molecules/selo-da-guia.component";
import { cn } from "@/presentation/lib/utils";
import { TEXTO_ENVIO_AUTOMATICO } from "@/shared/kernel/dias-do-job-parcelamento";

type GuiaDaListaDto = {
  id: string;
  competencia: string;
  rotulo: string;
  contaNegociacao: string;
  confirmada: boolean;
  motivo?: string;
  idDaRemocao: string;
  idDaLiberacao: string;
  enviada: boolean;
};

export type ResultadoDaGuia = { tipo: "sucesso" | "atencao"; texto: string };

export type AcaoDaGuia = {
  tipo: "liberar" | "remover";
  competencia: string;
  emCurso: boolean;
};

export type DadosDoAnexo = {
  competencia: string;
  onCompetencia: (valor: string) => void;
  contaNegociacao: string;
  onContaNegociacao: (valor: string) => void;
  arquivo?: File;
  onArquivo: (arquivo: File | undefined) => void;
  erros: { competencia?: string; contaNegociacao?: string; arquivo?: string };
};

export type AcoesDasGuias = {
  pedir: (tipo: AcaoDaGuia["tipo"], competencia: string) => void;
  cancelar: () => void;
  confirmar: (competencia: string) => void;
  anexar: () => void;
  trocar: (competencia: string, arquivo: File) => void;
  remover: (competencia: string) => void;
  visualizar: (competencia: string) => void;
};

type GuiasDaParcelaPgfnProps = {
  id: string;
  codigo: string;
  interno: boolean;
  idDaRegiao: string;
  guias: GuiaDaListaDto[];
  carregando: boolean;
  erroDaLista?: string;
  onTentarNovamente: () => void;
  anexo: DadosDoAnexo;
  pendente: boolean;
  anexando: boolean;
  erroServidor?: string;
  resultado?: ResultadoDaGuia;
  competenciaEmFalta?: string;
  acao?: AcaoDaGuia;
  acoes: AcoesDasGuias;
};

const NOTA_LEGIVEL = "text-sm";

export function GuiasDaParcelaPgfn({
  id,
  codigo,
  interno,
  idDaRegiao,
  guias,
  carregando,
  erroDaLista,
  onTentarNovamente,
  anexo,
  pendente,
  anexando,
  erroServidor,
  resultado,
  competenciaEmFalta,
  acao,
  acoes,
}: GuiasDaParcelaPgfnProps) {
  const {
    competencia,
    onCompetencia,
    contaNegociacao,
    onContaNegociacao,
    arquivo,
    onArquivo,
    erros,
  } = anexo;
  const abrirManual = Boolean(
    competencia || contaNegociacao || erros.competencia || erros.contaNegociacao,
  );

  const pendencia =
    !carregando && !erroDaLista && guias.length === 0
      ? "Nenhuma guia anexada."
      : competenciaEmFalta && `Falta a guia de ${competenciaEmFalta}.`;

  const renderGuia = (guia: GuiaDaListaDto) => {
    const daAcao = acao?.competencia === guia.competencia ? acao : undefined;
    const liberando = daAcao?.tipo === "liberar";
    const removendo = daAcao?.tipo === "remover";
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
        {(guia.enviada || guia.confirmada) && (
          <Texto variante="nota" className={cn("mt-1", NOTA_LEGIVEL)}>
            {guia.enviada
              ? "Já enviada ao Cliente: só pode ser aberta."
              : "Trocar o PDF devolve a guia a «a confirmar»."}
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
          {!removendo && (
            <BotaoDaGuia
              variant="link"
              ocupado={pendente}
              onClick={() => acoes.visualizar(guia.competencia)}
              aria-label={`Ver guia de ${guia.rotulo}`}
            >
              Ver
            </BotaoDaGuia>
          )}
          {!guia.confirmada &&
            !guia.enviada &&
            (liberando ? (
              <ConfirmacaoEmLinha
                texto={
                  <>
                    Libera a guia de {guia.rotulo} (conta {guia.contaNegociacao}).{" "}
                    {interno
                      ? "Vai ao WhatsApp do financeiro do escritório, não ao Cliente."
                      : "Vai ao Cliente, pela forma de envio do cadastro."}{" "}
                    {TEXTO_ENVIO_AUTOMATICO}; até lá ainda dá para trocar ou remover. Depois de
                    enviada, não se altera.
                  </>
                }
                rotuloDoConfirmar={`Liberar ${guia.rotulo}`}
                rotuloEmCurso="Liberando…"
                nomeDoConfirmar={`Liberar ${guia.rotulo} ao envio`}
                nomeDoCancelar={`Cancelar liberação da guia de ${guia.rotulo}`}
                emCurso={daAcao.emCurso}
                ocupado={pendente}
                onConfirmar={() => acoes.confirmar(guia.competencia)}
                onCancelar={acoes.cancelar}
              />
            ) : (
              <BotaoDaGuia
                id={guia.idDaLiberacao}
                ocupado={pendente}
                onClick={() => acoes.pedir("liberar", guia.competencia)}
                aria-label={`Confirmar e liberar guia de ${guia.rotulo} ao envio`}
                aria-describedby={guia.motivo ? `${guia.id}-motivo` : undefined}
              >
                Confirmar e liberar
              </BotaoDaGuia>
            ))}
          <Linha alinhar="centro" espaco={1} quebra className="ml-auto pointer-coarse:gap-3">
            {!guia.enviada && (
              <>
                {!removendo && (
                  <BotaoDeArquivo
                    rotulo="Trocar"
                    rotuloAcessivel={`Trocar guia de ${guia.rotulo}`}
                    aceitar="application/pdf"
                    ocupado={pendente}
                    onEscolher={(novo) => acoes.trocar(guia.competencia, novo)}
                  />
                )}
                {removendo ? (
                  <ConfirmacaoEmLinha
                    texto={`Apaga a guia de ${guia.rotulo} e o PDF, sem desfazer.`}
                    rotuloDoConfirmar="Confirmar remoção"
                    rotuloEmCurso="Removendo…"
                    nomeDoConfirmar={`Confirmar remoção da guia de ${guia.rotulo}`}
                    nomeDoCancelar={`Cancelar remoção da guia de ${guia.rotulo}`}
                    destrutiva
                    emCurso={daAcao.emCurso}
                    ocupado={pendente}
                    onConfirmar={() => acoes.remover(guia.competencia)}
                    onCancelar={acoes.cancelar}
                  />
                ) : (
                  <BotaoDaGuia
                    id={guia.idDaRemocao}
                    variant="link"
                    ocupado={pendente}
                    onClick={() => acoes.pedir("remover", guia.competencia)}
                    aria-label={`Remover guia de ${guia.rotulo}`}
                    className="text-muted-foreground hover:text-destructive focus-visible:text-destructive"
                  >
                    Remover
                  </BotaoDaGuia>
                )}
              </>
            )}
          </Linha>
        </Linha>
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
            Carregando guias…
          </Texto>
        )}
      </Pilha>
      {pendencia && (
        <Texto
          variante="nota"
          className={cn("flex items-start gap-1.5 text-foreground", NOTA_LEGIVEL)}
        >
          <CalendarClock className="mt-[3px] size-3.5 shrink-0" aria-hidden="true" />
          {pendencia}
        </Texto>
      )}
      {guias.length > 0 && (
        <Pilha como="ul" espaco={1} className="divide-y divide-border">
          {guias.map(renderGuia)}
        </Pilha>
      )}

      <Caixa aria-live="polite" className="space-y-1 empty:hidden">
        {erroServidor && <FieldError>{erroServidor}</FieldError>}
        {resultado && <AvisoDeStatus tipo={resultado.tipo} texto={resultado.texto} legivel />}
      </Caixa>

      <Pilha espaco={3}>
        <CampoDeArquivo
          id={`${id}-arquivo`}
          rotulo="PDF da guia"
          accept="application/pdf"
          dica="PDF até 4 MB"
          file={arquivo}
          onChange={onArquivo}
          erro={erros.arquivo}
        />
        <Caixa como="details" open={abrirManual || undefined} className="group">
          <Caixa
            como="summary"
            className="flex w-fit cursor-pointer items-center gap-1 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:py-2"
          >
            <ChevronRight
              className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
              aria-hidden="true"
            />
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
        <BotaoDaGuia
          variant={arquivo ? "default" : "outline"}
          ocupado={pendente}
          onClick={acoes.anexar}
          className="self-start"
        >
          {anexando ? "Enviando…" : "Anexar guia"}
        </BotaoDaGuia>
      </Pilha>
    </Pilha>
  );
}
