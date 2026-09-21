import { Schema, model, models, type InferSchemaType, type Model } from "mongoose"

import { CUSTOMER_STATUSES } from "@/schemas/customer"

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** E.164, the identity key for this customer (CLAUDE.md rule 2). */
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: CUSTOMER_STATUSES,
      required: true,
      default: "lead",
    },
    isDeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// Unique on phone, but only among live records — soft-deleting a customer must
// not permanently burn their number (rule 4).
customerSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)

// Name search is a prefix/substring regex; this at least keeps the scan ordered.
customerSchema.index({ name: 1 })

export type CustomerDocument = InferSchemaType<typeof customerSchema>

export const Customer: Model<CustomerDocument> =
  (models.Customer as Model<CustomerDocument>) ??
  model<CustomerDocument>("Customer", customerSchema)
