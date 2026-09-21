import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { PDF_FONT_FAMILY, registerPdfFonts } from "./pdf-fonts"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels"
import { formatPhone } from "@/lib/phone"
import type { MonthlyReport } from "@/lib/reports/monthly"
import type { ShopIdentity } from "@/lib/shop"

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    fontWeight: 400,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d4",
    paddingBottom: 12,
    marginBottom: 18,
  },
  shopName: { fontSize: 17, fontWeight: 700, letterSpacing: -0.2 },
  muted: { color: "#666666" },
  title: { fontSize: 13, fontWeight: 700 },
  right: { alignItems: "flex-end" },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#666666",
    marginTop: 16,
    marginBottom: 6,
  },
  tiles: { flexDirection: "row", gap: 10, marginBottom: 4 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    padding: 10,
  },
  tileValue: { fontSize: 15, fontWeight: 700 },
  tileLabel: { fontSize: 8, color: "#666666", marginTop: 2 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 5,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ededed",
    paddingVertical: 6,
  },
  totalRow: { flexDirection: "row", paddingTop: 8, fontWeight: 700 },
  colName: { flex: 1 },
  colNum: { width: 70, textAlign: "right" },
  colMoney: { width: 90, textAlign: "right" },
  bold: { fontWeight: 600 },
  note: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
    padding: 10,
    fontSize: 8,
    color: "#666666",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999999",
  },
})

export interface MonthlyReportProps {
  shop: ShopIdentity
  report: MonthlyReport
  generatedAt: Date
}

export function MonthlyReportDocument({
  shop,
  report,
  generatedAt,
}: MonthlyReportProps) {
  registerPdfFonts()

  const monthLabel = formatDate(report.start, { withYear: true }).replace(
    /^\d+\s/,
    ""
  )

  return (
    <Document
      title={`Sales report ${monthLabel}`}
      author={shop.name}
      subject={`Monthly sales report for ${monthLabel}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.shopName}>{shop.name}</Text>
            {shop.address ? (
              <Text style={styles.muted}>{shop.address}</Text>
            ) : null}
            {shop.phone ? (
              <Text style={styles.muted}>{formatPhone(shop.phone)}</Text>
            ) : null}
          </View>
          <View style={styles.right}>
            <Text style={styles.title}>Sales report</Text>
            <Text style={styles.muted}>{monthLabel}</Text>
            <Text style={styles.muted}>
              {formatDate(report.start)} – {formatDate(report.end)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>The month at a glance</Text>
        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{formatMoney(report.netBilled)}</Text>
            <Text style={styles.tileLabel}>Billed</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{formatMoney(report.collected)}</Text>
            <Text style={styles.tileLabel}>Collected</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>
              {formatMoney(report.outstanding)}
            </Text>
            <Text style={styles.tileLabel}>Still to collect</Text>
          </View>
        </View>
        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{report.ordersTaken}</Text>
            <Text style={styles.tileLabel}>Orders taken</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{report.garments}</Text>
            <Text style={styles.tileLabel}>Garments</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{report.deliveredInMonth}</Text>
            <Text style={styles.tileLabel}>Orders delivered</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{report.newCustomers}</Text>
            <Text style={styles.tileLabel}>New customers</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>What was made</Text>
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.colName, styles.bold]}>Garment</Text>
            <Text style={[styles.colNum, styles.bold]}>Orders</Text>
            <Text style={[styles.colNum, styles.bold]}>Quantity</Text>
            <Text style={[styles.colMoney, styles.bold]}>Revenue</Text>
          </View>

          {report.byGarment.length === 0 ? (
            <Text style={[styles.row, styles.muted]}>
              Nothing was ordered this month.
            </Text>
          ) : (
            report.byGarment.map((line) => (
              <View key={line.garmentTypeName} style={styles.row}>
                <Text style={styles.colName}>{line.garmentTypeName}</Text>
                <Text style={styles.colNum}>{line.items}</Text>
                <Text style={styles.colNum}>{line.quantity}</Text>
                <Text style={styles.colMoney}>{formatMoney(line.revenue)}</Text>
              </View>
            ))
          )}

          {report.byGarment.length > 0 ? (
            <View style={styles.totalRow}>
              <Text style={[styles.colName, styles.bold]}>Total</Text>
              <Text style={[styles.colNum, styles.bold]}>
                {report.byGarment.reduce((sum, l) => sum + l.items, 0)}
              </Text>
              <Text style={[styles.colNum, styles.bold]}>{report.garments}</Text>
              <Text style={[styles.colMoney, styles.bold]}>
                {formatMoney(report.gross)}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Where the money went</Text>
        <View>
          <View style={styles.row}>
            <Text style={styles.colName}>Gross, before discount</Text>
            <Text style={styles.colMoney}>{formatMoney(report.gross)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colName}>Discounts given</Text>
            <Text style={styles.colMoney}>
              - {formatMoney(report.discounts)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.colName, styles.bold]}>Billed</Text>
            <Text style={[styles.colMoney, styles.bold]}>
              {formatMoney(report.netBilled)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.colName}>Collected so far</Text>
            <Text style={styles.colMoney}>{formatMoney(report.collected)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.colName, styles.bold]}>Still to collect</Text>
            <Text style={[styles.colMoney, styles.bold]}>
              {formatMoney(report.outstanding)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Orders by status</Text>
        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.colName, styles.bold]}>Status</Text>
            <Text style={[styles.colNum, styles.bold]}>Orders</Text>
            <Text style={[styles.colMoney, styles.bold]}>Value</Text>
          </View>
          {report.byStatus.map((line) => (
            <View key={line.status} style={styles.row}>
              <Text style={styles.colName}>
                {ORDER_STATUS_LABELS[line.status]}
              </Text>
              <Text style={styles.colNum}>{line.orders}</Text>
              <Text style={styles.colMoney}>{formatMoney(line.value)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <Text>
            Covers orders taken between {formatDate(report.start, { withYear: true })} and{" "}
            {formatDate(report.end, { withYear: true })}. Cancelled orders are
            excluded.
          </Text>
          <Text>
            &quot;Collected&quot; is money received against orders taken this
            month, not cash received during the month — a payment made now on an
            older order counts against that older month.
          </Text>
          {report.designOnlyItems > 0 ? (
            <Text>
              {report.designOnlyItems} item
              {report.designOnlyItems === 1 ? " was" : "s were"} design work only.
            </Text>
          ) : null}
        </View>

        <Text style={styles.footer} fixed>
          {shop.name}
          {shop.phone ? ` · ${formatPhone(shop.phone)}` : ""} · generated{" "}
          {formatDate(generatedAt, { withYear: true })}
        </Text>
      </Page>
    </Document>
  )
}
