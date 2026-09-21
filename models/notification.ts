import { Schema, model, models, type Model, type Types } from "mongoose"

import { NOTIFICATION_TYPES, type NotificationType } from "@/schemas/notification"

export interface NotificationDocument {
  type: NotificationType
  orderId: Types.ObjectId
  orderItemId?: Types.ObjectId
  dueAt: Date
  message: string
  isRead: boolean
  readBy?: Types.ObjectId
  readAt?: Date
  /**
   * Beyond CLAUDE.md section 5, and the reason the job is idempotent: one string
   * identifying "this reason, for this thing, on this day", with a unique index
   * behind it. Running the cron twice cannot produce a second copy.
   */
  dedupeKey: string
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderItemId: { type: Schema.Types.ObjectId },
    dueAt: { type: Date, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, required: true, default: false },
    readBy: { type: Schema.Types.ObjectId, ref: "User" },
    readAt: { type: Date },
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true }
)

notificationSchema.index({ dedupeKey: 1 }, { unique: true })

// The bell counts unread; the list shows newest first.
notificationSchema.index({ isRead: 1, createdAt: -1 })

export const Notification: Model<NotificationDocument> =
  (models.Notification as Model<NotificationDocument>) ??
  model<NotificationDocument>("Notification", notificationSchema)
