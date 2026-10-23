// Integracao com o Google Drive: envia e ATUALIZA os mesmos arquivos numa pasta do Drive.
// Usa o login do Google (Google Identity Services) com a permissao "drive.file":
// o sistema so enxerga os arquivos que ele mesmo criou no Drive.

// ID do cliente OAuth (Google Cloud). Pode ficar fixo aqui para nao precisar informar em cada computador.
const DRIVE_CLIENT_ID_PADRAO = "";
const DRIVE_ESCOPO = "https://www.googleapis.com/auth/drive.file";
const GIS = "https://accounts.google.com/gsi/client";
const PASTA_DRIVE = "Controle de Estoque EPI";
const PASTA_DRIVE_NF = "Notas Fiscais";

let tokenCliente = null, tokenClienteId = "";
let tokenDrive = null;  // { valor, expira }

function cfgDrive() {
  // sempre o mesmo objeto (alteracoes feitas depois de um "await" nao se perdem)
  const padrao = { ativo: false, client_id: "", email: "", pasta_id: "", pasta_nf_id: "", arquivos: {} };
  const cfg = DB.config.drive = DB.config.drive || {};
  for (const k in padrao) if (cfg[k] === undefined) cfg[k] = padrao[k];
  return cfg;
}
const clientIdDrive = () => cfgDrive().client_id || DRIVE_CLIENT_ID_PADRAO;
const driveAtivo = () => cfgDrive().ativo && !!clientIdDrive();

try {
  const t = JSON.parse(localStorage.getItem("controle_epi_token_drive") || "null");
  if (t && t.expira > Date.now() + 60000) tokenDrive = t;
} catch (e) { /* sem token salvo */ }

const tokenValido = () => tokenDrive && tokenDrive.expira > Date.now() + 60000;

async function prepararLoginGoogle() {
  await carregarScript(GIS);
  if (tokenCliente && tokenClienteId === clientIdDrive()) return;
  tokenClienteId = clientIdDrive();
  tokenCliente = google.accounts.oauth2.initTokenClient({ client_id: tokenClienteId, scope: DRIVE_ESCOPO, callback: () => {} });
}

// Pede o token ao Google. Precisa ser chamado a partir de um clique (abre uma janelinha do Google).
async function obterTokenDrive(primeiraVez) {
  if (tokenValido()) return tokenDrive.valor;
  await prepararLoginGoogle();
  return new Promise((ok, falha) => {
    tokenCliente.callback = r => {
      if (r.error) return falha(new Error(r.error_description || r.error));
      tokenDrive = { valor: r.access_token, expira: Date.now() + (r.expires_in || 3600) * 1000 };
      try { localStorage.setItem("controle_epi_token_drive", JSON.stringify(tokenDrive)); } catch (e) {}
      ok(tokenDrive.valor);
    };
    tokenCliente.error_callback = e => falha(new Error(e.type === "popup_closed" ? "janela do Google fechada" :
      e.type === "popup_failed_to_open" ? "o navegador bloqueou a janela do Google" : (e.message || e.type)));
    tokenCliente.requestAccessToken({ prompt: primeiraVez ? "consent" : "" });
  });
}

async function apiDrive(url, opcoes = {}) {
  const r = await fetch(url, { ...opcoes, headers: { Authorization: "Bearer " + tokenDrive.valor, ...(opcoes.headers || {}) } });
  if (r.status === 401) { tokenDrive = null; throw new Error("login do Google expirou, clique em Salvar de novo"); }
  if (!r.ok) {
    const erro = new Error(`Drive respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    erro.status = r.status;
    throw erro;
  }
  return r.status === 204 ? null : r.json();
}

async function existeNoDrive(id) {
  if (!id) return false;
  try {
    const f = await apiDrive(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,trashed`);
    return !f.trashed;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

async function garantirPastaDrive(chave, nome, pai) {
  const cfg = cfgDrive();
  if (await existeNoDrive(cfg[chave])) return cfg[chave];
  const f = await apiDrive("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: pai ? [pai] : undefined })
  });
  cfg[chave] = f.id;
  gravarDB();
  return f.id;
}

// Cria o arquivo na pasta ou atualiza o conteudo do mesmo arquivo (mesmo ID / mesmo link)
async function enviarParaDrive(nome, blob, idExistente, pasta) {
  if (idExistente) {
    try {
      return await apiDrive(`https://www.googleapis.com/upload/drive/v3/files/${idExistente}?uploadType=media&fields=id,webViewLink`, {
        method: "PATCH", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob
      });
    } catch (e) {
      if (e.status !== 404) throw e;  // apagado no Drive: cria de novo
    }
  }
  const corpo = new FormData();
  corpo.append("metadata", new Blob([JSON.stringify({ name: nome, parents: [pasta] })], { type: "application/json" }));
  corpo.append("file", blob);
  return apiDrive("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", body: corpo });
}

