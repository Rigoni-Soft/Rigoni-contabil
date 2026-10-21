import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { BotaoDeEnvio } from "@/presentation/components/atoms/botao-de-envio.component";
import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { FileInput } from "@/presentation/components/atoms/file-input.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { ConfirmacaoDeCadastro } from "@/presentation/components/molecules/confirmacao-de-cadastro.component";
import {
  idErroDoCampo,
  LinhaDeAlteracao,
} from "@/presentation/components/molecules/linha-de-alteracao.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { ACCEPT_DOCUMENTO } from "@/presentation/lib/accept-documento";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { REGIME_LABEL, REGIMES } from "@/shared/kernel/regimes";

const OPCOES_REGIME = REGIMES.map((valor) => ({ valor, rotulo: REGIME_LABEL[valor] }));

export type CriarClienteFormValues = {
  empresa: string;
  cnpj: string;
  regime: (typeof REGIMES)[number];
  email?: string;
  contratoSocial?: File;
  alteracoesContratuais: { numero: number; data: string; arquivo: File }[];
};

type ClienteCriado = { empresa: string; cnpj: string };

type CriarClienteFormProps = {
  register: UseFormRegister<CriarClienteFormValues>;
  control: Control<CriarClienteFormValues>;
  errors: FieldErrors<CriarClienteFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
  criado?: ClienteCriado;
  // Chamado ao clicar "Cadastrar outro" na tela de confirmação — mesmo padrão do formulário de usuário.
  onCadastrarNovo: () => void;
  // "Limpar" esvazia o formulário todo (campos, alterações, avisos e erros). Com algo preenchido, pede
  // confirmação antes: `onPedirLimpar` abre o pedido, `onLimpar` confirma e `onCancelarLimpar` desiste.
  confirmandoLimpar: boolean;
  onPedirLimpar: () => void;
  onLimpar: () => void;
  onCancelarLimpar: () => void;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  alteracoes: { id: string }[];
  onAdicionarAlteracao: () => void;
  onRemoverAlteracao: (indice: number) => void;
  // Escolheu/limpou o arquivo da alteração: o Container sugere o nº pelo prefixo do nome.
  onArquivoDaAlteracao: (indice: number, arquivo: File | undefined) => void;
  // CNPJ→autopreenchimento de Empresa/Regime via API pública — a consulta em si mora no Container.
  onCnpjBlur: (cnpjMascarado: string) => void;
  // Avisos da consulta de CNPJ (não são erro de validação — o Zod não sabe
  // se um CNPJ bem formado existe de verdade — por isso ficam fora de `errors`).
  avisoCnpj?: string;
  avisoRegime?: string;
  onRegimeChange: () => void;
  onEmpresaChange: () => void;
};

