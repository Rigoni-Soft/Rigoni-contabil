// Emojis oferecidos ao Funcionário, por categoria: [emoji, nome acessível].
export const CATEGORIAS_DE_EMOJI: { nome: string; emojis: [emoji: string, nome: string][] }[] = [
  {
    nome: "Rostos",
    emojis: [
      ["😀", "Sorriso"],
      ["😂", "Rindo às lágrimas"],
      ["😊", "Sorriso corado"],
      ["😍", "Olhos de coração"],
      ["😉", "Piscadela"],
      ["🙂", "Sorriso leve"],
      ["😅", "Sorriso com suor"],
      ["🤔", "Pensativo"],
      ["😢", "Chorando"],
      ["😮", "Surpreso"],
      ["😴", "Dormindo"],
      ["😎", "Óculos escuros"],
    ],
  },
  {
    nome: "Gestos",
    emojis: [
      ["👍", "Joinha"],
      ["👎", "Polegar para baixo"],
      ["👏", "Palmas"],
      ["🙏", "Mãos juntas"],
      ["🤝", "Aperto de mão"],
      ["👋", "Mão acenando"],
      ["👌", "Tudo certo"],
      ["✌️", "Paz"],
      ["💪", "Braço forte"],
      ["🤞", "Dedos cruzados"],
    ],
  },
  {
    nome: "Objetos",
    emojis: [
      ["📄", "Documento"],
      ["📎", "Clipe"],
      ["📅", "Calendário"],
      ["📞", "Telefone"],
      ["💻", "Computador"],
      ["📧", "E-mail"],
      ["💰", "Dinheiro"],
      ["🧾", "Recibo"],
      ["⏰", "Despertador"],
      ["🔑", "Chave"],
    ],
  },
  {
    nome: "Símbolos",
    emojis: [
      ["✅", "Confirmado"],
      ["❌", "Erro"],
      ["⚠️", "Atenção"],
      ["❗", "Exclamação"],
      ["❓", "Interrogação"],
      ["❤️", "Coração"],
      ["⭐", "Estrela"],
      ["🔔", "Sino"],
      ["➡️", "Seta para a direita"],
      ["🎉", "Festa"],
    ],
  },
];

export const NOME_DO_EMOJI = new Map(CATEGORIAS_DE_EMOJI.flatMap((categoria) => categoria.emojis));
