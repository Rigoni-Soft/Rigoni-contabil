// Tipo estrutural local (view burra, arquitetura.md §3.4). `cor` é a escala semântica dos cards.
// `href`: a fatia que leva a outra tela (ex.: o Responsável no comparativo do RH).
export type Fatia = { id: string; rotulo: string; quantidade: number; cor: string; href?: string };
