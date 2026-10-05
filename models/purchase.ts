import { Schema, model, models, type Model, type Types } from "mongoose"

/** See schemas/purchase.ts — a shop expense, never part of a customer's bill. */
export interface PurchaseLine {
  description: string
  /** Integer paise. */
  amount: number
}

export interface BillImage {
  url: string
  publicId: string
}

export interface PurchaseDocument {
  /** The IST day it was bought. */
  purchasedOn: Date
  lines: PurchaseLine[]
  /** Integer paise, the sum of the lines. */
  total: number
  vendor?: string
  paidBy?: string
  billImages: BillImage[]
  /** Reference tags only. */
  orderId?: Types.ObjectId
  /** Snapshotted so the list can show and search it without a lookup. */
  orderNo?: string
  customerId?: Types.ObjectId
  notes?: string
  isDeleted: boolean
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const purchaseLineSchema = new Schema<PurchaseLine>(
  {
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
  },
  { _id: false }
)

const billImageSchema = new Schema<BillImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
)

const purchaseSchema = new Schema<PurchaseDocument>(
  {
    purchasedOn: { type: Date, required: true },
    lines: { type: [purchaseLineSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    vendor: { type: String, trim: true },
    paidBy: { type: String, trim: true },
    billImages: { type: [billImageSchema], default: [] },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    orderNo: { type: String, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    notes: { type: String, trim: true },
    isDeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// The list and the report both read live purchases newest-first by day.
purchaseSchema.index({ isDeleted: 1, purchasedOn: -1 })
purchaseSchema.index({ orderId: 1 }, { sparse: true })
purchaseSchema.index({ customerId: 1 }, { sparse: true })

export const Purchase: Model<PurchaseDocument> =
  (models.Purchase as Model<PurchaseDocument>) ??
  model<PurchaseDocument>("Purchase", purchaseSchema)
