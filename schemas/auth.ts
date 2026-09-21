import { z } from "zod"

/** Sign-in credentials. Validated before anything touches the database. */
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1, "Enter your password"),
})

export type Credentials = z.infer<typeof credentialsSchema>
