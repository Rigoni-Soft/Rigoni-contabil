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

// O resultado do anexo e o motivo da pendência são o que o Funcionário precisa ler e agir: 14 px, não
// os 12 px do aviso padrão. O ícone desce 2 px para ficar na primeira linha de 20 px (como o FieldError).
const AVISO_LEGIVEL = "text-sm [&>svg]:mt-[3px]";

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
  // Já tem registro de envio: só pode ser aberta, não troca nem remove.
  enviada: boolean;
};

type GuiasDaParcelaPgfnProps = {
  // Prefixo dos ids (um conjunto de campos por Parcelamento na mesma tela).
  id: string;
  // Código do Parcelamento: nomeia a região (há uma por Parcelamento PGFN na mesma tela).
  codigo: string;
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
  // Onde mostrar o erro e o resultado: junto do formulário (anexo) ou da lista (ações sobre uma guia).
  avisoEm: "anexo" | "lista";
  onAnexar: () => void;
  onConfirmar: (competencia: string) => void;
  onTrocar: (competencia: string, arquivo: File) => void;
  // Competência cuja remoção espera confirmação (apaga registro e PDF, sem desfazer).
  removendo?: string;
  onPedirRemocao: (competencia: string) => void;
  onCancelarRemocao: (competencia: string) => void;
  onRemover: (competencia: string) => void;
  onVisualizar: (competencia: string) => void;
};

const BOTAO_DA_GUIA =
  "aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11";

// "Anexar guia do mês" na linha de um Parcelamento PGFN. Fica dentro do formulário do cadastro, então
// nada aqui é <form> (nem submete): os botões são `button` e cada ação vai por Server Action própria.
export function GuiasDaParcelaPgfn({
  id,
  codigo,
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
  avisoEm,
  onAnexar,
  onConfirmar,
  onTrocar,
  removendo,
  onPedirRemocao,
  onCancelarRemocao,
  onRemover,
  onVisualizar,
}: GuiasDaParcelaPgfnProps) {
  const avisos = (
    <>
      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {resultado && (
        <AvisoDeStatus tipo={resultado.tipo} texto={resultado.texto} className={AVISO_LEGIVEL} />
      )}
    </>
  );

  return (
    <Pilha
      espaco={3}
      role="group"
      aria-label={`Guias da parcela ${codigo}`}
      id={idDaRegiao}
      tabIndex={-1}
      className="border-t border-border pt-3 outline-none"
    >
      <Pilha espaco={1}>
        <Texto variante="rotulo">Guias da parcela (PGFN)</Texto>
        {erroDaLista && (
          <AvisoComAcao
            texto={erroDaLista}
            rotuloDaAcao="Tentar novamente"
            onAcao={onTentarNovamente}
          />
        )}
        {!carregando && !erroDaLista && guias.length === 0 && (
          <Texto variante="nota">Nenhuma guia anexada.</Texto>
        )}
      </Pilha>
      {guias.length > 0 && (
        <Pilha como="ul" espaco={1} className="divide-y divide-border">
          {guias.map((guia) => {
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
                  <Texto variante="corpo" className="min-w-0 [overflow-wrap:anywhere] tabular-nums">
                    {guia.rotulo} · conta {guia.contaNegociacao}
                  </Texto>
                  <SeloDaGuia confirmada={guia.confirmada} enviada={guia.enviada} />
                </Linha>
                {!guia.confirmada && guia.motivo && (
                  <Texto
                    variante="nota"
                    id={`${guia.id}-motivo`}
                    className="mt-1 text-sm [overflow-wrap:anywhere]"
                  >
                    {guia.motivo}
                  </Texto>
                )}
                <Linha alinhar="centro" espaco={2} quebra className="mt-2">
                  {!guia.confirmada && !guia.enviada && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      aria-disabled={pendente || undefined}
                      onClick={() => onConfirmar(guia.competencia)}
                      aria-label={`Confirmar e liberar guia de ${guia.rotulo} ao envio`}
                      aria-describedby={guia.motivo ? `${guia.id}-motivo` : undefined}
                      className={BOTAO_DA_GUIA}
                    >
                      Confirmar e liberar
                    </Button>
                  )}
                  <Linha alinhar="centro" espaco={1} quebra className="ml-auto">
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
                    {!guia.enviada && (
                      <>
                        {!confirmando && (
                          <BotaoDeArquivo
                            rotulo="Trocar"
                            rotuloAcessivel={`Trocar guia de ${guia.rotulo}`}
                            aceitar="application/pdf"
                            ocupado={pendente}
                            onEscolher={(novo) => onTrocar(guia.competencia, novo)}
                          />
                        )}
                        {confirmando ? (
                          <>
                            <Texto variante="nota" role="alert">
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
                              Confirmar remoção
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
                            className={cn(BOTAO_DA_GUIA, "text-destructive")}
                          >
                            Remover
                          </Button>
                        )}
                      </>
                    )}
                  </Linha>
                </Linha>
              </Caixa>
            );
          })}
        </Pilha>
      )}

      {avisoEm === "lista" && avisos}

      <Pilha espaco={3}>
        <Texto variante="nota" id={`${id}-leitura`}>
          O sistema lê o PDF; digite só se ele não conseguir.
        </Texto>
        <Linha alinhar="fim" espaco={3} quebra>
          <CampoDeTexto
            id={`${id}-competencia`}
            rotulo="Competência (opcional)"
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
            rotulo="Conta de negociação (opcional)"
            maxLength={40}
            aria-describedby={`${id}-leitura`}
            value={contaNegociacao}
            onChange={(evento) => onContaNegociacao(evento.target.value)}
            erro={erros.contaNegociacao}
            disabled={anexando}
            className="min-w-[10rem] flex-1 gap-1"
          />
        </Linha>
        <CampoDeArquivo
          id={`${id}-arquivo`}
          rotulo="PDF da guia"
          accept="application/pdf"
          dica="PDF até 4 MB"
          file={arquivo}
          onChange={onArquivo}
          erro={erros.arquivo}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled={pendente || undefined}
          onClick={onAnexar}
          className={BOTAO_DA_GUIA}
        >
          {anexando ? "Enviando..." : "Anexar guia"}
        </Button>
        {avisoEm === "anexo" && avisos}
      </Pilha>
    </Pilha>
  );
}
