"use server"

import { revalidatePath } from "next/cache"
import { isValidObjectId } from "mongoose"
import { z } from "zod"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { Assignee } from "@/models/assignee"
import { assigneeInputSchema } from "@/schemas/assignee"

const LIST_PATH = "/settings/assignees"

export interface AssigneeFormState {
  error?: string
  fieldErrors?: Record<string, string>
  added?: string
}

export async function createAssignee(
  _previous: AssigneeFormState,
  formData: FormData
): Promise<AssigneeFormState> {
  try {
    const session = await requireRole("owner", "staff")

    const parsed = assigneeInputSchema.safeParse({
      name: formData.get("name"),
      phone: formData.get("phone"),
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".") || "form"] ??= issue.message
      }
      return { fieldErrors }
    }

    await connectToDatabase()
    await Assignee.create({ ...parsed.data, createdBy: session.user.id })

    revalidatePath(LIST_PATH)
    return { added: parsed.data.name }
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    if (error instanceof Error && (error as { code?: number }).code === 11000) {
      return { error: "Somebody with that name is already on the list." }
    }
    console.error(error)
    return { error: "Could not add them. Try again." }
  }
}

/** Deactivating keeps their name on past orders but hides them from new ones. */
export async function setAssigneeActive(formData: FormData): Promise<void> {
  try {
    await requireRole("owner", "staff")

    const parsed = z
      .object({
        id: z.string().trim().min(1),
        isActive: z.enum(["true", "false"]),
      })
      .safeParse({
        id: formData.get("id"),
        isActive: formData.get("isActive"),
      })

    if (!parsed.success || !isValidObjectId(parsed.data.id)) return

    await connectToDatabase()
    await Assignee.updateOne(
      { _id: parsed.data.id, isDeleted: false },
      { $set: { isActive: parsed.data.isActive === "true" } }
    )

    revalidatePath(LIST_PATH)
  } catch (error) {
    if (error instanceof AuthorizationError) return
    throw error
  }
}
