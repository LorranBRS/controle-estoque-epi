// Controle de Estoque de EPI - versao web (roda inteiro no navegador)

const $ = id => document.getElementById(id);
const CHAVE_DB = "controle_epi_db_v1";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const nomeMes = m => MESES[+m.slice(5) - 1] + "/" + m.slice(0, 4);
const br = d => d.split("-").reverse().join("/");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rotulo = it => `${it.id} - ${it.descricao}`;

let DB = null;
let pastaHandle = null;
let anexoPendente = null;  // nota fiscal escolhida no formulario, ainda nao salva

// ------------------------------------------------------------ banco (localStorage)
const LISTAS = {
  pessoas: { titulo: "Pessoas que retiram EPI", dica: "Ex.: Edjanio, Reginaldo..." },
  responsaveis: { titulo: "Responsáveis", dica: "Quem registra / autoriza" },
  destinos: { titulo: "Destinos (para onde)", dica: "Ex.: Obra SP, Galpão 2..." },
  fornecedores: { titulo: "Fornecedores (entradas)", dica: "Quem entrega / vende o EPI" }
};

function completarDB(db) {
  db.listas = db.listas || {};
  for (const k in LISTAS) db.listas[k] = db.listas[k] || [];
  db.config = Object.assign({ auto_add: true, resp_padrao: "", dest_padrao: "" }, db.config || {});
  return db;
}

function carregarDB() {
  try {
    const s = localStorage.getItem(CHAVE_DB);
    if (s) return completarDB(JSON.parse(s));
  } catch (e) { /* segue com os dados iniciais */ }
  return completarDB({ obra: "Fabrica do Samba - RJ", itens: JSON.parse(JSON.stringify(ITENS_INICIAIS)), movimentos: [], prox_mov: 1 });
}

function gravarDB() {
  localStorage.setItem(CHAVE_DB, JSON.stringify(DB));
}

function lembrar(k, v) { try { localStorage.setItem("controle_epi_" + k, v); } catch (e) {} }
function lembrado(k) { try { return localStorage.getItem("controle_epi_" + k) || ""; } catch (e) { return ""; } }

const itemPorId = (db, id) => db.itens.find(i => i.id === id);

function resumoMes(db, mes) {
  // Estoque inicial do mes = base + movimentos dos meses anteriores
  return [...db.itens].sort((a, b) => a.id - b.id).map(it => {
    let inicial = it.estoque_base || 0, ent = 0, sai = 0;
    for (const m of db.movimentos) {
      if (m.item_id !== it.id) continue;
      const sinal = m.tipo === "Entrada" ? 1 : -1, mm = m.data.slice(0, 7);
      if (mm < mes) inicial += sinal * m.quantidade;
      else if (mm === mes) sinal > 0 ? ent += m.quantidade : sai += m.quantidade;
    }
    return { id: it.id, descricao: it.descricao, ca: it.ca || "", inicial, entradas: ent, saidas: sai, saldo: inicial + ent - sai };
  });
}

function saldoAtual(db, id) {
  let s = (itemPorId(db, id) || {}).estoque_base || 0;
  for (const m of db.movimentos) if (m.item_id === id) s += m.tipo === "Entrada" ? m.quantidade : -m.quantidade;
  return s;
}

// ------------------------------------------------------------ pasta (File System Access API)
const temPasta = "showDirectoryPicker" in window;

const idb = (acao, valor) => acao === "ler" ? idbLer("cfg", "pasta") : idbGravar("cfg", "pasta", valor);

async function escolherPasta() {
  try {
    pastaHandle = await window.showDirectoryPicker({ id: "controle-epi", mode: "readwrite" });
    await idb("gravar", pastaHandle);
    DB.movimentos.forEach(m => { if (m.nf) delete m.nf.arquivo_local; });  // regrava as NFs na pasta nova
    gravarDB();
    mostrarAvisoPasta();
    await gerarExcel($("mes").value);
  } catch (e) {
    if (e.name !== "AbortError") mostrar("Não foi possível usar a pasta: " + e.message, "err");
  }
}

async function permissaoPasta() {
  if (!pastaHandle) return false;
  const op = { mode: "readwrite" };
  if (await pastaHandle.queryPermission(op) === "granted") return true;
  return await pastaHandle.requestPermission(op) === "granted";
}

