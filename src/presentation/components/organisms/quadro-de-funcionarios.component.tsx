import { Eye, Pencil, Plus } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";
import { cn } from "@/presentation/lib/utils";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

export type EmpregadoDoQuadro = {
  id: string;
  nome: string;
  // Abre o empregado em edição (o Editar do quadro).
  href: string;
  // Tela própria do Cartão de ponto dele.
  cartaoHref: string;
  // Desligado da empresa: sem Cartão de ponto na lista (não há cartão a lançar).
  ativo: boolean;
  selecionado: boolean;
  // Selos curtos: "desligado", "sem movimento", "comissionado".
  selos: string[];
};

export type EmpregadoEmEdicao = {
  id: string;
  nome: string;
  comissionado: boolean;
  // Falso = desligado da empresa.
  ativo: boolean;
  semMovimento: boolean;
};

// O foco vai para este elemento depois de desligar ou readmitir (a tela, a View, só o expõe).
export const ID_DO_RESULTADO = "resultado-do-quadro";

type Props = {
  empregados: EmpregadoDoQuadro[];
  emEdicao?: EmpregadoEmEdicao;
  padraoComissionados: boolean;
  rotuloMes: string;
  editavel: boolean;
  pendente: boolean;
  erro?: string;
  // Erro do cadastro: aparece colado ao formulário "Novo empregado" e ligado ao campo Nome.
  erroDoNovo?: string;
  // Muda quando o cadastro dá certo: o formulário é remontado e o que foi digitado some.
  chaveDoNovo: number;
  // Com um empregado em edição o formulário "Novo empregado" some: este link o traz de volta.
  novoHref: string;
  // O resultado de desligar ou readmitir (o Editar fecha): fica numa região viva que recebe o foco, para o
  // teclado e o leitor de tela não se perderem quando o botão clicado some.
  resultado?: string;
  onCadastrar: (campos: FormData) => void;
  onCorrigir: (campos: FormData) => void;
  onAtivo: (ativo: boolean) => void;
  onSemMovimento: (sem: boolean) => void;
  onPadrao: (comissionados: boolean) => void;
};

// Células da grade de 4 colunas do formulário: o nome (2 colunas) e a marca "comissionado".
// A Jornada não se cadastra: a Totalização a deduz da convenção e da legislação.
function CamposDoEmpregado({
  prefixo,
  nome,
  comissionado,
  erro,
}: {
  prefixo: string;
  nome: string;
  comissionado: boolean;
  erro?: string;
}) {
  return (
    <>
      <CampoDeTexto
        id={`${prefixo}-nome`}
        rotulo="Nome"
        name="nome"
        defaultValue={nome}
        obrigatorio
        required
        maxLength={TEXTO_CURTO_MAXIMO}
        className="gap-1 sm:col-span-2"
        aria-describedby={erro ? `erro-do-${prefixo}-empregado` : undefined}
        aria-invalid={!!erro}
      />
      <Caixa className="flex min-h-9 items-center sm:col-span-2 sm:self-end pointer-coarse:min-h-11">
        <CaixaDeMarcacao rotulo="Comissionado" name="comissionado" defaultChecked={comissionado} />
      </Caixa>
    </>
  );
}

