import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { definirDestinoAction, removerDestinoAction } from "./destinos-de-envio.actions";
import {
  canaisDaEscolha,
  contatoComOMesmoCanal,
  linhasDeDestino,
  opcoesDeContato,
  opcoesDeTipo,
  type DestinoSalvo,
} from "./destinos-de-envio.presenter";
import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues,
} from "./editar-cadastro-operacional.schema";

type Parametros = {
  clienteId: string;
  // Os Destinos do Setor e os tipos que ele envia, como vieram do servidor.
  destinosIniciais: DestinoSalvo[];
  tiposDeEnvio: { slug: string; rotulo: string }[];
  // O Setor da tela: dono do contato novo (o banco grava o mesmo, pelo perfil de quem chama).
  setorDoCadastro: string;
  // O formulário do cadastro: o contato criado aqui entra na lista dele, senão o Salvar do cadastro o apagaria.
  form: UseFormReturn<EditarCadastroOperacionalFormValues>;
  adicionarContato: (contato: EditarCadastroOperacionalFormValues["contatos"][number]) => void;
};

type Modo = "existente" | "novo";
type CampoDoNovo = "nome" | "telefone" | "email";
type Erros = Partial<Record<"contato" | CampoDoNovo | "canal", string>>;

const NOVO_EM_BRANCO = { nome: "", telefone: "", email: "" };
const ID_DO_SELECT = "destino-contato";

// A mesma ação repetida não muda o texto e o leitor de tela não a anunciaria de novo; o espaço no fim alterna.
const ESPACO_ALTERNADO = " ";

