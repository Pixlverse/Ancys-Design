"use server"

import { revalidatePath } from "next/cache"
import { isValidObjectId } from "mongoose"

import { AuthorizationError, requireSession } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { Notification } from "@/models/notification"

export async function markNotificationRead(formData: FormData): Promise<void> {
  try {
    const session = await requireSession()
    const id = String(formData.get("id") ?? "")
    if (!isValidObjectId(id)) return

    await connectToDatabase()
    await Notification.updateOne(
      { _id: id, isRead: false },
      { $set: { isRead: true, readBy: session.user.id, readAt: new Date() } }
    )

    revalidatePath("/notifications")
  } catch (error) {
    if (error instanceof AuthorizationError) return
    throw error
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const session = await requireSession()

    await connectToDatabase()
    await Notification.updateMany(
      { isRead: false },
      { $set: { isRead: true, readBy: session.user.id, readAt: new Date() } }
    )

    revalidatePath("/notifications")
  } catch (error) {
    if (error instanceof AuthorizationError) return
    throw error
  }
}
