import { renderToBuffer } from "@react-pdf/renderer"
import { isValidObjectId } from "mongoose"
import { NextResponse } from "next/server"

import { InvoiceDocument } from "@/components/domain/InvoiceDocument"
import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { readShopIdentity } from "@/lib/shop"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"

/**
 * The invoice as a PDF. @react-pdf/renderer draws it directly — no headless
 * browser, so this runs on Vercel's serverless runtime (CLAUDE.md section 2).
 */
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("owner", "staff")
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const { id } = await params
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await connectToDatabase()
  const order = await Order.findOne({ _id: id, isDeleted: false }).lean()
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const customer = await Customer.findById(order.customerId)
    .select({ name: 1, phone: 1 })
    .lean()

  const pdf = await renderToBuffer(
    InvoiceDocument({
      shop: readShopIdentity(),
      orderNo: order.orderNo,
      orderDate: order.createdAt,
      customer: {
        name: customer?.name ?? "Customer",
        phone: customer?.phone ?? "",
      },
      items: order.items.map((item) => ({
        garmentTypeName: item.garmentTypeName,
        quantity: item.quantity,
        rate: item.rate,
        dueDate: item.dueDate,
        note: item.note,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      advancePaid: order.advancePaid,
      balance: order.balance,
    })
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` so tapping the button previews it; the browser still offers save.
      "Content-Disposition": `inline; filename="${order.orderNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
