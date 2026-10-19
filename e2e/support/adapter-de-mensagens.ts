// A suíte foi escrita para o adapter FALSO de mensageria (responde 200 sem sair da aplicação e baixa
// mídia de teste pelo id). Num deploy com MENSAGERIA_MODO=real (homologação testada à mão no
// WhatsApp) esses envios iriam à Meta de verdade com telefone fictício e falhariam por configuração,
// não por bug. O workflow repassa o modo do deploy em E2E_MENSAGERIA_MODO.
export const adapterReal = process.env.E2E_MENSAGERIA_MODO === "real";
export const MOTIVO_ADAPTER_REAL =
  "depende do adapter falso de mensageria; o deploy usa MENSAGERIA_MODO=real";