function mostrarAvisoPasta() {
  const a = $("aviso-pasta");
  if (pastaHandle) {
    a.className = "aviso-pasta ok";
    a.innerHTML = `<span>📁 Planilhas sendo salvas na pasta <b>${esc(pastaHandle.name)}</b>.</span>`;
    $("pasta-atual").textContent = "Pasta atual: " + pastaHandle.name;
  } else if (driveAtivo()) {
    a.className = "aviso-pasta ok";
    a.innerHTML = `<span>☁ Planilhas sendo atualizadas no <b>Google Drive</b>.</span>` +
      (temPasta ? `<button onclick="escolherPasta()">📁 Salvar também numa pasta do computador</button>` : "");
    $("pasta-atual").textContent = temPasta ? "Nenhuma pasta escolhida." : "Indisponível neste navegador.";
  } else if (temPasta) {
    a.className = "aviso-pasta";
    a.innerHTML = `<span>Escolha a pasta onde as planilhas Excel serão salvas e atualizadas.</span><button class="btn" onclick="escolherPasta()">📁 Escolher pasta</button>`;
    $("pasta-atual").textContent = "Nenhuma pasta escolhida.";
  } else {
    a.className = "aviso-pasta";
    a.innerHTML = `<span>Este navegador não permite atualizar arquivos numa pasta: a planilha do mês será <b>baixada</b> a cada salvamento. Para atualizar sempre o mesmo arquivo, use Chrome ou Edge no computador.</span>`;
    $("btn-pasta").disabled = true;
    $("pasta-atual").textContent = "Indisponível neste navegador.";
  }
}

