import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"

import { MonthlyReportDocument } from "@/components/domain/MonthlyReportDocument"
import { AuthorizationError, requireRole } from "@/lib/auth"
import { parseDateInputIST, toDateInputIST } from "@/lib/dates"
import { loadMonthlyReport } from "@/lib/reports/monthly"
import { readShopIdentity } from "@/lib/shop"

/**
 * The month-end sales report as a PDF. Owner-only: it is the shop's takings.
 */
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole("owner")
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  // `?month=2026-09`, defaulting to the month we are in.
  const month = new URL(request.url).searchParams.get("month")
  const anchor = month ? parseDateInputIST(`${month}-01`) : null
  const report = await loadMonthlyReport(anchor ?? new Date())

  const shop = readShopIdentity()
  const pdf = await renderToBuffer(
    MonthlyReportDocument({ shop, report, generatedAt: new Date() })
  )

  // `report.start` is midnight IST, which in UTC still sits in the previous month.
  const label = toDateInputIST(report.start).slice(0, 7)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ancys-sales-${label}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
