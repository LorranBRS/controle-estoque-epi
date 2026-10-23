// EPIs importados da planilha original (saldo de Setembro/26)
const ITENS_INICIAIS = [
 {
  "id": 1,
  "descricao": "Botina de Segurança em Couro nº39",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 2,
  "descricao": "Botina de Segurança em Couro nº40",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 3,
  "descricao": "Botina de Segurança em Couro nº41",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 4,
  "descricao": "Botina de Segurança em Couro nº42",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 5,
  "descricao": "Botina de Segurança em Couro nº43",
  "ca": "26.467",
  "estoque_base": 7
 },
 {
  "id": 6,
  "descricao": "Botina de Segurança em Couro nº44",
  "ca": "26.467",
  "estoque_base": 4
 },
 {
  "id": 7,
  "descricao": "Botina de Segurança em Couro nº46",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 8,
  "descricao": "Botina de Segurança Nobuck nº39",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 9,
  "descricao": "Botina de Segurança Nobuck nº40",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 10,
  "descricao": "Botina de Segurança Nobuck nº42",
  "ca": "43.698",
  "estoque_base": 0
 },
 {
  "id": 11,
  "descricao": "Botina de Segurança Nobuck nº43",
  "ca": "43.698",
  "estoque_base": 2
 },
 {
  "id": 12,
  "descricao": "Botina de Segurança Nobuck nº44",
  "ca": "43.698",
  "estoque_base": 1
 },
 {
  "id": 13,
  "descricao": "Capacete de Segurança",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 14,
  "descricao": "Carneira para capacete com jugular",
  "ca": "498",
  "estoque_base": 0
 },
 {
  "id": 15,
  "descricao": "Jugular",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 16,
  "descricao": "Cinto de Segurança paraquedista",
  "ca": "35.520",
  "estoque_base": 2
 },
 {
  "id": 17,
  "descricao": "Colete de Segurança Refletivo",
  "ca": "NBR 15,292",
  "estoque_base": 4
 },
 {
  "id": 18,
  "descricao": "Fardamento - Calça Jeans n° 38",
  "ca": "N/A",
  "estoque_base": 13
 },
 {
  "id": 19,
  "descricao": "Fardamento - Calça Jeans n° 40",
  "ca": "N/A",
  "estoque_base": 0
 },
 {
  "id": 20,
  "descricao": "Fardamento - Calça Jeans n° 42",
  "ca": "N/A",
  "estoque_base": 0
 },
 {
  "id": 21,
  "descricao": "Fardamento - Calça Jeans n° 44",
  "ca": "N/A",
  "estoque_base": 6
 },
 {
  "id": 22,
  "descricao": "Fardamento - Calça Jeans n° 46",
  "ca": "N/A",
  "estoque_base": 12
 },
 {
  "id": 23,
  "descricao": "Fardamento - Calça Jeans n°50",
  "ca": "N/A",
  "estoque_base": 4
 },
 {
  "id": 24,
  "descricao": "Fardamento - Calça Jeans n° 48",
  "ca": "N/A",
  "estoque_base": 2
 },
 {
  "id": 25,
  "descricao": "Fardamento Produção - Camisa G (ADM)",
  "ca": "N/A",
  "estoque_base": 3
 },
 {
  "id": 26,
  "descricao": "Fardamento Produção - Camisa EXG",
  "ca": "N/A",
  "estoque_base": 0
 },
 {
  "id": 27,
  "descricao": "Fardamento Produção - Camisa G",
  "ca": "N/A",
  "estoque_base": 4
 },
 {
  "id": 28,
  "descricao": "Fardamento Produção - Camisa M",
  "ca": "N/A",
  "estoque_base": 12
 },
 {
  "id": 29,
  "descricao": "Fardamento Produção - Camisa P",
  "ca": "N/A",
  "estoque_base": 6
 },
 {
  "id": 30,
  "descricao": "Fardamento - Jaqueta impermeável com faixa refletivo - L",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 31,
  "descricao": "Fardamento - Jaqueta impermeável com faixa refletivo - S",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 32,
  "descricao": "Fardamento - Jaqueta impermeável com faixa refletivo - M",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 33,
  "descricao": "Luva de segurança cano longo para Soldador",
  "ca": "28.750",
  "estoque_base": 2
 },
 {
  "id": 34,
  "descricao": "Luva de segurança de cano curto vaqueta de couro",
  "ca": "50.295",
  "estoque_base": 33
 },
 {
  "id": 35,
  "descricao": "Máscara Respiratoria descartável com valvula – PFF2",
  "ca": "38.503",
  "estoque_base": 333
 },
 {
  "id": 36,
  "descricao": "Óculos Segurança -Lente Escura",
  "ca": "48.017",
  "estoque_base": 24
 },
 {
  "id": 37,
  "descricao": "Perneira de raspa de couro",
  "ca": "13.990",
  "estoque_base": 0
 },
 {
  "id": 38,
  "descricao": "Protetor Auricular - Tipo Concha",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 39,
  "descricao": "Protetor Auricular - Tipo Plug",
  "ca": "18.190",
  "estoque_base": 32
 },
 {
  "id": 40,
  "descricao": "Protetor Facial",
  "ca": "",
  "estoque_base": 0
 },
 {
  "id": 41,
  "descricao": "Talabartes duplo com absorvedor de impacto",
  "ca": "40.196",
  "estoque_base": 0
 },
 {
  "id": 42,
  "descricao": "Vestimentas couro/ Raspa - Avental",
  "ca": "49.523",
  "estoque_base": 2
 },
 {
  "id": 43,
  "descricao": "Vestimentas couro/ Raspa - Avental com manga de raspa de couro",
  "ca": "",
  "estoque_base": 1
 },
 {
  "id": 44,
  "descricao": "Máscara de solda sem lente",
  "ca": "",
  "estoque_base": 0
 }
];