export function CriarClienteForm({
  register,
  control,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  criado,
  onCadastrarNovo,
  confirmandoLimpar,
  onPedirLimpar,
  onLimpar,
  onCancelarLimpar,
  alteracoes,
  onAdicionarAlteracao,
  onRemoverAlteracao,
  onArquivoDaAlteracao,
  onCnpjBlur,
  avisoCnpj,
  avisoRegime,
  onRegimeChange,
  onEmpresaChange,
}: CriarClienteFormProps) {
  if (criado) {
    return (
      <ConfirmacaoDeCadastro
        largura="sm"
        onCadastrarNovo={onCadastrarNovo}
        mensagem={
          <>
            Cliente{" "}
            <Texto variante="enfase" como="strong">
              {criado.empresa}
            </Texto>{" "}
            (CNPJ {criado.cnpj}) cadastrado.
          </>
        }
      />
    );
  }

  return (
    <Pilha espaco="formulario" como="form" onSubmit={onSubmit} noValidate>
      <NotaDeObrigatorio />

      {/* CNPJ primeiro: autopreenche Empresa/Regime ao perder o foco, antes do resto do formulário ser
          preenchido à mão. Em tela larga, 4 colunas: CNPJ, Empresa (dobro), Regime e, na linha de baixo, o
          E-mail (opcional, destino do envio por e-mail); em tela média, 2 colunas; no celular, 1. */}
      <Grade colunas="1>2>4" espaco={4}>
        <Controller
          control={control}
          name="cnpj"
          render={({ field: { onChange, onBlur, value, name } }) => (
            <CampoDeTexto
              id="cnpj"
              rotulo="CNPJ"
              obrigatorio
              name={name}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              maxLength={18}
              value={value ?? ""}
              erro={errors.cnpj?.message}
              aviso={avisoCnpj}
              onChange={(evento) => onChange(formatarCnpj(evento.target.value))}
              onBlur={(evento) => {
                onBlur();
                onCnpjBlur(evento.target.value);
              }}
            />
          )}
        />
        <CampoDeTexto
          id="empresa"
          rotulo="Empresa"
          obrigatorio
          className="lg:col-span-2"
          erro={errors.empresa?.message}
          {...register("empresa", { onChange: onEmpresaChange })}
        />
        <CampoDeOpcoes
          id="regime"
          rotulo="Regime"
          obrigatorio
          opcoes={OPCOES_REGIME}
          placeholder="Selecione"
          placeholderDesabilitado
          defaultValue=""
          erro={errors.regime?.message}
          aviso={avisoRegime}
          {...register("regime", { onChange: onRegimeChange })}
        />
        <Pilha espaco={1} className="lg:col-span-2">
          <CampoDeTexto
            id="email"
            rotulo="E-mail do Cliente"
            type="email"
            autoComplete="off"
            maxLength={254}
            aria-describedby="email-ajuda"
            erro={errors.email?.message}
            {...register("email")}
          />
          <Texto variante="nota" id="email-ajuda">
            Recebe guias e lembretes quando a forma de envio inclui e-mail.
          </Texto>
        </Pilha>
      </Grade>

      {/* Seção de documentos separada da identificação do Cliente — mais espaço
          acima do heading que abaixo, mesma cadência de arquitetura.md/DESIGN.md. */}
      <Pilha espaco="formulario" className="mt-2 border-t border-border pt-6">
        <Texto variante="rotuloDeSecao" como="h2">
          Documentos
        </Texto>
        {/* Erro do conjunto (soma dos arquivos acima do limite): do bloco, não de um arquivo só. */}
        {errors.root && <FieldError>{errors.root.message}</FieldError>}

        <Caixa className="sm:w-1/2 lg:w-1/4">
          <Controller
            control={control}
            name="contratoSocial"
            render={({ field: { onChange, onBlur, name, value } }) => (
              <CampoDeArquivo
                id="contratoSocial"
                rotulo="Contrato social"
                name={name}
                accept={ACCEPT_DOCUMENTO}
                dica="PDF ou DOCX"
                file={value}
                onBlur={onBlur}
                erro={errors.contratoSocial?.message}
                onChange={onChange}
              />
            )}
          />
        </Caixa>

        <Caixa className="flex flex-col gap-3">
          <Linha alinhar="centro" justificar="entre">
            <Label>Alterações contratuais</Label>
            <Button type="button" variant="outline" size="sm" onClick={onAdicionarAlteracao}>
              <Plus aria-hidden="true" />
              Adicionar
            </Button>
          </Linha>

          {alteracoes.map((alteracao, indice) => (
            <LinhaDeAlteracao
              key={alteracao.id}
              indice={indice}
              numero={register(`alteracoesContratuais.${indice}.numero` as const, {
                valueAsNumber: true,
              })}
              erroNumero={errors.alteracoesContratuais?.[indice]?.numero?.message}
              data={register(`alteracoesContratuais.${indice}.data` as const)}
              erroData={errors.alteracoesContratuais?.[indice]?.data?.message}
              erroArquivo={errors.alteracoesContratuais?.[indice]?.arquivo?.message}
              onRemover={() => onRemoverAlteracao(indice)}
              arquivo={
                <Controller
                  control={control}
                  name={`alteracoesContratuais.${indice}.arquivo` as const}
                  render={({ field: { onChange, onBlur, name, value } }) => (
                    <FileInput
                      id={`alteracoesContratuais.${indice}.arquivo`}
                      name={name}
                      accept={ACCEPT_DOCUMENTO}
                      dica="PDF ou DOCX"
                      file={value}
                      onBlur={onBlur}
                      aria-invalid={!!errors.alteracoesContratuais?.[indice]?.arquivo}
                      aria-describedby={
                        errors.alteracoesContratuais?.[indice]?.arquivo
                          ? idErroDoCampo(`alteracoesContratuais.${indice}.arquivo`)
                          : undefined
                      }
                      onChange={(arquivo) => {
                        onChange(arquivo);
                        onArquivoDaAlteracao(indice, arquivo);
                      }}
                    />
                  )}
                />
              }
            />
          ))}
        </Caixa>
      </Pilha>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}

      {/* Botões do tamanho do rótulo, à direita: esticados na largura toda viram uma faixa. */}
      <Linha justificar="fim" alinhar="centro" espaco={2} quebra>
        {confirmandoLimpar ? (
          <>
            <Texto variante="apoio" como="p" role="alert" className="mr-auto">
              Limpar o formulário? O que foi preenchido e os arquivos escolhidos serão descartados.
            </Texto>
            {/* Foco inicial no "Voltar": o padrão seguro, não o destrutivo. */}
            <Button type="button" variant="outline" onClick={onCancelarLimpar} autoFocus>
              Voltar
            </Button>
            <Button type="button" variant="destructive" onClick={onLimpar}>
              Limpar tudo
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="destructive" onClick={onPedirLimpar} disabled={pendente}>
              Limpar
            </Button>
            <BotaoDeEnvio pendente={pendente} rotulo="Cadastrar" rotuloPendente="Cadastrando…" />
          </>
        )}
      </Linha>
    </Pilha>
  );
}