async function gravarArquivo(nome, blob) {
  let nova = false;
  try { await pastaHandle.getFileHandle(nome); } catch (e) { nova = true; }
  const fh = await pastaHandle.getFileHandle(nome, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return nova;
}

function baixar(nome, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Chamado no clique (o navegador exige um clique para pedir permissao da pasta e abrir o login do Google)
let erroLoginDrive = null;
async function prepararSalvamento() {
  erroLoginDrive = null;
  if (driveAtivo() && !tokenValido()) {
    try { await obterTokenDrive(false); } catch (e) { erroLoginDrive = e; }
  }
  return pastaHandle ? await permissaoPasta() : false;
}

// Grava as notas fiscais ainda nao salvas na subpasta Notas_Fiscais da pasta escolhida
async function salvarNotasLocais() {
  const pendentes = DB.movimentos.filter(m => m.nf && !m.nf.arquivo_local);
  if (!pendentes.length) return;
  const dir = await pastaHandle.getDirectoryHandle("Notas_Fiscais", { create: true });
  for (const m of pendentes) {
    const anexo = await idbLer("anexos", m.id);
    if (!anexo) continue;
    const nome = nomeArquivoNF(m, anexo);
    const w = await (await dir.getFileHandle(nome, { create: true })).createWritable();
    await w.write(anexo.dados);
    await w.close();
    m.nf.arquivo_local = nome;
  }
  gravarDB();
}

async function previasDoMes(mes) {
  const saida = {};
  for (const m of DB.movimentos.filter(x => x.nf && x.data.slice(0, 7) === mes)) {
    const a = await idbLer("anexos", m.id);
    if (a && a.previa) saida[m.id] = { previa: await a.previa.arrayBuffer(), largura: a.largura, altura: a.altura };
  }
  return saida;
}

// Atualiza a planilha do mes (um arquivo por mes) e a planilha principal: na pasta, no Drive ou baixando
async function gerarExcel(mes, permitida, avisarDrive) {
  const nome = `Controle_EPI_${nomeMesArq(mes)}.xlsx`;
  const msgs = [], erros = [];
  const usarPasta = pastaHandle && (permitida ?? await permissaoPasta());
  const usarDrive = driveAtivo() && tokenValido();
  if (driveAtivo() && !usarDrive) erros.push(`Google Drive não atualizado (${esc((erroLoginDrive || {}).message || "faça login")}). Clique em "Sincronizar agora" na aba Planilhas e backup.`);

  if (usarPasta) { try { await salvarNotasLocais(); } catch (e) { erros.push("Não foi possível gravar as notas fiscais na pasta: " + esc(e.message)); } }
  if (usarDrive) { try { await enviarNotasDrive(); } catch (e) { erros.push("Notas fiscais não enviadas ao Drive: " + esc(e.message)); } }

  let blob;
  try {
    blob = await montarPlanilha(DB, mes, await previasDoMes(mes));
  } catch (e) {
    return mostrar(`✔ Lançamento salvo no sistema.<br>⚠ Não foi possível gerar o Excel (${esc(e.message)}). Verifique a internet e clique em "Gerar Excel agora".`, "err");
  }
  const arquivos = [[nome, blob], ["CONTROLE_ESTOQUE_EPI.xlsx", blob]];

  if (usarPasta) {
    const falhas = [];
    let nova = false;
    for (const [arq, b] of arquivos) {
      try { const n = await gravarArquivo(arq, b); if (arq === nome) nova = n; }
      catch (e) { falhas.push(arq); }
    }
    if (falhas.length) erros.push(`Não foi possível atualizar ${falhas.join(" e ")}. Se estiver aberto no Excel, feche e clique em "Gerar Excel agora".`);
    else msgs.push(`Planilha do mês ${nova ? "criada" : "atualizada"}: <b>${esc(nome)}</b>`);
  }
  if (usarDrive) {
    try {
      await enviarPlanilhasDrive(arquivos);
      msgs.push("Google Drive atualizado");
    } catch (e) { erros.push("Google Drive não atualizado: " + esc(e.message)); }
  }
  if (!usarPasta && !usarDrive) {
    baixar(nome, blob);
    msgs.push(`Planilha do mês baixada: <b>${esc(nome)}</b>`);
  }
  if (erros.length) mostrar(`✔ Lançamento salvo no sistema.${msgs.length ? " " + msgs.join(" • ") : ""}<br>⚠ ${erros.join("<br>⚠ ")}`, "err");
  else mostrar("✔ Salvo. " + msgs.join(" • "));
  if (avisarDrive) desenharDrive();
}

// ------------------------------------------------------------ caixa de escolha (lista + digitacao livre)
const normalizar = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function semRepetir(lista) {
  const vistos = new Set(), saida = [];
  for (const v of lista) {
    const n = normalizar(v).trim();
    if (n && !vistos.has(n)) { vistos.add(n); saida.push(v.trim()); }
  }
  return saida;
}

function combo(input, opcoes) {
  const caixa = document.createElement("div");
  caixa.className = "combo";
  input.parentNode.insertBefore(caixa, input);
  caixa.appendChild(input);
  const seta = document.createElement("button");
  seta.type = "button";
  seta.className = "seta";
  seta.tabIndex = -1;
  seta.textContent = "▼";
  seta.title = "Mostrar lista";
  const ul = document.createElement("ul");
  ul.className = "combo-lista";
  caixa.append(seta, ul);
  let ativo = -1, itens = [];

  function abrir(tudo) {
    const f = tudo ? "" : normalizar(input.value);
    itens = opcoes().filter(o => normalizar(o).includes(f)).slice(0, 200);
    ativo = -1;
    ul.innerHTML = itens.length ? itens.map((o, i) => `<li data-i="${i}">${esc(o)}</li>`).join("")
      : `<li class="vazio">${input.value.trim() ? "Nome novo: será usado como foi digitado" : "Lista vazia: cadastre em Configurações ou digite"}</li>`;
    ul.classList.add("aberta");
  }
  const fechar = () => ul.classList.remove("aberta");
  function escolher(i) {
    input.value = itens[i];
    fechar();
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new Event("change"));
  }
  function marcar(i) {
    const lis = ul.querySelectorAll("li[data-i]");
    if (!lis.length) return;
    ativo = (i + lis.length) % lis.length;
    lis.forEach((li, j) => li.classList.toggle("ativo", j === ativo));
    lis[ativo].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", () => abrir(true));
  input.addEventListener("click", () => { if (!ul.classList.contains("aberta")) abrir(true); });
  input.addEventListener("input", e => { if (e.isTrusted) abrir(false); });
  input.addEventListener("blur", () => setTimeout(fechar, 150));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!ul.classList.contains("aberta")) abrir(true); marcar(ativo + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); marcar(ativo - 1); }
    else if (e.key === "Enter" && !e.ctrlKey && ul.classList.contains("aberta") && ativo >= 0) { e.preventDefault(); escolher(ativo); }
    else if (e.key === "Escape" || e.key === "Tab") fechar();
  });
  ul.addEventListener("mousedown", e => {
    e.preventDefault();
    const li = e.target.closest("li[data-i]");
    if (li) escolher(+li.dataset.i);
  });
  seta.addEventListener("mousedown", e => {
    e.preventDefault();
    if (ul.classList.contains("aberta")) fechar(); else { input.focus(); abrir(true); }
  });
}

// valores ja usados nos lancamentos, para completar as listas
const usados = (campo, tipo) => DB.movimentos.filter(m => !tipo || m.tipo === tipo).map(m => m[campo]).filter(Boolean);