// Envia as notas fiscais que ainda nao estao no Drive (guarda o link em cada lancamento)
async function enviarNotasDrive() {
  const pendentes = DB.movimentos.filter(m => m.nf && !m.nf.drive_id);
  if (!pendentes.length) return 0;
  const pai = await garantirPastaDrive("pasta_id", PASTA_DRIVE);
  const pasta = await garantirPastaDrive("pasta_nf_id", PASTA_DRIVE_NF, pai);
  let n = 0;
  for (const m of pendentes) {
    const anexo = await idbLer("anexos", m.id);
    if (!anexo) continue;
    const f = await enviarParaDrive(nomeArquivoNF(m, anexo), anexo.dados, null, pasta);
    m.nf.drive_id = f.id;
    m.nf.drive_link = f.webViewLink;
    n++;
  }
  gravarDB();
  return n;
}

async function enviarPlanilhasDrive(arquivos) {
  const cfg = cfgDrive();
  const pasta = await garantirPastaDrive("pasta_id", PASTA_DRIVE);
  for (const [nome, blob] of arquivos) {
    const f = await enviarParaDrive(nome, blob, cfg.arquivos[nome], pasta);
    cfg.arquivos[nome] = f.id;
  }
  gravarDB();
}

async function apagarNotaDrive(m) {
  if (!m.nf || !m.nf.drive_id || !tokenValido()) return;
  try { await apiDrive(`https://www.googleapis.com/drive/v3/files/${m.nf.drive_id}`, { method: "DELETE" }); } catch (e) { /* ignora */ }
}

async function emailGoogle() {
  try {
    const r = await apiDrive("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)");
    return r.user.emailAddress;
  } catch (e) { return ""; }
}

// ------------------------------------------------------------ tela (aba Planilhas e backup)
function desenharDrive() {
  const cfg = cfgDrive();
  mostrarAvisoPasta();
  $("d-client").value = cfg.client_id;
  $("d-client-linha").style.display = DRIVE_CLIENT_ID_PADRAO ? "none" : "";
  const st = $("d-status");
  if (driveAtivo()) {
    st.className = "info";
    st.innerHTML = `✅ Conectado${cfg.email ? " como <b>" + esc(cfg.email) + "</b>" : ""}. As planilhas são atualizadas na pasta
      <b>${PASTA_DRIVE}</b> do seu Drive a cada salvamento.` +
      (cfg.pasta_id ? ` <a href="https://drive.google.com/drive/folders/${cfg.pasta_id}" target="_blank" rel="noopener">Abrir pasta no Drive</a>` : "");
    $("d-conectar").textContent = "🔄 Sincronizar agora";
    $("d-desconectar").style.display = "";
  } else {
    st.className = "info ruim";
    st.textContent = clientIdDrive() ? "Google Drive desconectado." : "Informe o ID do cliente do Google para ativar.";
    $("d-conectar").textContent = "🔗 Conectar ao Google Drive";
    $("d-desconectar").style.display = "none";
  }
}

async function conectarDrive() {
  const cfg = cfgDrive();
  const id = $("d-client").value.trim();
  if (id) cfg.client_id = id;
  if (!clientIdDrive()) return mostrar("Informe o ID do cliente do Google (veja o passo a passo abaixo).", "err");
  if (!/\.apps\.googleusercontent\.com$/.test(clientIdDrive())) return mostrar("O ID do cliente deve terminar com .apps.googleusercontent.com", "err");
  try {
    const primeira = !cfg.ativo;
    await obterTokenDrive(primeira);
    cfg.ativo = true;
    cfg.email = await emailGoogle() || cfg.email;
    gravarDB();
    desenharDrive();
    await gerarExcel($("mes").value, pastaHandle ? await permissaoPasta() : false, true);
    desenharDrive();
  } catch (e) {
    mostrar("Não foi possível conectar ao Google Drive: " + esc(e.message), "err");
  }
}

function desconectarDrive() {
  if (!confirm("Desconectar o Google Drive? Os arquivos que já estão no Drive continuam lá.")) return;
  const cfg = cfgDrive();
  if (tokenDrive && window.google) google.accounts.oauth2.revoke(tokenDrive.valor, () => {});
  tokenDrive = null;
  try { localStorage.removeItem("controle_epi_token_drive"); } catch (e) {}
  cfg.ativo = false;
  gravarDB();
  desenharDrive();
}
