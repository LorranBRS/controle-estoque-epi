// Anexos (notas fiscais): guardados no IndexedDB do navegador, com uma imagem de previa para o Excel

const LIMITE_ANEXO_MB = 15;
const LARGURA_PREVIA = 1100;

// ------------------------------------------------------------ IndexedDB
function abrirIDB() {
  return new Promise((ok, falha) => {
    const req = indexedDB.open("controle_epi", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("cfg")) db.createObjectStore("cfg");
      if (!db.objectStoreNames.contains("anexos")) db.createObjectStore("anexos");
    };
    req.onerror = () => falha(req.error);
    req.onsuccess = () => ok(req.result);
  });
}

async function idbOp(loja, modo, fn) {
  const db = await abrirIDB();
  return new Promise((ok, falha) => {
    const tx = db.transaction(loja, modo);
    const r = fn(tx.objectStore(loja));
    tx.oncomplete = () => ok(r && r.result);
    tx.onerror = () => falha(tx.error);
  });
}
const idbLer = (loja, chave) => idbOp(loja, "readonly", st => st.get(chave));
const idbGravar = (loja, chave, valor) => idbOp(loja, "readwrite", st => st.put(valor, chave));
const idbApagar = (loja, chave) => idbOp(loja, "readwrite", st => st.delete(chave));
const idbChaves = loja => idbOp(loja, "readonly", st => st.getAllKeys());

// ------------------------------------------------------------ scripts externos sob demanda
const scriptsCarregados = {};
function carregarScript(url) {
  if (!scriptsCarregados[url]) {
    scriptsCarregados[url] = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = ok;
      s.onerror = () => { delete scriptsCarregados[url]; falha(new Error("sem internet para carregar " + url)); };
      document.head.appendChild(s);
    });
  }
  return scriptsCarregados[url];
}

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ------------------------------------------------------------ previa (imagem JPEG) do anexo
function canvasParaJpeg(canvas) {
  return new Promise(ok => canvas.toBlob(ok, "image/jpeg", 0.82));
}

async function previaImagem(arquivo) {
  const bmp = await createImageBitmap(arquivo);
  const esc = Math.min(1, LARGURA_PREVIA / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * esc);
  c.height = Math.round(bmp.height * esc);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return { blob: await canvasParaJpeg(c), largura: c.width, altura: c.height };
}

async function previaPdf(arquivo) {
  await carregarScript(PDFJS);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const pagina = await pdf.getPage(1);
  const base = pagina.getViewport({ scale: 1 });
  const vp = pagina.getViewport({ scale: LARGURA_PREVIA / base.width });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  // intent "print": nao depende de requestAnimationFrame (funciona mesmo com a aba em segundo plano)
  await pagina.render({ canvasContext: ctx, viewport: vp, intent: "print" }).promise;
  return { blob: await canvasParaJpeg(c), largura: c.width, altura: c.height, paginas: pdf.numPages };
}

// Le o arquivo escolhido e gera a previa. Retorna o objeto que vai para o IndexedDB.
async function prepararAnexo(arquivo) {
  if (arquivo.size > LIMITE_ANEXO_MB * 1024 * 1024) throw new Error(`arquivo maior que ${LIMITE_ANEXO_MB} MB`);
  const ehPdf = arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name);
  if (!ehPdf && !arquivo.type.startsWith("image/")) throw new Error("envie um PDF ou uma foto (JPG/PNG)");
  let previa = null;
  try {
    const limite = new Promise((_, falha) => setTimeout(() => falha(new Error("tempo esgotado")), 20000));
    previa = await Promise.race([ehPdf ? previaPdf(arquivo) : previaImagem(arquivo), limite]);
  } catch (e) {
    console.warn("Sem prévia do anexo:", e);
  }
  return {
    nome: arquivo.name, tipo: ehPdf ? "application/pdf" : arquivo.type, tamanho: arquivo.size,
    dados: arquivo, previa: previa && previa.blob, largura: previa && previa.largura, altura: previa && previa.altura,
    paginas: previa && previa.paginas
  };
}

// Nome do arquivo da NF dentro das pastas (local e Drive)
function nomeArquivoNF(m, anexo) {
  const ext = (anexo.nome.match(/\.[a-z0-9]{2,5}$/i) || [anexo.tipo === "application/pdf" ? ".pdf" : ".jpg"])[0].toLowerCase();
  const num = (m.nf_numero || "sem-numero").replace(/[^\w.-]+/g, "-");
  return `NF_${num}_${m.data}_lanc${m.id}${ext}`;
}

function abrirAnexo(anexo) {
  const url = URL.createObjectURL(anexo.dados);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ------------------------------------------------------------ backup (anexos em base64)
function blobParaDataURL(blob) {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => falha(r.error);
    r.readAsDataURL(blob);
  });
}
const dataURLParaBlob = async url => (await fetch(url)).blob();

async function exportarAnexos() {
  const saida = {};
  for (const k of await idbChaves("anexos")) {
    const a = await idbLer("anexos", k);
    saida[k] = { ...a, dados: await blobParaDataURL(a.dados), previa: a.previa ? await blobParaDataURL(a.previa) : null };
  }
  return saida;
}

async function importarAnexos(lista) {
  for (const [k, a] of Object.entries(lista || {})) {
    await idbGravar("anexos", +k, {
      ...a, dados: await dataURLParaBlob(a.dados), previa: a.previa ? await dataURLParaBlob(a.previa) : null
    });
  }
}
