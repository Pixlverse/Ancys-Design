import { Schema, model, models, type InferSchemaType, type Model } from "mongoose"

/**
 * Someone the shop gives work to. No password, no session — they exist so a
 * garment can be assigned and so staff can ring them.
 */
const assigneeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** E.164 when given. Optional: a name alone is enough to assign work. */
    phone: { type: String, trim: true },
    isActive: { type: Boolean, required: true, default: true },
    isDeleted: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// Two live assignees must not share a name — a shop calling out "give it to
// Rajan" needs exactly one Rajan.
assigneeSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { isDeleted: false },
  }
)

export type AssigneeDocument = InferSchemaType<typeof assigneeSchema>

export const Assignee: Model<AssigneeDocument> =
  (models.Assignee as Model<AssigneeDocument>) ??
  model<AssigneeDocument>("Assignee", assigneeSchema)