// O Quadro de funcionários do Cliente: nome e a marca "comissionado"; cada empregado tem o Cartão de ponto à parte.
export function QuadroDeFuncionarios({
  empregados,
  emEdicao,
  padraoComissionados,
  rotuloMes,
  editavel,
  pendente,
  erro,
  erroDoNovo,
  chaveDoNovo,
  novoHref,
  resultado,
  onCadastrar,
  onCorrigir,
  onAtivo,
  onSemMovimento,
  onPadrao,
}: Props) {
  return (
    <Pilha
      como="section"
      espaco={6}
      aria-label="Quadro de funcionários"
      className={MOLDURA_DO_CARTAO}
    >
      {editavel && <NotaDeObrigatorio />}
      <Linha alinhar="centro" justificar="entre" espaco={4}>
        <Texto como="h2" variante="subtitulo">
          Quadro de funcionários
        </Texto>
        {editavel && emEdicao && (
          <LinkDeAcao href={novoHref} variant="ghost" className="h-8 px-3">
            <Plus className="size-4" aria-hidden="true" />
            Novo empregado
          </LinkDeAcao>
        )}
      </Linha>
      {resultado && (
        <Caixa id={ID_DO_RESULTADO} tabIndex={-1} className="outline-none">
          <AvisoDeStatus tipo="sucesso" legivel texto={resultado} />
        </Caixa>
      )}
      {erro && !emEdicao && <AvisoDeStatus tipo="erro" legivel texto={erro} />}

      {editavel && (
        <CaixaDeMarcacao
          rotulo="Os empregados deste cliente são comissionados (padrão para os novos)"
          checked={padraoComissionados}
          disabled={pendente}
          onChange={(e) => onPadrao(e.target.checked)}
        />
      )}

      {empregados.length === 0 ? (
        <Texto variante="apoio">
          Nenhum empregado cadastrado neste cliente.{editavel && " Cadastre o primeiro abaixo."}
        </Texto>
      ) : (
        // Mesma lista com divisores da lista de clientes dos cards do dashboard (ListaDeClientes).
        <ListaComDivisores>
          {empregados.map((e) => (
            <Caixa como="li" key={e.id} className={cn(e.selecionado && "bg-accent/50")}>
              <Linha alinhar="centro" justificar="entre" espaco={3} quebra className="px-4 py-3">
                <Texto variante="destaque" className="min-w-0 [overflow-wrap:anywhere] break-words">
                  {e.nome}
                </Texto>
                <Linha alinhar="centro" espaco={2} className="ml-auto shrink-0">
                  <LinkDeAcao
                    href={e.href}
                    variant="outline"
                    size="icon"
                    atual={e.selecionado}
                    aria-label={`${editavel ? "Editar" : "Ver"} ${e.nome}`}
                  >
                    {editavel ? (
                      <Pencil className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </LinkDeAcao>
                  {/* Ação principal da linha: cheio na cor primária; o lápis fica neutro, só contorno.
                      Empregado desligado não tem cartão a lançar. */}
                  {e.ativo && (
                    <LinkDeAcao
                      href={e.cartaoHref}
                      variant="default"
                      aria-label={`Cartão de ponto de ${e.nome}`}
                    >
                      Cartão de ponto
                    </LinkDeAcao>
                  )}
                </Linha>
              </Linha>
              {e.selos.length > 0 && (
                <Caixa className="px-4 pb-3">
                  <Texto variante="apoio">{e.selos.join(" · ")}</Texto>
                </Caixa>
              )}
            </Caixa>
          ))}
        </ListaComDivisores>
      )}

      {editavel && !emEdicao && (
        <Caixa
          como="form"
          key={chaveDoNovo}
          aria-label="Novo empregado"
          onSubmit={(e) => {
            e.preventDefault();
            onCadastrar(new FormData(e.currentTarget));
          }}
        >
          <Pilha espaco="formulario">
            <Texto como="h3" variante="rotuloDeSecao">
              Novo empregado
            </Texto>
            <Grade colunas="1>2>4" espaco={4}>
              <CamposDoEmpregado
                prefixo="novo"
                nome=""
                comissionado={padraoComissionados}
                erro={erroDoNovo}
              />
            </Grade>
            {erroDoNovo && (
              <Caixa id="erro-do-novo-empregado">
                <AvisoDeStatus tipo="erro" legivel texto={erroDoNovo} />
              </Caixa>
            )}
            <Button type="submit" disabled={pendente} className="self-start">
              Cadastrar empregado
            </Button>
          </Pilha>
        </Caixa>
      )}

      {emEdicao && (
        <Pilha espaco={3}>
          <Pilha espaco={1} className="items-center text-center">
            <Texto como="h3" variante="rotuloDeSecao">
              Editar
            </Texto>
            <Texto variante="destaque" className="[overflow-wrap:anywhere] break-words">
              {emEdicao.nome}
            </Texto>
          </Pilha>
          <Caixa
            como="form"
            key={`${emEdicao.id}|${emEdicao.nome}|${emEdicao.comissionado}`}
            aria-label="Corrigir empregado"
            onSubmit={(e) => {
              e.preventDefault();
              onCorrigir(new FormData(e.currentTarget));
            }}
          >
            <Pilha espaco="formulario">
              <Grade
                colunas="1>2>4"
                como="fieldset"
                disabled={!editavel || !emEdicao.ativo}
                espaco={4}
              >
                <CamposDoEmpregado
                  prefixo="corrigir"
                  nome={emEdicao.nome}
                  comissionado={emEdicao.comissionado}
                  erro={emEdicao.ativo ? erro : undefined}
                />
              </Grade>
              {erro && (
                <Caixa id="erro-do-corrigir-empregado">
                  <AvisoDeStatus tipo="erro" legivel texto={erro} />
                </Caixa>
              )}
              {editavel && emEdicao.ativo && (
                <CaixaDeMarcacao
                  rotulo={`Sem movimento em ${rotuloMes}`}
                  checked={emEdicao.semMovimento}
                  disabled={pendente}
                  onChange={(e) => onSemMovimento(e.target.checked)}
                />
              )}
              {editavel && !emEdicao.ativo && (
                <Texto variante="apoio">
                  Empregado desligado da empresa: não há o que editar nem cartão a lançar. Só é
                  possível readmiti-lo.
                </Texto>
              )}
              {editavel && (
                <Linha espaco={3} quebra alinhar="centro">
                  {/* Desligado não tem nada a salvar: o Salvar só existe para quem está na empresa. */}
                  {emEdicao.ativo && (
                    <Button type="submit" disabled={pendente}>
                      Salvar empregado
                    </Button>
                  )}
                  {/* Desligar e readmitir gravam na hora e fecham o Editar. Vermelho: desligar é a ação de atenção. */}
                  <Button
                    type="button"
                    variant={emEdicao.ativo ? "destructive" : "default"}
                    disabled={pendente}
                    onClick={() => onAtivo(!emEdicao.ativo)}
                  >
                    {emEdicao.ativo ? "Desligar da empresa" : "Readmitir empregado"}
                  </Button>
                  {/* Cancelar descarta a edição: volta ao formulário "Novo empregado" limpo. */}
                  <LinkDeAcao href={novoHref} variant="outline">
                    Cancelar
                  </LinkDeAcao>
                </Linha>
              )}
            </Pilha>
          </Caixa>
        </Pilha>
      )}
    </Pilha>
  );
}
