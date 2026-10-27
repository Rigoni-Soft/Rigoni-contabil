import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AcoesDoFormulario } from "@/presentation/components/molecules/acoes-do-formulario.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { CampoResponsavel } from "@/presentation/components/molecules/campo-responsavel.component";
import {
  IndicadorDeLeitura,
  type EstadoDeLeitura,
} from "@/presentation/components/molecules/indicador-de-leitura.component";
import { LinhaDeContato } from "@/presentation/components/molecules/linha-de-contato.component";
import { LinhaDeParcelamento } from "@/presentation/components/molecules/linha-de-parcelamento.component";
import type { SeloDoParcelamento } from "@/presentation/components/molecules/selo-do-parcelamento.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";
import { cn } from "@/presentation/lib/utils";
import { DAS_STATUS_LABEL, DAS_STATUSES, type DasStatusValor } from "@/shared/kernel/das-status";
import {
  DOCUMENTO_OBRIGATORIO_STATUS_LABEL,
  DOCUMENTO_OBRIGATORIO_STATUSES,
  type DocumentoObrigatorioStatusValor,
} from "@/shared/kernel/documento-obrigatorio-status";
import { FORMA_ENVIO_LABEL, FORMAS_ENVIO, type FormaEnvioValor } from "@/shared/kernel/forma-envio";
import { SEM_RESPONSAVEL_LABEL } from "@/shared/kernel/papeis";
import { REGIME_LABEL } from "@/shared/kernel/regimes";

// Opções dos selects de status (valor/rótulo), montadas uma vez.
const opcoes = <T extends string>(valores: readonly T[], rotulos: Record<T, string>) =>
  valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
const OPCOES_FORMA_ENVIO = opcoes(FORMAS_ENVIO, FORMA_ENVIO_LABEL);
const OPCOES_DOCUMENTO = opcoes(DOCUMENTO_OBRIGATORIO_STATUSES, DOCUMENTO_OBRIGATORIO_STATUS_LABEL);
// "Enviado" é gravado só pelo sistema (#108): fica fora das opções escolhíveis.
const OPCOES_DAS = opcoes(
  DAS_STATUSES.filter((status) => status !== "enviado"),
  DAS_STATUS_LABEL,
);
const OPCAO_DAS_ENVIADO = { valor: "enviado", rotulo: DAS_STATUS_LABEL.enviado };

// Linha ainda não salva não tem status do mês: sem selo.
function seloDoParcelamento(p: ParcelamentoLinha): SeloDoParcelamento | undefined {
  if (!p.id) return undefined;
  if (p.quitado) return "quitado";
  return p.enviadoNoMes ? "enviado" : "pendente";
}

// Linha da lista de Parcelamentos: o que se edita (código, restantes, interno, PDF novo) e o que a
// tela só exibe (selo do mês, quitado, nome do PDF gravado, se há envio).
export type ParcelamentoLinha = {
  id?: string;
  codigo: string;
  parcelasRestantes: number;
  interno: boolean;
  quitado: boolean;
  temEnvio: boolean;
  enviadoNoMes: boolean;
  arquivoNome: string;
  arquivo?: File;
  // Primeira guia do mês (só no Parcelamento PGFN novo); sobe depois de salvar.
  guia?: File;
  // Dados lidos do PDF; o Container os resume numa linha (`acordoResumo`) para exibir.
  acordo?: {
    origem: "receita_federal" | "pgfn" | null;
    totalDeParcelas: number | null;
    valorDaParcelaCentavos: number | null;
    dataDeAdesao: string | null;
  };
  acordoResumo?: string;
};

// Estado da leitura do PDF numa linha nova (só exibição; quem lê é o Container, e o texto já vem pronto).
export type LeituraDaLinha = {
  estado: EstadoDeLeitura;
  texto: string;
  // O CNPJ lido do PDF é de outra empresa: alerta próprio, sem bloquear.
  cnpjDivergente?: boolean;
};

// View global não importa módulos (arquitetura.md §3.4) — o shape espelha
// EditarCadastroOperacionalFormValues (módulo clientes) por estrutura, não
// por import; o Container (dentro do módulo) garante a compatibilidade.
export type EditarCadastroOperacionalFormValues = {
  formaEnvio: FormaEnvioValor;
  contatos: { id?: string; nome: string; telefone: string; padrao: boolean }[];
  documentoObrigatorio: DocumentoObrigatorioStatusValor | null;
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null;
  parcelamentos: ParcelamentoLinha[];
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  // "" = Sem responsável.
  responsavelId: string;
};

// Responsável: só o Líder do SN edita (Select); os demais veem o nome.
type ResponsavelCampo = {
  editavel: boolean;
  nomeAtual: string;
  opcoes: { id: string; nome: string }[];
  // Lista carrega só quando o Select é aberto; enquanto isso (ou se falhar)
  // aparece como opção desabilitada.
  onAbrir: () => void;
  // "erro": aviso próprio com saída (tentar de novo), nunca só uma opção.
  estadoLista: "ok" | "carregando" | "erro";
  onTentarNovamente: () => void;
};

