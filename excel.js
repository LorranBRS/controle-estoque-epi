// Geracao das planilhas Excel (mesmo layout da planilha original, com logo e cores)

const MESES_ARQ = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const nomeMesArq = mes => `${MESES_ARQ[+mes.slice(5) - 1]}-${mes.slice(2, 4)}`;

const FINO = { style: "thin", color: { argb: "FF808080" } };
const BORDA = { top: FINO, left: FINO, bottom: FINO, right: FINO };
const preenche = cor => ({ type: "pattern", pattern: "solid", fgColor: { argb: "FF" + cor } });
const CAB = preenche("1F4E78"), ZEBRA = preenche("EAF1FB"), ALERTA = preenche("FDE2E1");
// colunas Entrada (verde), Saida (vermelho) e Saldo (azul)
const CORES = { 5: "1E7B34", 6: "C0392B", 7: "1F5FBF" };

function abaResumo(wb, db, mes, logoId) {
  const ws = wb.addWorksheet(nomeMesArq(mes), {
    views: [{ state: "frozen", ySplit: 3 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:3" }
  });
  [6, 48, 14, 16, 12, 12, 12].forEach((w, i) => ws.getColumn(i + 1).width = w);

  ws.mergeCells("A1:G1");
  const t = ws.getCell("A1");
  t.value = "CONTROLE DE ESTOQUE DE EPI";
  t.font = { bold: true, size: 14 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 66;
  ws.addImage(logoId, { tl: { col: 0.05, row: 0.05 }, ext: { width: 176, height: 75 } });

  ws.mergeCells("A2:D2");
  ws.mergeCells("E2:G2");
  ws.getCell("A2").value = `Obra: ${db.obra}`;
  ws.getCell("E2").value = `Mês: ${MESES_PT[+mes.slice(5) - 1]}-${mes.slice(2, 4)}`;
  ws.getCell("A2").font = ws.getCell("E2").font = { bold: true };

  const cab = ["Nº", "Descrição do EPI", "C.A", "Quantidade estoque\natualizado",
    "Entrada Total", "Saídas Total", "Saldo Atual"];
  const r3 = ws.getRow(3);
  r3.height = 44;
  cab.forEach((txt, i) => {
    const c = r3.getCell(i + 1);
    c.value = txt;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = CORES[i + 1] ? preenche(CORES[i + 1]) : CAB;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDA;
  });

  resumoMes(db, mes).forEach((l, i) => {
    const r = 4 + i, row = ws.getRow(r);
    [l.id, l.descricao, l.ca, l.inicial, l.entradas, l.saidas].forEach((v, j) => row.getCell(j + 1).value = v);
    row.getCell(7).value = { formula: `D${r}+E${r}-F${r}`, result: l.saldo };
    for (let col = 1; col <= 7; col++) {
      const c = row.getCell(col);
      c.border = BORDA;
      if (col !== 2) c.alignment = { horizontal: "center" };
      if (l.saldo <= 0) c.fill = ALERTA;
      else if (i % 2) c.fill = ZEBRA;
      if (CORES[col]) c.font = { bold: true, color: { argb: "FF" + CORES[col] } };
    }
  });
}

function abaMovimentos(wb, db, titulo, movs) {
  const ws = wb.addWorksheet(titulo, { views: [{ state: "frozen", ySplit: 1 }] });
  const cab = ["Data", "Tipo", "Nº", "Descrição do EPI", "C.A", "Quantidade",
    "Retirado por / Fornecedor", "Destino (para onde)", "Responsável", "Mês", "Observação"];
  [12, 10, 6, 44, 12, 11, 26, 22, 20, 13, 30].forEach((w, i) => ws.getColumn(i + 1).width = w);
  const r1 = ws.getRow(1);
  cab.forEach((txt, i) => {
    const c = r1.getCell(i + 1);
    c.value = txt;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = CAB;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDA;
  });
  [...movs].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id).forEach((m, i) => {
    const it = itemPorId(db, m.item_id);
    const [a, me, d] = m.data.split("-").map(Number);
    const vals = [new Date(Date.UTC(a, me - 1, d)), m.tipo, m.item_id, it ? it.descricao : "?", m.ca || "",
      m.quantidade, m.pessoa || "", m.destino || "", m.responsavel || "", nomeMesArq(m.data.slice(0, 7)), m.obs || ""];
    const row = ws.getRow(2 + i);
    vals.forEach((v, j) => {
      const c = row.getCell(j + 1);
      c.value = v;
      c.border = BORDA;
      if (j === 0) c.numFmt = "dd/mm/yyyy";
      if (j === 1) c.font = { bold: true, color: { argb: v === "Entrada" ? "FF1E7B34" : "FFB42318" } };
    });
  });
  if (movs.length) ws.autoFilter = `A1:K${movs.length + 1}`;
}

function base64ParaBytes(b64) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function montarPlanilha(db, mesFoco) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Controle de Estoque de EPI";
  const logoId = wb.addImage({ buffer: base64ParaBytes(LOGO_BASE64), extension: "png" });
  const meses = new Set(db.movimentos.map(m => m.data.slice(0, 7)));
  meses.add(mesFoco);
  meses.add(hoje().slice(0, 7));
  abaResumo(wb, db, mesFoco, logoId);
  abaMovimentos(wb, db, `Mov ${nomeMesArq(mesFoco)}`, db.movimentos.filter(m => m.data.slice(0, 7) === mesFoco));
  [...meses].sort().reverse().filter(m => m !== mesFoco).forEach(m => abaResumo(wb, db, m, logoId));
  abaMovimentos(wb, db, "Todas Movimentacoes", db.movimentos);
  return new Blob([await wb.xlsx.writeBuffer()],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
