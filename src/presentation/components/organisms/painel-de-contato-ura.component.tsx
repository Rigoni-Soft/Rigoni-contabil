import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { TituloDoGrupo } from "@/presentation/components/atoms/titulo-de-grupo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { BOTAO_OCUPADO } from "@/presentation/lib/botao-ocupado";

type PainelDeContatoUraProps = {
  // fechado: só o botão; cliente: a Recepção digita e confere o Cliente; contato: nome e e-mail.
  etapa: "fechado" | "cliente" | "contato";
  // O contato já foi cadastrado (ou já existia): fica o aviso e some o botão.
  concluido: boolean;
  // O WhatsApp do atendimento, já formatado: é o do contato e não se edita.
  telefone: string;
  // CNPJ que a URA colheu, já formatado; vazio se ela não colheu nenhum.
  cnpjSugerido: string;
  cliente?: { empresa: string; cnpj: string };
  buscando: boolean;
  cadastrando: boolean;
  aviso?: { tipo: "erro" | "sucesso"; texto: string; campo?: "email" };
  // Cancelar devolve o foco ao botão que volta a existir (DESIGN.md, "Foco do teclado depois da ação").
  focoNoBotao: boolean;
  // Ao concluir, o foco vai ao aviso: o formulário que tinha o foco sai da tela.
  refDoAviso?: React.Ref<HTMLParagraphElement>;
  onAbrir: () => void;
  onBuscar: (cnpj: string) => void;
  onTrocarCliente: () => void;
  onCadastrar: (nome: string, email: string) => void;
  onCancelar: () => void;
};

// O campo que a Recepção está preenchendo aponta para o erro do aviso (aria-describedby).
const ID_DO_AVISO = "contato-ura-aviso";

// "Cadastrar como contato deste Cliente": a Recepção guarda o número que a URA não achou. Dois passos,
// porque o CNPJ da URA é só sugestão: primeiro confirma o Cliente, depois informa nome e e-mail.
export function PainelDeContatoUra({
  etapa,
  concluido,
  telefone,
  cnpjSugerido,
  cliente,
  buscando,
  cadastrando,
  aviso,
  focoNoBotao,
  refDoAviso,
  onAbrir,
  onBuscar,
  onTrocarCliente,
  onCadastrar,
  onCancelar,
}: PainelDeContatoUraProps) {
  // O campo só aponta para o erro que é dele: o do CNPJ na busca, o do e-mail no cadastro ("e-mail repetido").
  const ligacao = { "aria-invalid": true, "aria-describedby": ID_DO_AVISO };
  const vinculoDoCnpj = aviso?.tipo === "erro" ? ligacao : {};
  const vinculoDoEmail = aviso?.tipo === "erro" && aviso.campo === "email" ? ligacao : {};
  return (
    <Pilha espaco={2}>
      <TituloDoGrupo>Contato do cliente</TituloDoGrupo>
      {etapa === "fechado" && !concluido && (
        <>
          <Texto variante="nota">Este número não é contato de nenhum Cliente.</Texto>
          <Button type="button" size="sm" autoFocus={focoNoBotao} onClick={onAbrir}>
            Cadastrar como contato deste Cliente
          </Button>
        </>
      )}
      {etapa === "cliente" && (
        <Pilha
          espaco={2}
          como="form"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (buscando) return;
            onBuscar(String(new FormData(evento.currentTarget).get("cnpj") ?? ""));
          }}
        >
          <CampoDeTexto
            id="contato-ura-cnpj"
            rotulo="CNPJ do Cliente"
            name="cnpj"
            obrigatorio
            required
            autoFocus
            inputMode="text"
            autoComplete="off"
            defaultValue={cliente?.cnpj ?? cnpjSugerido}
            {...vinculoDoCnpj}
            ajuda={
              !cliente && cnpjSugerido
                ? "Sugerido pela URA. Confira antes de cadastrar."
                : undefined
            }
          />
          <Linha espaco={2}>
            <Button type="submit" size="sm" aria-disabled={buscando} className={BOTAO_OCUPADO}>
              {buscando ? "Buscando…" : "Buscar Cliente"}
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={onCancelar}>
              Cancelar
            </Button>
          </Linha>
        </Pilha>
      )}
      {etapa === "contato" && cliente && (
        <Pilha
          espaco={2}
          como="form"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (cadastrando) return;
            const dados = new FormData(evento.currentTarget);
            onCadastrar(String(dados.get("nome") ?? ""), String(dados.get("email") ?? ""));
          }}
        >
          <Texto variante="corpo" role="status">
            Cliente: {cliente.empresa} · {cliente.cnpj}
          </Texto>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={onTrocarCliente}
          >
            Trocar Cliente
          </Button>
          <CampoDeTexto
            id="contato-ura-nome"
            rotulo="Nome"
            name="nome"
            obrigatorio
            required
            autoFocus
            maxLength={120}
            autoComplete="off"
          />
          <CampoDeTexto
            id="contato-ura-email"
            rotulo="E-mail (opcional)"
            name="email"
            type="email"
            autoComplete="off"
            {...vinculoDoEmail}
            ajuda={`O WhatsApp é o do atendimento: ${telefone}.`}
          />
          <Linha espaco={2}>
            <Button type="submit" size="sm" aria-disabled={cadastrando} className={BOTAO_OCUPADO}>
              {cadastrando ? "Cadastrando…" : "Cadastrar contato"}
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={onCancelar}>
              Cancelar
            </Button>
          </Linha>
        </Pilha>
      )}
      {aviso && (
        <AvisoDeStatus
          tipo={aviso.tipo}
          texto={aviso.texto}
          legivel
          id={ID_DO_AVISO}
          ref={refDoAviso}
          tabIndex={-1}
        />
      )}
    </Pilha>
  );
}