type CabecalhoCliente = { empresa: string; cnpj: string; regime: string };

type EditarCadastroOperacionalFormProps = {
  cabecalho: CabecalhoCliente;
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  responsavel: ResponsavelCampo;
  // Linhas atuais do formulário (acompanham a edição): resumo "Sim (n)", selo e nome do PDF.
  parcelamentos: ParcelamentoLinha[];
  // DAS já `enviado` pelo sistema: a opção aparece só pra exibir o valor atual.
  dasEnviadoPeloSistema: boolean;
  erroServidor?: string;
  sucesso?: boolean;
  // Até hidratar, os campos (não controlados) ainda não têm os valores: o HTML do servidor mostraria
  // placeholders no lugar do dado. Oculto sem sair do layout (e revelado após 3 s se a hidratação falhar), aparece já preenchido.
  oculto?: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionarContato: () => void;
  onRemoverContato: (indice: number) => void;
  parcelamentoCampos: { id: string }[];
  onAdicionarParcelamento: () => void;
  onRemoverParcelamento: (indice: number) => void;
  // Leitura do PDF por linha (chave = id do campo do useFieldArray). Com leitura em andamento o
  // Salvar fica desabilitado; o PDF escolhido (ou removido) volta ao Container para ser lido.
  leituras: Record<string, LeituraDaLinha>;
  onArquivoEscolhido: (indice: number, arquivo: File | undefined) => void;
  onLimpar: () => void;
  // Sem callback (uso em /clientes/[id]): "Cancelar" navega pro mesmo destino
  // do "Voltar" do topo. Com callback (uso inline na busca do dashboard):
  // já está em "/" — um <Link href="/"> não dispara navegação nem reseta nada,
  // então o Container que abriu o form inline fecha o painel diretamente.
  onCancelar?: () => void;
  // Cartão do documento contratual com "Abrir em nova aba" (só leitura); ausente = ator sem acesso.
  documentoContratual?: React.ReactNode;
  // Guias mensais de um Parcelamento PGFN já salvo: o Container monta a região (ela tem estado próprio).
  // `codigo` nomeia a região de cada Parcelamento para o leitor de tela.
  guiasDaParcela?: (parcelamentoId: string, codigo: string) => React.ReactNode;
};

