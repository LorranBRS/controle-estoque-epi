# Controle de Estoque de EPI – Oliveira Montagem

Sistema web para controle de estoque de EPI (Obra Fábrica do Samba – RJ). Roda 100% no navegador, sem servidor.

**Acesso:** https://lorranbrs.github.io/controle-estoque-epi/

## Funções
- **Lançar entrada / saída**: EPI, C.A, quantidade, data, quem retirou, destino, responsável e observação.
- **Estoque do mês**: Qtd. estoque atualizado, Entrada total (verde), Saídas total (vermelho) e Saldo atual (azul).
- **Movimentações**: lançamentos do mês, com busca e exclusão.
- **Cadastro de EPIs**: incluir e editar EPIs, C.A e estoque inicial.
- **Configurações**: listas de pessoas que retiram, responsáveis, destinos e fornecedores, além de responsável e
  destino padrão. Nos lançamentos, os campos mostram a lista ao clicar, mas sempre aceitam um nome digitado à mão
  (que pode ser adicionado à lista automaticamente).
- **Planilhas e backup**: pasta das planilhas Excel, Google Drive e backup/restauração dos dados.
- **Nota fiscal nas compras**: nas entradas, informe o nº da NF e anexe o PDF ou a foto. A NF aparece na aba
  "Notas Fiscais" do Excel (imagem da 1ª página) e na coluna "Anexo NF" com link para o arquivo original.
  Também é possível anexar a NF depois, pela aba Movimentações.

## Planilhas Excel
Cada salvamento gera a planilha com a logo da empresa e o mesmo layout da planilha original.
- **Chrome/Edge no computador:** escolha uma pasta uma vez; o sistema atualiza `Controle_EPI_<Mês>.xlsx`
  (um arquivo por mês) e `CONTROLE_ESTOQUE_EPI.xlsx` (todos os meses).
- **Outros navegadores/celular:** a planilha do mês é baixada a cada salvamento.

## Google Drive
Na aba **Planilhas e backup → Google Drive**, informe o ID do cliente OAuth do Google (passo a passo na própria tela)
e clique em **Conectar**. A cada salvamento o sistema atualiza os mesmos arquivos na pasta
`Controle de Estoque EPI` do Drive e envia as notas fiscais para `Controle de Estoque EPI/Notas Fiscais`.
O acesso usa a permissão `drive.file`: o sistema só enxerga os arquivos que ele mesmo criou.

## Dados
Os lançamentos ficam salvos no navegador do computador onde foram feitos (localStorage).
Use **Baixar backup** com frequência; o mesmo arquivo serve para **Restaurar** em outro computador.
Também aceita o arquivo `dados/banco_estoque.json` da versão executável.

## Arquivos
`index.html` (telas) · `style.css` (visual) · `app.js` (lógica) · `excel.js` (geração do Excel com ExcelJS) ·
`anexos.js` (notas fiscais) · `drive.js` (Google Drive) ·
`dados_iniciais.js` (EPIs importados do saldo de Setembro/26) · `logo.js` / `logo.png` (logo).
