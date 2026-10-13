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
import { LinhaDeAlteracao } from "@/presentation/components/molecules/linha-de-alteracao.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { REGIME_LABEL, REGIMES } from "@/shared/kernel/regimes";

// PDF ou DOCX (ponto 2 do feedback manual, 2026-09-29) — dica do navegador;
// a validação de verdade fica no schema Zod (não confia só no `accept`).
const ACCEPT_DOCUMENTO =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const OPCOES_REGIME = REGIMES.map((valor) => ({ valor, rotulo: REGIME_LABEL[valor] }));

export type CriarClienteFormValues = {
  empresa: string;
  cnpj: string;
  regime: (typeof REGIMES)[number];
  contratoSocial?: File;
  alteracoesContratuais: { data: string; arquivo: File }[];
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
  // Chamado ao clicar "Cadastrar outro" na tela de confirmação — mesmo padrão do
  // formulário de usuário (#30/#32).
  onCadastrarNovo: () => void;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  alteracoes: { id: string }[];
  onAdicionarAlteracao: () => void;
  onRemoverAlteracao: (indice: number) => void;
  // CNPJ→autopreenchimento de Empresa/Regime via API pública (ponto 4 do
  // feedback manual, 2026-09-29) — a consulta em si mora no Container.
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
  alteracoes,
  onAdicionarAlteracao,
  onRemoverAlteracao,
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

      {/* CNPJ primeiro (ponto 4 do feedback manual): autopreenche Empresa/Regime
          ao perder o foco, antes do resto do formulário ser preenchido à mão.
          3 colunas aproveita a largura do formulário (80% da tela, #36) em vez
          de empilhar os 3 campos de identificação numa coluna só. */}
      <Grade colunas="1>3" espaco={5}>
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
      </Grade>

      {/* Seção de documentos separada da identificação do Cliente — mais espaço
          acima do heading que abaixo, mesma cadência de arquitetura.md/DESIGN.md. */}
      <Pilha espaco="formulario" className="mt-2 border-t border-border pt-6">
        <Texto variante="rotuloDeSecao" como="h2">
          Documentos
        </Texto>

        <Controller
          control={control}
          name="contratoSocial"
          render={({ field: { onChange, onBlur, name, value } }) => (
            <CampoDeArquivo
              id="contratoSocial"
              rotulo="Contrato social"
              name={name}
              accept={ACCEPT_DOCUMENTO}
              file={value}
              onBlur={onBlur}
              erro={errors.contratoSocial?.message}
              onChange={onChange}
            />
          )}
        />

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
              data={register(`alteracoesContratuais.${indice}.data` as const)}
              erroData={errors.alteracoesContratuais?.[indice]?.data?.message}
              erroArquivo={errors.alteracoesContratuais?.[indice]?.arquivo?.message}
              onRemover={() => onRemoverAlteracao(indice)}
              campoArquivo={(id) => (
                <Controller
                  control={control}
                  name={`alteracoesContratuais.${indice}.arquivo` as const}
                  render={({ field: { onChange, onBlur, name, value } }) => (
                    <FileInput
                      id={id}
                      name={name}
                      accept={ACCEPT_DOCUMENTO}
                      file={value}
                      onBlur={onBlur}
                      aria-invalid={!!errors.alteracoesContratuais?.[indice]?.arquivo}
                      onChange={onChange}
                    />
                  )}
                />
              )}
            />
          ))}
        </Caixa>
      </Pilha>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}

      <BotaoDeEnvio pendente={pendente} rotulo="Cadastrar" rotuloPendente="Cadastrando…" />
    </Pilha>
  );
}