function opcoesPessoa() {
  return tipoAtual() === "Entrada"
    ? semRepetir([...DB.listas.fornecedores, ...usados("pessoa", "Entrada")])
    : semRepetir([...DB.listas.pessoas, ...usados("pessoa", "Saída")]);
}
function opcoesDestino() {
  return tipoAtual() === "Entrada"
    ? semRepetir(usados("destino", "Entrada"))
    : semRepetir([...DB.listas.destinos, ...usados("destino", "Saída")]);
}
const opcoesResp = () => semRepetir([...DB.listas.responsaveis, ...usados("responsavel")]);

function adicionarNaLista(lista, valor) {
  valor = (valor || "").trim().replace(/\s+/g, " ");
  if (!valor || DB.listas[lista].some(v => normalizar(v) === normalizar(valor))) return false;
  DB.listas[lista].push(valor);
  DB.listas[lista].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return true;
}

// ------------------------------------------------------------ aba Configuracoes
function desenharListas() {
  $("c-resp-padrao").value = DB.config.resp_padrao;
  $("c-dest-padrao").value = DB.config.dest_padrao;
  $("c-auto").checked = DB.config.auto_add;
  $("listas").innerHTML = Object.entries(LISTAS).map(([k, l]) => `
    <div class="card">
      <h2>${l.titulo} <span class="sub">(${DB.listas[k].length})</span></h2>
      <div class="add-linha">
        <input id="add-${k}" placeholder="${esc(l.dica)}" onkeydown="if(event.key==='Enter')incluirNome('${k}')">
        <button class="btn" onclick="incluirNome('${k}')">Adicionar</button>
      </div>
      <div class="chips">${DB.listas[k].map((v, i) => `<span class="chip">${esc(v)}<button title="Remover" onclick="removerNome('${k}', ${i})">×</button></span>`).join("")
        || '<span class="sub">Nenhum nome cadastrado.</span>'}</div>
    </div>`).join("");
}

function incluirNome(lista) {
  const campo = $("add-" + lista), partes = campo.value.split(/[;\n]/);
  let n = 0;
  partes.forEach(p => { if (adicionarNaLista(lista, p)) n++; });
  if (!n && campo.value.trim()) return mostrar("Esse nome já está na lista.", "err");
  gravarDB();
  desenharListas();
  $("add-" + lista).focus();
}

function removerNome(lista, i) {
  if (!confirm(`Remover "${DB.listas[lista][i]}" da lista? Os lançamentos já feitos não mudam.`)) return;
  DB.listas[lista].splice(i, 1);
  gravarDB();
  desenharListas();
}

function salvarConfig() {
  DB.config.resp_padrao = $("c-resp-padrao").value.trim();
  DB.config.dest_padrao = $("c-dest-padrao").value.trim();
  DB.config.auto_add = $("c-auto").checked;
  adicionarNaLista("responsaveis", DB.config.resp_padrao);
  adicionarNaLista("destinos", DB.config.dest_padrao);
  gravarDB();
  desenharListas();
  limpar();
  mostrar("✔ Configurações salvas.");
}

function importarUsados() {
  let n = 0;
  usados("pessoa", "Saída").forEach(v => adicionarNaLista("pessoas", v) && n++);
  usados("pessoa", "Entrada").forEach(v => adicionarNaLista("fornecedores", v) && n++);
  usados("destino", "Saída").forEach(v => adicionarNaLista("destinos", v) && n++);
  usados("responsavel").forEach(v => adicionarNaLista("responsaveis", v) && n++);
  gravarDB();
  desenharListas();
  mostrar(n ? `✔ ${n} nome(s) importado(s) dos lançamentos.` : "Nenhum nome novo para importar.");
}

