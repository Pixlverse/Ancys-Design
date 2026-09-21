import { z } from "zod"

import { phoneSchema } from "@/schemas/customer"

/**
 * An assignee is someone work is given to — a tailor on the bench. They are not
 * a login account: they never sign in, and they are not customers.
 *
 * This is a deliberate departure from CLAUDE.md section 5, which describes
 * `assignedTo` as a userId. A shop takes on tailors far more readily than it
 * hands out portal logins.
 */
export const assigneeInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .optional()
    .pipe(phoneSchema.optional()),
})

export type AssigneeInput = z.infer<typeof assigneeInputSchema>
