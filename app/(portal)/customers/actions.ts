"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { Customer } from "@/models/customer"
import { customerInputSchema } from "@/schemas/customer"

export interface CustomerFormState {
  error?: string
  fieldErrors?: Record<string, string>
  /** Set when the phone already belongs to someone, so the form can offer them. */
  duplicate?: {
    id: string
    name: string
    phone: string
  }
}

export async function createCustomer(
  _previous: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  let createdId: string
  // Set when the customer is being added from inside the order flow, so staff
  // land back on the order they were writing rather than on the customer page.
  const returnToOrder = formData.get("returnTo") === "order"

  try {
    const session = await requireRole("owner", "staff")

    const parsed = customerInputSchema.safeParse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      altPhone: formData.get("altPhone"),
      address: formData.get("address"),
      notes: formData.get("notes"),
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "form"
        fieldErrors[path] ??= issue.message
      }
      return { fieldErrors }
    }

    await connectToDatabase()

    // Phone is the identity key, so warn before making a second record for it
    // rather than letting the unique index throw (rule 2).
    const existing = await Customer.findOne({
      phone: parsed.data.phone,
      isDeleted: false,
    })
      .select({ name: 1, phone: 1 })
      .lean()

    if (existing) {
      return {
        duplicate: {
          id: String(existing._id),
          name: existing.name,
          phone: existing.phone,
        },
      }
    }

    const created = await Customer.create({
      ...parsed.data,
      // Every new customer starts as a lead; confirming an order promotes them.
      status: "lead",
      createdBy: session.user.id,
    })
    createdId = String(created._id)
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }

    if (
      error instanceof Error &&
      (error as { code?: number }).code === 11000
    ) {
      return { error: "Someone just saved that phone number. Search for it." }
    }

    console.error(error)
    return { error: "Could not save that customer. Try again." }
  }

  revalidatePath("/customers")
  redirect(
    returnToOrder
      ? `/orders/new?customerId=${createdId}`
      : `/customers/${createdId}`
  )
}
