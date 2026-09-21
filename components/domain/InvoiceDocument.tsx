import path from "node:path"

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import type { ShopIdentity } from "@/lib/shop"

/**
 * The invoice, rendered by @react-pdf/renderer — no headless browser, so it runs
 * on Vercel's serverless runtime (CLAUDE.md section 2).
 *
 * The bundled font is not decoration: the PDF standard fonts have no ₹ glyph
 * (U+20B9), so an invoice set in Helvetica prints the shop's prices with a blank
 * where the currency should be. It is the same family the portal uses on screen,
 * so a printed bill and the order page look like the same shop.
 */
const FONT_FAMILY = "EncodeSansSemiExpanded"

let fontsRegistered = false

function registerFonts(): void {
  if (fontsRegistered) return
  const dir = path.join(process.cwd(), "assets", "fonts")
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: path.join(dir, "EncodeSansSemiExpanded-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "EncodeSansSemiExpanded-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "EncodeSansSemiExpanded-Bold.ttf"), fontWeight: 700 },
    ],
  })
  fontsRegistered = true
}

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
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
  invoiceMeta: { alignItems: "flex-end" },
  invoiceNo: { fontSize: 13, fontWeight: 700 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#666666",
    marginBottom: 4,
  },
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
  colGarment: { flex: 1 },
  colDue: { width: 72 },
  colQty: { width: 34, textAlign: "right" },
  colRate: { width: 66, textAlign: "right" },
  colAmount: { width: 74, textAlign: "right" },
  bold: { fontWeight: 600 },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 4,
    paddingTop: 6,
  },
  balance: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f4f4f4",
    marginTop: 6,
    padding: 6,
  },
  note: { marginTop: 4, fontSize: 9, color: "#666666" },
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

export interface InvoiceItem {
  garmentTypeName: string
  quantity: number
  rate: number
  dueDate: Date
  note?: string
}

export interface InvoiceProps {
  shop: ShopIdentity
  orderNo: string
  orderDate: Date
  customer: { name: string; phone: string }
  items: InvoiceItem[]
  subtotal: number
  discount: number
  total: number
  advancePaid: number
  balance: number
}

export function InvoiceDocument(props: InvoiceProps) {
  registerFonts()

  const {
    shop,
    orderNo,
    orderDate,
    customer,
    items,
    subtotal,
    discount,
    total,
    advancePaid,
    balance,
  } = props

  return (
    <Document
      title={`Invoice ${orderNo}`}
      author={shop.name}
      subject={`Invoice for ${customer.name}`}
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
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceNo}>{orderNo}</Text>
            <Text style={styles.muted}>
              {formatDate(orderDate, { withYear: true })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Billed to</Text>
          <Text style={styles.bold}>{customer.name}</Text>
          <Text style={styles.muted}>{formatPhone(customer.phone)}</Text>
        </View>

        <View>
          <View style={styles.tableHead}>
            <Text style={[styles.colGarment, styles.bold]}>Garment</Text>
            <Text style={[styles.colDue, styles.bold]}>Due</Text>
            <Text style={[styles.colQty, styles.bold]}>Qty</Text>
            <Text style={[styles.colRate, styles.bold]}>Rate</Text>
            <Text style={[styles.colAmount, styles.bold]}>Amount</Text>
          </View>

          {items.map((item, index) => (
            <View key={`${item.garmentTypeName}-${index}`} style={styles.row}>
              <View style={styles.colGarment}>
                <Text>{item.garmentTypeName}</Text>
                {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              </View>
              <Text style={styles.colDue}>{formatDate(item.dueDate)}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colRate}>{formatMoney(item.rate)}</Text>
              <Text style={styles.colAmount}>
                {formatMoney(item.rate * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatMoney(subtotal)}</Text>
          </View>

          {discount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Discount</Text>
              <Text>- {formatMoney(discount)}</Text>
            </View>
          ) : null}

          <View style={styles.grandTotal}>
            <Text style={styles.bold}>Total</Text>
            <Text style={styles.bold}>{formatMoney(total)}</Text>
          </View>

          {advancePaid > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Advance paid</Text>
              <Text>- {formatMoney(advancePaid)}</Text>
            </View>
          ) : null}

          <View style={styles.balance}>
            <Text style={styles.bold}>
              {balance < 0 ? "To refund" : "Balance due"}
            </Text>
            <Text style={styles.bold}>{formatMoney(Math.abs(balance))}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {shop.name}
          {shop.phone ? ` · ${formatPhone(shop.phone)}` : ""}
        </Text>
      </Page>
    </Document>
  )
}
