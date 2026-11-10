import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { cn } from "@/presentation/lib/utils";

import { CabecalhoDoCadastro, type CabecalhoCliente } from "./cabecalho-do-cadastro.component";

type CartaoDoCadastroProps = {
  cabecalho: CabecalhoCliente;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  // Até hidratar, os campos (não controlados) ainda não têm os valores: oculto sem sair do layout.
  oculto?: boolean;
  // O mês do acompanhamento: o cabeçalho do cartão, logo depois da nota de obrigatórios.
  mesDoAcompanhamento?: React.ReactNode;
  // Cartão do documento contratual com "Abrir em nova aba" (só leitura); ausente = ator sem acesso.
  documentoContratual?: React.ReactNode;
  // O Responsável do Setor: um campo do cabeçalho, na mesma coluna em todo Setor.
  responsavel?: React.ReactNode;
  // Os serviços do mês: uma seção do cartão, depois do cabeçalho.
  acompanhamento?: React.ReactNode;
  // Botões do formulário; ausente quando só se lê.
  acoes?: React.ReactNode;
  erroServidor?: string;
  // O aviso de sucesso já montado, ou ausente.
  sucesso?: React.ReactNode;
  // Os campos do Setor: itens da grade de 4 colunas do fieldset.
  children: React.ReactNode;
};

// O cartão do cadastro operacional de qualquer Setor: moldura guilhochê, nota de obrigatórios, mês,
// cabeçalho com o Responsável, acompanhamento, os campos do Setor, as ações e o resultado. Só os campos
// do meio mudam de um Setor para outro.
export function CartaoDoCadastro({
  cabecalho,
  onSubmit,
  pendente,
  readOnly,
  oculto,
  mesDoAcompanhamento,
  documentoContratual,
  responsavel,
  acompanhamento,
  acoes,
  erroServidor,
  sucesso,
  children,
}: CartaoDoCadastroProps) {
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

      {mesDoAcompanhamento}

      <CabecalhoDoCadastro cabecalho={cabecalho} documentoContratual={documentoContratual}>
        {responsavel && <Caixa className="lg:col-start-4">{responsavel}</Caixa>}
      </CabecalhoDoCadastro>

      {acompanhamento}

      <Grade colunas="1>2>4" como="fieldset" disabled={readOnly || pendente} className="gap-4">
        {children}
        {!readOnly && acoes}
      </Grade>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso}
    </Pilha>
  );
}