// ------------------------------------------------------------ telas
function mostrar(txt, tipo = "ok") {
  const m = $("msg");
  m.className = "msg " + tipo;
  m.innerHTML = txt;
  clearTimeout(mostrar.t);
  mostrar.t = setTimeout(() => m.className = "msg", 9000);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function atualizarTela() {
  $("obra").textContent = "Obra: " + DB.obra;
  desenharUltimos(); desenharEstoque(); desenharMovs(); desenharItens(); desenharListas(); infoItem();
}

function itemSelecionado() {
  const v = $("f-item").value.trim();
  return DB.itens.find(it => rotulo(it) === v) || DB.itens.find(it => String(it.id) === v);
}

const tipoAtual = () => document.querySelector("input[name=tipo]:checked").value;

function infoItem() {
  const it = itemSelecionado(), info = $("f-info");
  if (!it) {
    info.className = "full info";
    info.textContent = "Selecione um EPI para ver o saldo.";
    $("lin-ca").style.display = "none";
    return;
  }
  const s = saldoAtual(DB, it.id), q = +$("f-qtd").value || 0;
  const depois = tipoAtual() === "Entrada" ? s + q : s - q;
  info.className = "full info" + (depois < 0 ? " ruim" : "");
  info.innerHTML = `Saldo atual: <b>${s}</b> &nbsp;→&nbsp; após este lançamento: <b>${depois}</b>` + (depois < 0 ? " &nbsp;⚠ estoque insuficiente" : "");
  const ca = $("f-ca").value.trim();
  $("lin-ca").style.display = ca && ca !== (it.ca || "") ? "block" : "none";
}

function ajustarTipo() {
  const t = tipoAtual();
  document.querySelectorAll(".tipo label").forEach(l => l.classList.toggle("sel", l.querySelector("input").checked));
  $("lbl-data").textContent = t === "Entrada" ? "Data de entrada" : "Data de saída";
  $("lbl-pessoa").textContent = t === "Entrada" ? "Fornecedor / quem entregou" : "Nome de quem retirou";
  $("lbl-destino").textContent = t === "Entrada" ? "Origem" : "Para onde (destino)";
  $("bloco-nf").style.display = t === "Entrada" ? "" : "none";
  const dp = DB && DB.config.dest_padrao;
  if (dp && t === "Entrada" && $("f-destino").value === dp) $("f-destino").value = "";
  if (dp && t === "Saída" && !$("f-destino").value) $("f-destino").value = dp;
  infoItem();
}

async function salvarMov() {
  const it = itemSelecionado();
  if (!it) return mostrar("Selecione um EPI da lista.", "err");
  const tipo = tipoAtual(), qtd = Math.floor(+$("f-qtd").value);
  if (!(qtd > 0)) return mostrar("Informe uma quantidade maior que zero.", "err");
  if (tipo === "Saída" && !$("f-pessoa").value.trim()) return mostrar("Informe o nome de quem retirou o EPI.", "err");
  const saldo = saldoAtual(DB, it.id);
  if (tipo === "Saída" && saldo - qtd < 0 &&
      !confirm(`O saldo de "${it.descricao}" é ${saldo}. Salvar mesmo assim (ficará negativo)?`)) return;
  // pede a permissao da pasta logo no clique (o navegador exige um clique do usuario)
  const permitida = await prepararSalvamento();
  const data = $("f-data").value || hoje();
  const ca = $("f-ca").value.trim() || it.ca || "";
  if ($("f-atualiza-ca").checked && ca) it.ca = ca;
  const mov = {
    id: DB.prox_mov++, tipo, item_id: it.id, quantidade: qtd, data, ca,
    pessoa: $("f-pessoa").value.trim(), destino: $("f-destino").value.trim(),
    responsavel: $("f-resp").value.trim(), obs: $("f-obs").value.trim(),
    registrado_em: new Date().toISOString()
  };
  if (tipo === "Entrada") {
    mov.nf_numero = $("f-nf-num").value.trim();
    if (anexoPendente) {
      try {
        await idbGravar("anexos", mov.id, anexoPendente);
        mov.nf = { nome: anexoPendente.nome, tipo: anexoPendente.tipo, tamanho: anexoPendente.tamanho };
      } catch (e) {
        mostrar("Não foi possível guardar a nota fiscal: " + esc(e.message), "err");
      }
    }
  }
  DB.movimentos.push(mov);
  if (DB.config.auto_add) {
    const m = DB.movimentos[DB.movimentos.length - 1];
    adicionarNaLista(tipo === "Entrada" ? "fornecedores" : "pessoas", m.pessoa);
    if (tipo === "Saída") adicionarNaLista("destinos", m.destino);
    adicionarNaLista("responsaveis", m.responsavel);
  }
  gravarDB();
  lembrar("responsavel", $("f-resp").value.trim());
  $("mes").value = data.slice(0, 7);
  limpar();
  atualizarTela();
  await gerarExcel(data.slice(0, 7), permitida);
  $("f-item").focus();
}

function limpar() {
  ["f-item", "f-ca", "f-pessoa", "f-destino", "f-obs"].forEach(i => $(i).value = "");
  $("f-qtd").value = 1;
  $("f-data").value = hoje();
  $("f-resp").value = (DB && DB.config.resp_padrao) || lembrado("responsavel");
  if (DB && DB.config.dest_padrao && tipoAtual() === "Saída") $("f-destino").value = DB.config.dest_padrao;
  $("f-atualiza-ca").checked = false;
  $("f-nf-num").value = "";
  definirAnexo(null);
  infoItem();
}

// ------------------------------------------------------------ nota fiscal no formulario
function definirAnexo(anexo) {
  anexoPendente = anexo;
  const img = $("f-nf-previa");
  if (img.src) URL.revokeObjectURL(img.src);
  $("f-nf-nome").textContent = anexo ? `${anexo.nome} (${(anexo.tamanho / 1024 / 1024).toFixed(2)} MB${anexo.paginas > 1 ? ", " + anexo.paginas + " páginas" : ""})` : "Nenhum arquivo anexado.";
  $("f-nf-remover").style.display = anexo ? "" : "none";
  if (anexo && anexo.previa) { img.src = URL.createObjectURL(anexo.previa); img.hidden = false; }
  else { img.removeAttribute("src"); img.hidden = true; }
}

async function lerArquivoNF(arquivo) {
  $("f-nf-nome").textContent = "Lendo arquivo...";
  try { return await prepararAnexo(arquivo); }
  catch (e) { mostrar("Anexo inválido: " + esc(e.message), "err"); return null; }
}

async function verAnexo(id) {
  const a = await idbLer("anexos", id);
  const m = DB.movimentos.find(x => x.id === id);
  if (a) return abrirAnexo(a);
  if (m && m.nf && m.nf.drive_link) return window.open(m.nf.drive_link, "_blank");
  mostrar("O arquivo desta nota fiscal não está neste computador.", "err");
}

let movAnexarDepois = null;
function anexarDepois(id) {
  movAnexarDepois = id;
  $("arq-nf-depois").click();
}

async function anexarNoMovimento(arquivo) {
  const m = DB.movimentos.find(x => x.id === movAnexarDepois);
  if (!m) return;
  const permitida = await prepararSalvamento();
  const a = await lerArquivoNF(arquivo);
  definirAnexo(null);
  if (!a) return;
  await idbGravar("anexos", m.id, a);
  m.nf = { nome: a.nome, tipo: a.tipo, tamanho: a.tamanho };
  if (!m.nf_numero) m.nf_numero = (prompt("Nº da nota fiscal (opcional):", "") || "").trim();
  gravarDB();
  atualizarTela();
  await gerarExcel(m.data.slice(0, 7), permitida);
}

function linhaMov(m, excluir) {
  const it = itemPorId(DB, m.item_id) || { descricao: "?" };
  return `<tr><td>${br(m.data)}</td><td><span class="tag ${m.tipo}">${m.tipo}</span></td><td>${esc(it.descricao)}</td>
    <td>${esc(m.ca)}</td><td class="n"><b>${m.quantidade}</b></td><td>${esc(m.pessoa)}</td><td>${esc(m.destino)}</td>
    <td>${esc(m.responsavel)}</td><td>${esc(m.obs)}</td><td>${celulaNFTela(m, excluir)}</td>${excluir ? `<td><button class="link" onclick="excluir(${m.id})">Excluir</button></td>` : ""}</tr>`;
}
const cabMov = ex => `<tr><th>Data</th><th>Tipo</th><th>Descrição do EPI</th><th>C.A</th><th>Qtd</th><th>Retirado por / Fornecedor</th><th>Destino / Origem</th><th>Responsável</th><th>Obs.</th><th>Nota fiscal</th>${ex ? "<th></th>" : ""}</tr>`;

function celulaNFTela(m, comAcoes) {
  if (m.nf) return `<button class="clipe" onclick="verAnexo(${m.id})" title="${esc(m.nf.nome)}">📎 ${esc(m.nf_numero || "Ver NF")}</button>`;
  if (m.tipo !== "Entrada") return "";
  return esc(m.nf_numero || "") + (comAcoes ? ` <button class="editar" onclick="anexarDepois(${m.id})">Anexar NF</button>` : "");
}
const ordenar = l => [...l].sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

function desenharUltimos() {
  const l = ordenar(DB.movimentos).slice(0, 8);
  $("t-ultimos").innerHTML = l.length ? cabMov(false) + l.map(m => linhaMov(m, false)).join("") : "<tr><td class='sub'>Nenhum lançamento ainda.</td></tr>";
}

function desenharEstoque() {
  const f = $("busca-est").value.toLowerCase(), r = resumoMes(DB, $("mes").value);
  $("tit-estoque").textContent = "Estoque – " + nomeMes($("mes").value);
  const soma = k => r.reduce((a, l) => a + l[k], 0);
  $("kpis").innerHTML = `<div class="kpi"><span>EPIs cadastrados</span><b>${r.length}</b></div>
    <div class="kpi"><span>Entradas no mês</span><b style="color:var(--ok)">${soma("entradas")}</b></div>
    <div class="kpi"><span>Saídas no mês</span><b style="color:var(--verm)">${soma("saidas")}</b></div>
    <div class="kpi"><span>Itens com saldo zerado</span><b>${r.filter(l => l.saldo <= 0).length}</b></div>`;
  $("t-estoque").innerHTML = `<tr><th>Nº</th><th>Descrição do EPI</th><th>C.A</th><th>Qtd. estoque atualizado</th><th class="ent">Entrada total</th><th class="sai">Saídas total</th><th class="sal">Saldo atual</th></tr>` +
    r.filter(l => (l.descricao + " " + l.ca).toLowerCase().includes(f)).map(l =>
      `<tr class="${l.saldo <= 0 ? "zero" : ""}"><td class="n">${l.id}</td><td>${esc(l.descricao)}</td><td class="n">${esc(l.ca)}</td>
       <td class="n">${l.inicial}</td><td class="n ent">${l.entradas}</td><td class="n sai">${l.saidas}</td><td class="n sal">${l.saldo}</td></tr>`).join("");
}

function desenharMovs() {
  const f = $("busca-mov").value.toLowerCase(), mes = $("mes").value;
  $("tit-movs").textContent = "Movimentações – " + nomeMes(mes);
  const l = ordenar(DB.movimentos.filter(m => m.data.slice(0, 7) === mes)).filter(m => {
    const it = itemPorId(DB, m.item_id) || {};
    return [it.descricao, m.pessoa, m.destino, m.responsavel, m.obs, m.ca, m.tipo, m.nf_numero].join(" ").toLowerCase().includes(f);
  });
  $("t-movs").innerHTML = l.length ? cabMov(true) + l.map(m => linhaMov(m, true)).join("") : "<tr><td class='sub'>Nenhuma movimentação neste mês.</td></tr>";
}

function desenharItens() {
  const f = $("busca-item").value.toLowerCase();
  $("t-itens").innerHTML = `<tr><th>Nº</th><th>Descrição do EPI</th><th>C.A</th><th>Estoque inicial</th><th>Saldo atual</th><th></th></tr>` +
    DB.itens.filter(it => (it.descricao + " " + it.ca).toLowerCase().includes(f)).map(it =>
      `<tr><td class="n">${it.id}</td><td>${esc(it.descricao)}</td><td class="n">${esc(it.ca)}</td><td class="n">${it.estoque_base}</td>
       <td class="n sal">${saldoAtual(DB, it.id)}</td><td><button class="editar" onclick="editarItem(${it.id})">Editar</button></td></tr>`).join("");
}

function editarItem(id) {
  const it = itemPorId(DB, id);
  $("i-id").value = id;
  $("i-desc").value = it.descricao;
  $("i-ca").value = it.ca;
  $("i-base").value = it.estoque_base;
  $("tit-item").textContent = "Editar EPI nº " + id;
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("i-desc").focus();
}

function limparItem() {
  $("i-id").value = ""; $("i-desc").value = ""; $("i-ca").value = ""; $("i-base").value = 0;
  $("tit-item").textContent = "Cadastrar novo EPI";
}

async function salvarItem() {
  const desc = $("i-desc").value.trim().replace(/\s+/g, " ");
  if (!desc) return mostrar("Informe a descrição do EPI.", "err");
  const permitida = await prepararSalvamento();
  const dados = { descricao: desc, ca: $("i-ca").value.trim(), estoque_base: Math.floor(+$("i-base").value || 0) };
  if ($("i-id").value) Object.assign(itemPorId(DB, +$("i-id").value), dados);
  else DB.itens.push({ id: Math.max(0, ...DB.itens.map(i => i.id)) + 1, ...dados });
  gravarDB();
  limparItem();
  atualizarTela();
  await gerarExcel($("mes").value, permitida);
}

async function excluir(id) {
  if (!confirm("Excluir este lançamento? O estoque e a planilha serão recalculados.")) return;
  const permitida = await prepararSalvamento();
  const m = DB.movimentos.find(x => x.id === id);
  if (m && m.nf) {
    try { await idbApagar("anexos", id); } catch (e) {}
    await apagarNotaDrive(m);
  }
  DB.movimentos = DB.movimentos.filter(x => x.id !== id);
  gravarDB();
  atualizarTela();
  await gerarExcel($("mes").value, permitida);
}

async function alterarObra() {
  const n = prompt("Nome da obra:", DB.obra);
  if (!n || !n.trim()) return;
  DB.obra = n.trim();
  gravarDB();
  atualizarTela();
}

async function baixarBackup() {
  let anexos = {};
  try { anexos = await exportarAnexos(); } catch (e) { mostrar("Backup sem as notas fiscais: " + esc(e.message), "err"); }
  baixar(`backup_controle_epi_${hoje()}.json`, new Blob([JSON.stringify({ ...DB, anexos })], { type: "application/json" }));
}

async function restaurarBackup(arquivo) {
  try {
    const d = JSON.parse(await arquivo.text());
    if (!Array.isArray(d.itens) || !Array.isArray(d.movimentos)) throw new Error("arquivo inválido");
    if (!confirm(`Substituir os dados atuais por este backup (${d.itens.length} EPIs, ${d.movimentos.length} lançamentos, ${Object.keys(d.anexos || {}).length} notas fiscais)?`)) return;
    d.prox_mov = d.prox_mov || Math.max(0, ...d.movimentos.map(m => m.id)) + 1;
    const anexos = d.anexos;
    delete d.anexos;
    DB = completarDB(d);
    gravarDB();
    if (anexos) await importarAnexos(anexos);
    atualizarTela();
    mostrar("✔ Backup restaurado.");
  } catch (e) {
    mostrar("Não foi possível restaurar: " + e.message, "err");
  }
}

// ------------------------------------------------------------ inicio
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("ativo", x === b));
  document.querySelectorAll(".aba").forEach(a => a.classList.toggle("ativa", a.id === "aba-" + b.dataset.aba));
});
document.querySelectorAll("input[name=tipo]").forEach(r => r.onchange = ajustarTipo);
$("f-item").oninput = () => { const it = itemSelecionado(); if (it) $("f-ca").value = it.ca || ""; infoItem(); };
$("f-qtd").oninput = infoItem;
$("f-ca").oninput = infoItem;
$("mes").onchange = atualizarTela;
$("busca-est").oninput = desenharEstoque;
$("busca-mov").oninput = desenharMovs;
$("busca-item").oninput = desenharItens;
$("obra").onclick = alterarObra;
$("btn-salvar").onclick = salvarMov;
$("btn-limpar").onclick = limpar;
$("btn-item").onclick = salvarItem;
$("btn-item-cancelar").onclick = limparItem;
$("btn-exportar").onclick = async () => gerarExcel($("mes").value, await prepararSalvamento());
$("btn-pasta").onclick = escolherPasta;
$("btn-backup").onclick = baixarBackup;
$("btn-restaurar").onclick = () => $("arq-restaurar").click();
$("arq-restaurar").onchange = e => { if (e.target.files[0]) restaurarBackup(e.target.files[0]); e.target.value = ""; };
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.ctrlKey) salvarMov(); });
$("btn-config").onclick = salvarConfig;
$("f-nf-arq").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (f) definirAnexo(await lerArquivoNF(f)); };
$("f-nf-remover").onclick = () => definirAnexo(null);
$("arq-nf-depois").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) anexarNoMovimento(f); };
$("d-conectar").onclick = conectarDrive;
$("d-desconectar").onclick = desconectarDrive;
$("btn-importar-usados").onclick = importarUsados;
combo($("f-item"), () => DB.itens.map(rotulo));
combo($("f-pessoa"), opcoesPessoa);
combo($("f-destino"), opcoesDestino);
combo($("f-resp"), opcoesResp);
combo($("c-resp-padrao"), () => DB.listas.responsaveis);
combo($("c-dest-padrao"), () => DB.listas.destinos);

(async () => {
  DB = carregarDB();
  $("mes").value = hoje().slice(0, 7);
  limpar();
  ajustarTipo();
  atualizarTela();
  if (temPasta) {
    try { pastaHandle = await idb("ler") || null; } catch (e) { pastaHandle = null; }
  }
  mostrarAvisoPasta();
  desenharDrive();
  if (driveAtivo()) prepararLoginGoogle().catch(() => {});
  if (typeof ExcelJS === "undefined") mostrar("Sem internet: a geração do Excel não carregou. Os lançamentos continuam sendo salvos.", "err");
})();
