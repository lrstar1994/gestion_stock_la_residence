import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import type { ChartRow, DirectionDashboard, TimelineRow } from './dashboard'
import { formatMoney, formatPercent } from './dashboard'

export function exportDashboardToExcel(dashboard: DirectionDashboard, name = 'dashboard-direction') {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { indicateur: 'Valeur totale du stock', valeur: dashboard.kpis.stockValue },
    { indicateur: 'Articles en stock', valeur: dashboard.kpis.stockArticles },
    { indicateur: 'Articles sous seuil', valeur: dashboard.kpis.lowStockArticles },
    { indicateur: 'Achats du mois', valeur: dashboard.kpis.monthlyPurchases },
    { indicateur: 'Decaissements en cours', valeur: dashboard.kpis.activeCashAdvancesAmount },
    { indicateur: 'Factures a payer', valeur: dashboard.kpis.invoicesToPay },
    { indicateur: 'Factures en retard', valeur: dashboard.kpis.overdueInvoices },
    { indicateur: 'CA du jour', valeur: dashboard.kpis.todayRevenue },
    { indicateur: 'CA du mois', valeur: dashboard.kpis.monthlyRevenue },
    { indicateur: 'Marge brute estimee', valeur: dashboard.kpis.estimatedGrossMargin },
    { indicateur: 'Taux de marge moyen', valeur: dashboard.kpis.averageMarginRate },
  ]), 'KPI')
  appendRows(workbook, 'Stock famille', dashboard.stock.valueByFamily)
  appendRows(workbook, 'Stock localisation', dashboard.stock.valueByLocation)
  appendRows(workbook, 'Achats fournisseur', dashboard.purchases.bySupplier)
  appendRows(workbook, 'Achats famille', dashboard.purchases.byFamily)
  appendRows(workbook, 'Ventes point', dashboard.sales.byPoint)
  appendRows(workbook, 'Ventes canal', dashboard.sales.byChannel)
  appendRows(workbook, 'Ventes famille', dashboard.sales.byFamily)
  appendRows(workbook, 'Marge evolution', dashboard.finance.marginEvolution)
  XLSX.writeFile(workbook, `${name}.xlsx`)
}

export function exportDashboardToPdf(dashboard: DirectionDashboard, name = 'dashboard-direction') {
  const pdf = new jsPDF()
  pdf.setFontSize(16)
  pdf.text('Tableau de bord Direction - La Residence', 14, 18)
  pdf.setFontSize(10)
  pdf.text(`Periode : ${dashboard.period.from} au ${dashboard.period.to}`, 14, 26)
  const lines = [
    `Valeur totale du stock : ${formatMoney(dashboard.kpis.stockValue)}`,
    `Articles sous seuil : ${dashboard.kpis.lowStockArticles}`,
    `Achats du mois : ${formatMoney(dashboard.kpis.monthlyPurchases)}`,
    `Decaissements en cours : ${formatMoney(dashboard.kpis.activeCashAdvancesAmount)}`,
    `Factures a payer : ${dashboard.kpis.invoicesToPay}`,
    `Factures en retard : ${dashboard.kpis.overdueInvoices}`,
    `CA du jour : ${formatMoney(dashboard.kpis.todayRevenue)}`,
    `CA du mois : ${formatMoney(dashboard.kpis.monthlyRevenue)}`,
    `Marge brute estimee : ${formatMoney(dashboard.kpis.estimatedGrossMargin)}`,
    `Taux de marge moyen : ${formatPercent(dashboard.kpis.averageMarginRate)}`,
  ]
  lines.forEach((line, index) => pdf.text(line, 14, 40 + index * 8))
  pdf.save(`${name}.pdf`)
}

function appendRows(workbook: XLSX.WorkBook, sheetName: string, rows: Array<ChartRow | TimelineRow>) {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.map((row) => ({ libelle: row.label, valeur: row.value }))), sheetName.slice(0, 31))
}
