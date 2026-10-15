import { render, screen } from "@testing-library/react";

import { MensagemBalao } from "./mensagem-balao.component";

const BASE = { autor: "Maria", detalhe: null, texto: "oi", hora: "08/10 12:30" };

describe("MensagemBalao", () => {
  it("mostra quem escreveu, o detalhe, o texto e a hora", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="contato" detalhe="CNPJ 11.444.777/0001-61" />
      </ul>,
    );

    const balao = screen.getByRole("listitem");
    expect(balao).toHaveTextContent("Maria");
    expect(balao).toHaveTextContent("CNPJ 11.444.777/0001-61");
    expect(balao).toHaveTextContent("oi");
    expect(balao).toHaveTextContent("08/10 12:30");
  });

  it("cliente à esquerda; atendente e URA à direita", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="contato" texto="do cliente" />
        <MensagemBalao {...BASE} lado="atendente" texto="do atendente" />
        <MensagemBalao {...BASE} lado="ura" texto="da URA" />
      </ul>,
    );

    expect(screen.getByText("do cliente").closest("li")).toHaveClass("self-start");
    expect(screen.getByText("do atendente").closest("li")).toHaveClass("self-end");
    expect(screen.getByText("da URA").closest("li")).toHaveClass("self-end");
  });

  it("sem detalhe não mostra linha extra", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="atendente" />
      </ul>,
    );

    expect(screen.getByRole("listitem")).not.toHaveTextContent("CNPJ");
  });
});

describe("MensagemBalao — reação (#84)", () => {
  it("mostra a reação do escritório e a ação de reagir", () => {
    render(
      <ul>
        <MensagemBalao
          {...BASE}
          lado="contato"
          reacao="👍"
          acao={<button type="button">Reagir</button>}
        />
      </ul>,
    );

    expect(screen.getByRole("img", { name: "Reação do escritório: 👍" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reagir" })).toBeInTheDocument();
  });

  it("sem reação nem ação, não reserva espaço", () => {
    render(
      <ul>
        <MensagemBalao {...BASE} lado="contato" />
      </ul>,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("anexo de arquivo mostra nome, tamanho, visualizar (PDF) e baixar, com a legenda", () => {
    render(
      <ul>
        <MensagemBalao
          {...BASE}
          lado="atendente"
          texto="Segue o balanço"
          anexo={{
            tipo: "documento",
            nome: "balanco.pdf",
            tamanho: "1,5 KB",
            url: "https://l/1",
            urlVisualizacao: "https://l/1?ver",
            painelId: "p1",
          }}
        />
      </ul>,
    );

    const baixar = screen.getByRole("link", { name: "Baixar balanco.pdf" });
    expect(baixar).toHaveAttribute("href", "https://l/1");
    expect(baixar).toHaveAttribute("download", "balanco.pdf");
    // PDF abre numa aba, sem forçar o download.
    const ver = screen.getByRole("link", { name: "Visualizar balanco.pdf" });
    expect(ver).toHaveAttribute("href", "https://l/1?ver");
    expect(ver).toHaveAttribute("target", "_blank");
    expect(ver).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText("1,5 KB")).toBeInTheDocument();
    expect(screen.getByText("Segue o balanço")).toBeInTheDocument();
  });

  it("anexo de áudio mostra só o player, sem baixar", () => {
    render(
      <ul>
        <MensagemBalao
          {...BASE}
          lado="atendente"
          texto=""
          anexo={{
            tipo: "audio",
            nome: "gravacao.ogg",
            tamanho: "12 KB",
            url: "https://l/audio",
            urlVisualizacao: "https://l/audio?ver",
            painelId: "p1",
          }}
        />
      </ul>,
    );

    expect(screen.getByLabelText("Áudio: gravacao.ogg")).toHaveAttribute("src", "https://l/audio");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("Word mostra nome, tamanho e baixar; o Visualizar vem do slot do Container", () => {
    render(
      <ul>
        <MensagemBalao
          {...BASE}
          lado="contato"
          texto=""
          anexo={{
            tipo: "documento",
            nome: "contrato.docx",
            tamanho: "20 KB",
            url: "https://l/d",
            urlVisualizacao: "https://l/d?ver",
            painelId: "p9",
            previa: <button type="button">Visualizar contrato.docx</button>,
          }}
        />
      </ul>,
    );

    expect(screen.getByText("contrato.docx")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar contrato.docx" })).toHaveAttribute(
      "download",
      "contrato.docx",
    );
    // O link de PDF/TXT não vale para Word: a visualização é o botão do Container.
    expect(screen.queryByRole("link", { name: /Visualizar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizar contrato.docx" })).toBeInTheDocument();
  });

  it("anexo de imagem mostra a miniatura que amplia; sem legenda não há parágrafo de texto", () => {
    const { container } = render(
      <ul>
        <MensagemBalao
          {...BASE}
          lado="atendente"
          texto=""
          anexo={{
            tipo: "imagem",
            nome: "foto.png",
            tamanho: "10 B",
            url: "https://l/2",
            urlVisualizacao: "https://l/2?ver",
            painelId: "p2",
          }}
        />
      </ul>,
    );

    expect(screen.getByRole("button", { name: "Ampliar foto.png" })).toBeInTheDocument();
    expect(container.querySelectorAll('img[src="https://l/2"]')).toHaveLength(1); // miniatura = original
    expect(container.querySelectorAll('img[src="https://l/2?ver"]')).toHaveLength(1);
    // A ampliada oferece baixar o original.
    expect(screen.getByRole("link", { name: "Baixar foto.png", hidden: true })).toHaveAttribute(
      "href",
      "https://l/2",
    );
    expect(container.querySelectorAll("p")).toHaveLength(2); // autor e hora, nenhum de texto
  });

  it("a imagem ampliada é um diálogo nomeado com botão de fechar", () => {
    render(
      <ul>
        <MensagemBalao
          {...BASE}
          lado="atendente"
          texto=""
          anexo={{
            tipo: "imagem",
            nome: "foto.png",
            tamanho: "10 B",
            url: "https://l/original",
            urlVisualizacao: "https://l/original?ver",
            miniaturaUrl: "https://l/mini",
            painelId: "p3",
          }}
        />
      </ul>,
    );

    const painel = document.getElementById("p3")!;
    expect(painel).toHaveAttribute("role", "dialog");
    expect(painel).toHaveAttribute("aria-label", "Imagem ampliada: foto.png");
    expect(painel.querySelector("button[aria-label='Fechar imagem']")).toHaveAttribute(
      "popovertargetaction",
      "hide",
    );
    // O balão mostra a miniatura; o painel, o original.
    expect(
      screen.getByRole("button", { name: "Ampliar foto.png" }).querySelector("img"),
    ).toHaveAttribute("src", "https://l/mini");
    expect(painel.querySelector("img")).toHaveAttribute("src", "https://l/original?ver");
  });
});