// O formulário e a tabela de Destinos do Setor: grava e remove na hora (cada Destino é um registro
// próprio, como o "Salvar" da linha de contato), sem esperar o Salvar do cadastro.
export function useDestinosDoCadastro({
  clienteId,
  destinosIniciais,
  tiposDeEnvio,
  setorDoCadastro,
  form,
  adicionarContato,
}: Parametros) {
  const contatos = useWatch({ control: form.control, name: "contatos" }) ?? [];
  const [destinos, setDestinos] = useState(destinosIniciais);
  const [modo, setModo] = useState<Modo>("existente");
  const [contatoId, setContatoId] = useState("");
  const [novo, setNovo] = useState(NOVO_EM_BRANCO);
  const [tipo, setTipo] = useState("");
  const [canal, setCanal] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string>();
  const [pendente, setPendente] = useState(false);
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const anunciar = (texto: string) => setAnuncio((atual) => ({ texto, vez: atual.vez + 1 }));
  const aviso = anuncio.texto && anuncio.texto + (anuncio.vez % 2 ? ESPACO_ALTERNADO : "");

  const escolhido = contatos.find((c) => c.id && c.id === contatoId);
  const canais = canaisDaEscolha(modo === "existente" ? escolhido : novo);
  const canalFinal = canais.unico ?? (canais.opcoes.some((o) => o.valor === canal) ? canal : "");
  const repetido = modo === "novo" ? contatoComOMesmoCanal(contatos, novo) : undefined;

  const limparMensagens = () => {
    setErros({});
    setErroGeral(undefined);
  };
  const reiniciar = () => {
    setModo("existente");
    setContatoId("");
    setNovo(NOVO_EM_BRANCO);
    setTipo("");
    setCanal("");
    limparMensagens();
  };
  const focarContato = () => document.getElementById(ID_DO_SELECT)?.focus();

  const escolherContato = (id: string) => {
    setContatoId(id);
    setCanal("");
    limparMensagens();
  };
  const mudarNovo = (campo: CampoDoNovo, valor: string) => {
    setNovo((atual) => ({ ...atual, [campo]: valor }));
    setCanal("");
    limparMensagens();
  };
  const abrirNovoContato = () => {
    setModo("novo");
    setCanal("");
    limparMensagens();
  };
  const voltarAoContatoCadastrado = () => {
    setModo("existente");
    setNovo(NOVO_EM_BRANCO);
    setCanal("");
    limparMensagens();
  };
  const usarContatoExistente = (id: string) => {
    setModo("existente");
    setNovo(NOVO_EM_BRANCO);
    escolherContato(id);
  };

  const conferirContato = (): Erros => {
    if (modo === "existente") return escolhido ? {} : { contato: "Escolha um contato." };
    const valido = contatoSchema.safeParse(novo);
    if (valido.success) return {};
    return Object.fromEntries(
      valido.error.issues.map((problema) => [
        (["nome", "telefone", "email"] as const).find((c) => c === problema.path[0]) ?? "nome",
        problema.message,
      ]),
    );
  };

  const adicionar = async () => {
    if (pendente) return;
    const problemas = conferirContato();
    if (repetido) {
      problemas.contato = `Já existe neste Cliente: ${repetido.nome}. Use esse contato.`;
    } else if (!Object.keys(problemas).length && !canalFinal) {
      problemas.canal = "Escolha a forma de envio.";
    }
    if (Object.keys(problemas).length) {
      setErros(problemas);
      setErroGeral(undefined);
      return;
    }

    setPendente(true);
    limparMensagens();
    try {
      const resultado = await definirDestinoAction({
        clienteId,
        contato: modo === "existente" ? { id: contatoId } : { novo },
        tipo: tipo || null,
        canal: canalFinal,
      });
      if (!resultado.ok) {
        setErroGeral(resultado.error.message);
        return;
      }
      const { destinoId, contatoId: idDoContato } = resultado.data;
      if (modo === "novo") {
        adicionarContato({
          id: idDoContato,
          ...novo,
          telefoneOriginal: novo.telefone,
          donoSetor: setorDoCadastro,
        } as EditarCadastroOperacionalFormValues["contatos"][number]);
      }
      setDestinos((atuais) => [
        ...atuais,
        { id: destinoId, contatoId: idDoContato, tipo: tipo || null, canal: canalFinal },
      ]);
      reiniciar();
      anunciar("Destino adicionado.");
      focarContato();
    } catch (erro) {
      console.error("Falha ao definir o destino de envio", erro);
      setErroGeral(mensagemDaFalha(erro));
    } finally {
      setPendente(false);
    }
  };

  const remover = async (destinoId: string) => {
    if (pendente) return;
    setPendente(true);
    setErroGeral(undefined);
    try {
      const resultado = await removerDestinoAction({ destinoId });
      if (!resultado.ok) {
        setErroGeral(resultado.error.message);
        return;
      }
      setDestinos((atuais) => atuais.filter((d) => d.id !== destinoId));
      anunciar("Destino removido.");
      focarContato();
    } catch (erro) {
      console.error("Falha ao remover o destino de envio", erro);
      setErroGeral(mensagemDaFalha(erro));
    } finally {
      setPendente(false);
    }
  };

  return {
    idDoSelect: ID_DO_SELECT,
    linhas: linhasDeDestino(destinos, contatos, tiposDeEnvio),
    formulario: {
      modo,
      opcoesDeContato: opcoesDeContato(contatos),
      opcoesDeTipo: opcoesDeTipo(tiposDeEnvio),
      contatoId,
      novo,
      tipo,
      canal: canalFinal,
      escolhido: escolhido && { nome: escolhido.nome, email: escolhido.email },
      canais,
      repetido: repetido?.id ? { id: repetido.id, nome: repetido.nome } : undefined,
      erros,
      erroGeral,
      pendente,
    },
    aviso,
    onEscolherContato: escolherContato,
    onMudarNovo: mudarNovo,
    onMudarTipo: setTipo,
    onMudarCanal: setCanal,
    onNovoContato: abrirNovoContato,
    onVoltar: voltarAoContatoCadastrado,
    onUsarExistente: usarContatoExistente,
    onAdicionar: adicionar,
    onRemover: remover,
  };
}