export function EditarCadastroOperacionalForm({
  cabecalho,
  register,
  control,
  errors,
  onSubmit,
  pendente,
  readOnly,
  responsavel,
  parcelamentos,
  dasEnviadoPeloSistema,
  erroServidor,
  sucesso,
  oculto,
  contatos,
  onAdicionarContato,
  onRemoverContato,
  parcelamentoCampos,
  onAdicionarParcelamento,
  onRemoverParcelamento,
  leituras,
  onArquivoEscolhido,
  onLimpar,
  onCancelar,
  documentoContratual,
  guiasDaParcela,
}: EditarCadastroOperacionalFormProps) {
  return (
    <Pilha
      espaco="formulario"
      como="form"
      onSubmit={onSubmit}
      className={cn(
        "rc-guilloche-frame rounded-lg border border-border bg-card p-5 shadow-sm",
        oculto && "rc-oculto-ate-hidratar",
      )}
    >
      {!readOnly && <NotaDeObrigatorio />}

      {/* Identidade do Cliente + o documento dele: um grupo (proximidade), separado do restante. */}
      <Pilha espaco={4}>
        <Grade colunas="1>2>cabecalho" espaco={4}>
          <Pilha espaco={1}>
            <Label htmlFor="cabecalho-empresa">Empresa</Label>
            <Input
              id="cabecalho-empresa"
              value={cabecalho.empresa}
              title={cabecalho.empresa}
              disabled
              readOnly
            />
          </Pilha>
          <Pilha espaco={1}>
            <Label htmlFor="cabecalho-cnpj">CNPJ</Label>
            <Input id="cabecalho-cnpj" value={cabecalho.cnpj} disabled readOnly />
          </Pilha>
          <Pilha espaco={1}>
            <Label htmlFor="cabecalho-regime">Regime</Label>
            <Input
              id="cabecalho-regime"
              value={REGIME_LABEL[cabecalho.regime] ?? cabecalho.regime}
              disabled
              readOnly
            />
          </Pilha>
          <CampoResponsavel
            editavel={responsavel.editavel}
            nomeAtual={responsavel.nomeAtual}
            opcoes={responsavel.opcoes}
            semResponsavel={SEM_RESPONSAVEL_LABEL}
            estadoLista={responsavel.estadoLista}
            onAbrir={responsavel.onAbrir}
            onTentarNovamente={responsavel.onTentarNovamente}
            select={register("responsavelId")}
            desabilitado={pendente}
          />
        </Grade>

        {documentoContratual}
      </Pilha>

      <Grade colunas="1>2>4" como="fieldset" disabled={readOnly || pendente} className="gap-4">
        <CampoDeOpcoes
          id="formaEnvio"
          rotulo="Forma de envio"
          opcoes={OPCOES_FORMA_ENVIO}
          className="gap-1"
          {...register("formaEnvio")}
        />
        <CampoDeOpcoes
          id="documentoObrigatorio"
          rotulo="Documento recebido"
          opcoes={OPCOES_DOCUMENTO}
          placeholder="Não definido"
          className="gap-1"
          {...register("documentoObrigatorio")}
        />
        <CampoDeOpcoes
          id="dasStatus"
          rotulo="DAS"
          opcoes={dasEnviadoPeloSistema ? [...OPCOES_DAS, OPCAO_DAS_ENVIADO] : OPCOES_DAS}
          placeholder="Não definido"
          className="gap-1"
          // "Enviado" é do sistema (#108): nem o Admin troca depois que o envio foi concluído. Fica
          // esmaecido, como todo campo desativado: o esmaecimento é o sinal de não editável (DESIGN.md).
          disabled={dasEnviadoPeloSistema}
          ajuda={dasEnviadoPeloSistema ? "Definido pelo sistema." : undefined}
          {...register("dasStatus")}
        />
        <CampoDeTexto
          id="dataEnvioDas"
          rotulo="Data de envio"
          type="date"
          className="gap-1"
          readOnly
          // Só o sistema define a data: desativada, com o esmaecimento de qualquer campo travado.
          disabled
          ajuda="Preenchida pelo sistema quando o DAS é enviado."
          {...register("dataEnvioDas")}
        />

        <Pilha espaco={1} className="lg:col-span-2">
          <Label>Atividade do mês</Label>
          <Linha espaco={4} quebra className="text-sm">
            <CaixaDeMarcacao rotulo="Indústria" {...register("atividadeMes.industria")} />
            <CaixaDeMarcacao rotulo="Comércio" {...register("atividadeMes.comercio")} />
            <CaixaDeMarcacao rotulo="Serviço" {...register("atividadeMes.servico")} />
          </Linha>
        </Pilha>

        <Pilha espaco={3} className="sm:col-span-2 lg:col-span-4">
          <Linha alinhar="centro" justificar="entre" espaco={4}>
            <Label className="block">Contatos</Label>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={onAdicionarContato}>
                <Plus className="size-4" aria-hidden="true" />
                Adicionar contato
              </Button>
            )}
          </Linha>
          {contatos.map((campo, indice) => (
            <Controller
              key={campo.id}
              control={control}
              name={`contatos.${indice}.telefone`}
              render={({ field: { onChange, onBlur, value, name } }) => (
                <LinhaDeContato
                  indice={indice}
                  somenteLeitura={readOnly}
                  nome={register(`contatos.${indice}.nome`)}
                  // Sem `ref` (Input não usa forwardRef): só perde o foco automático em erro.
                  telefone={{
                    name,
                    value,
                    onBlur,
                    onChange: (evento) => onChange(formatarTelefone(evento.target.value)),
                  }}
                  padrao={register(`contatos.${indice}.padrao`)}
                  erroNome={errors.contatos?.[indice]?.nome?.message}
                  erroTelefone={errors.contatos?.[indice]?.telefone?.message}
                  onRemover={readOnly ? undefined : () => onRemoverContato(indice)}
                />
              )}
            />
          ))}
          {errors.contatos && typeof errors.contatos.message === "string" && (
            <FieldError>{errors.contatos.message}</FieldError>
          )}
        </Pilha>

        <Pilha espaco={3} className="sm:col-span-2 lg:col-span-4">
          <Linha alinhar="centro" justificar="entre" espaco={4}>
            <Label className="block">Parcelamentos</Label>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={onAdicionarParcelamento}>
                <Plus className="size-4" aria-hidden="true" />
                Adicionar parcelamento
              </Button>
            )}
          </Linha>
          {/* Resumo derivado: só conta o que já foi salvo (linha com id), nunca o que está sendo digitado. */}
          <Texto variante="corpo" role="status">
            Tem parcelamento:{" "}
            {parcelamentos.some((p) => p.id)
              ? `Sim (${parcelamentos.filter((p) => p.id).length})`
              : "Não"}
          </Texto>
          {parcelamentos.map((atual, indice) => {
            const erros = errors.parcelamentos?.[indice];
            const leitura = leituras[parcelamentoCampos[indice].id];
            // O estado da leitura descreve os campos que ela preencheu (sugestão a conferir).
            const descricaoDaLeitura = leitura
              ? { "aria-describedby": `parcelamentos.${indice}.leitura` }
              : undefined;
            return (
              <LinhaDeParcelamento
                key={parcelamentoCampos[indice].id}
                somenteLeitura={readOnly}
                indice={indice}
                codigo={{ ...register(`parcelamentos.${indice}.codigo`), ...descricaoDaLeitura }}
                parcelas={{
                  ...register(`parcelamentos.${indice}.parcelasRestantes`, { valueAsNumber: true }),
                  ...descricaoDaLeitura,
                }}
                interno={register(`parcelamentos.${indice}.interno`)}
                erroCodigo={erros?.codigo?.message}
                erroParcelas={erros?.parcelasRestantes?.message}
                selo={seloDoParcelamento(atual)}
                // Quitado e PGFN cadastrado não se editam (o PGFN só ganha guias): o servidor ignora o que vier.
                desabilitado={
                  atual.quitado ||
                  (Boolean(atual.id) && atual.acordo?.origem === "pgfn") ||
                  leitura?.estado === "lendo"
                }
                onRemover={
                  readOnly || atual.temEnvio ? undefined : () => onRemoverParcelamento(indice)
                }
                bloqueadoPorEnvio={!readOnly && atual.temEnvio}
                guias={
                  !readOnly && atual.id && atual.acordo?.origem === "pgfn" && !atual.quitado
                    ? guiasDaParcela?.(atual.id, atual.codigo)
                    : undefined
                }
                arquivo={
                  atual.id ? (
                    <>
                      <Texto variante="nota" className="[overflow-wrap:anywhere]">
                        PDF anexado: {atual.arquivoNome}
                      </Texto>
                      {atual.acordoResumo && <Texto variante="nota">{atual.acordoResumo}</Texto>}
                    </>
                  ) : (
                    <>
                      <Controller
                        control={control}
                        name={`parcelamentos.${indice}.arquivo`}
                        render={({ field: { onChange, onBlur, value, name } }) => (
                          <CampoDeArquivo
                            id={`parcelamentos.${indice}.arquivo`}
                            rotulo="PDF do acordo"
                            name={name}
                            accept="application/pdf"
                            dica="PDF até 4 MB"
                            file={value}
                            onChange={(arquivo) => {
                              onChange(arquivo);
                              onArquivoEscolhido(indice, arquivo);
                            }}
                            onBlur={onBlur}
                            erro={erros?.arquivo?.message}
                          />
                        )}
                      />
                      <IndicadorDeLeitura
                        id={`parcelamentos.${indice}.leitura`}
                        estado={leitura?.estado}
                        texto={leitura?.texto}
                      />
                      {leitura?.cnpjDivergente && (
                        <FieldError>
                          O CNPJ do PDF é diferente do CNPJ do Cliente. Confira se anexou o PDF
                          certo.
                        </FieldError>
                      )}
                      {atual.acordoResumo && <Texto variante="nota">{atual.acordoResumo}</Texto>}
                      {atual.acordo?.origem === "pgfn" && (
                        <Controller
                          control={control}
                          name={`parcelamentos.${indice}.guia`}
                          render={({ field: { onChange, onBlur, value, name } }) => (
                            <CampoDeArquivo
                              id={`parcelamentos.${indice}.guia`}
                              rotulo="Guia do mês (opcional)"
                              name={name}
                              accept="application/pdf"
                              dica="PDF até 4 MB"
                              compacto
                              file={value}
                              onChange={onChange}
                              onBlur={onBlur}
                              erro={erros?.guia?.message}
                            />
                          )}
                        />
                      )}
                    </>
                  )
                }
              />
            );
          })}
          {/* Erro da lista (ex.: soma dos PDFs): o resolver o entrega em `message` ou em `root`. */}
          {(errors.parcelamentos?.root?.message ?? errors.parcelamentos?.message) && (
            <FieldError>
              {errors.parcelamentos?.root?.message ?? errors.parcelamentos?.message}
            </FieldError>
          )}
          <Texto variante="nota">
            Parcelamentos da PGFN ficam fora do envio automático: o envio da guia é manual.
          </Texto>
        </Pilha>

        <Pilha espaco={1} className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="observacoesGerais">Observações gerais</Label>
          <Textarea id="observacoesGerais" {...register("observacoesGerais")} rows={3} />
        </Pilha>

        {!readOnly && (
          <AcoesDoFormulario
            pendente={pendente}
            motivoDoBloqueio={
              Object.values(leituras).some((l) => l.estado === "lendo")
                ? "Aguarde a leitura do PDF para salvar."
                : undefined
            }
            onLimpar={onLimpar}
            onCancelar={onCancelar}
          />
        )}
      </Grade>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso && <AvisoDeStatus tipo="sucesso" texto="Cadastro operacional atualizado." />}
    </Pilha>
  );
}
