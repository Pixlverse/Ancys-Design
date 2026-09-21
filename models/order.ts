import { Schema, model, models, type Model, type Types } from "mongoose"

import {
  CLOTH_SOURCES,
  WORK_TYPES,
  ORDER_IMAGE_KINDS,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  type ClothSource,
  type WorkType,
  type OrderImageKind,
  type OrderItemStatus,
  type OrderStatus,
} from "@/schemas/order"

export interface OrderImage {
  url: string
  publicId: string
  kind: OrderImageKind
}

/**
 * Items are embedded: they are never read without their order, and they carry
 * snapshots that must not drift. `garmentTypeName` and `rate` are copied at
 * order time, so editing the rate card later cannot reprice history
 * (CLAUDE.md section 5).
 */
export interface OrderItem {
  _id: Types.ObjectId
  garmentTypeId: Types.ObjectId
  garmentTypeName: string
  /** Integer paise, snapshotted. */
  rate: number
  quantity: number
  measurementSetId?: Types.ObjectId
  /** Stitching work, or design only — see schemas/order.ts. */
  workType: WorkType
  /** Metres of cloth. Absent on design-only work. */
  clothLength?: number
  /** Absent on design-only work, where no cloth is involved. */
  clothSource?: ClothSource
  images: OrderImage[]
  note?: string
  dueDate: Date
  itemStatus: OrderItemStatus
  /** An Assignee, not a User — see models/assignee.ts. */
  assignedTo?: Types.ObjectId
}

export interface OrderConfirmation {
  sentAt?: Date
  channel?: string
  /** Random 32 characters. Never the order id — see CLAUDE.md section 7. */
  publicToken?: string
  viewedAt?: Date
  /** When the customer answered on the public page, either way. */
  respondedAt?: Date
  /** What they typed when asking for a change or declining. Their words. */
  customerNote?: string
  confirmedAt?: Date
  /** When the final bill was sent — the second message, after confirmation. */
  billSentAt?: Date
  confirmedBy?: string
  rawResponse?: string
}

/**
 * Every status change, who made it and when. Added beyond CLAUDE.md section 5
 * because 2.4 requires transitions to record who and when, and there was no
 * field for it. `itemId` is set when a single garment moved rather than the order.
 */
export interface OrderStatusChange {
  from: string
  to: string
  at: Date
  by: Types.ObjectId
  itemId?: Types.ObjectId
  note?: string
}

export interface OrderDocument {
  orderNo: string
  customerId: Types.ObjectId
  status: OrderStatus
  items: OrderItem[]
  /** All integer paise (rule 1). */
  subtotal: number
  discount: number
  total: number
  advancePaid: number
  balance: number
  confirmation: OrderConfirmation
  statusHistory: OrderStatusChange[]
  /** Latest item due date, denormalised for the calendar and the list. */
  promisedDate?: Date
  isDeleted: boolean
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const orderImageSchema = new Schema<OrderImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    kind: { type: String, enum: ORDER_IMAGE_KINDS, required: true },
  },
  { _id: false }
)

const orderItemSchema = new Schema<OrderItem>({
  garmentTypeId: {
    type: Schema.Types.ObjectId,
    ref: "GarmentType",
    required: true,
  },
  garmentTypeName: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  measurementSetId: { type: Schema.Types.ObjectId, ref: "MeasurementSet" },
  workType: {
    type: String,
    enum: WORK_TYPES,
    required: true,
    default: "stitching",
  },
  clothLength: { type: Number, min: 0 },
  clothSource: { type: String, enum: CLOTH_SOURCES },
  images: { type: [orderImageSchema], default: [] },
  note: { type: String, trim: true },
  dueDate: { type: Date, required: true },
  itemStatus: {
    type: String,
    enum: ORDER_ITEM_STATUSES,
    required: true,
    default: "pending",
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: "Assignee" },
})

const orderConfirmationSchema = new Schema<OrderConfirmation>(
  {
    sentAt: { type: Date },
    channel: { type: String },
    publicToken: { type: String },
    viewedAt: { type: Date },
    respondedAt: { type: Date },
    customerNote: { type: String },
    confirmedAt: { type: Date },
    billSentAt: { type: Date },
    confirmedBy: { type: String },
    rawResponse: { type: String },
  },
  { _id: false }
)

const orderStatusChangeSchema = new Schema<OrderStatusChange>(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemId: { type: Schema.Types.ObjectId },
    note: { type: String },
  },
  { _id: false }
)

const orderSchema = new Schema<OrderDocument>(
  {
    orderNo: { type: String, required: true, trim: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: "draft",
    },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    advancePaid: { type: Number, required: true, default: 0 },
    balance: { type: Number, required: true, default: 0 },
    confirmation: {
      type: orderConfirmationSchema,
      required: true,
      default: () => ({}),
    },
    statusHistory: { type: [orderStatusChangeSchema], default: [] },
    promisedDate: { type: Date },
    isDeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// The counter makes collisions impossible; this makes them unstorable.
orderSchema.index({ orderNo: 1 }, { unique: true })

// The orders list: soonest due first, filtered by status.
orderSchema.index({ isDeleted: 1, status: 1, promisedDate: 1 })

// A customer's own orders, newest first.
orderSchema.index({ customerId: 1, createdAt: -1 })

// The public order page looks an order up by token alone.
orderSchema.index(
  { "confirmation.publicToken": 1 },
  { unique: true, sparse: true }
)

// The calendar asks for every item due inside a window.
orderSchema.index({ isDeleted: 1, "items.dueDate": 1 })

export const Order: Model<OrderDocument> =
  (models.Order as Model<OrderDocument>) ??
  model<OrderDocument>("Order", orderSchema)
