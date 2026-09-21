import { hash } from "bcryptjs"
import { z } from "zod"

import { connectToDatabase, disconnectFromDatabase } from "@/lib/db"
import { toPaise } from "@/lib/money"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import { User } from "@/models/user"
import { customerInputSchema } from "@/schemas/customer"
import { DEMO_CUSTOMER, GARMENT_TYPE_SEED } from "./seed-data"

/**
 * Seeds a fresh install: the owner account, which is the only way in, and a
 * starting rate card.
 *
 * Idempotent. The owner is upserted with $set, so re-running resets the
 * password from the environment. Garment types and the demo customer use
 * $setOnInsert, so re-running never overwrites anything the shop has edited.
 */

const envSchema = z.object({
  SEED_OWNER_NAME: z.string().trim().min(1),
  SEED_OWNER_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  SEED_OWNER_PASSWORD: z
    .string()
    .min(8, "SEED_OWNER_PASSWORD must be at least 8 characters"),
})

async function seed(): Promise<void> {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    throw new Error(`Seed environment is incomplete:\n${issues}`)
  }

  const { SEED_OWNER_NAME, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD } = parsed.data

  await connectToDatabase()

  const passwordHash = await hash(SEED_OWNER_PASSWORD, 10)
  const result = await User.findOneAndUpdate(
    { email: SEED_OWNER_EMAIL },
    {
      $set: {
        name: SEED_OWNER_NAME,
        passwordHash,
        role: "owner",
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true }
  )

  const created = result.lastErrorObject?.updatedExisting === false
  console.log(
    `${created ? "Created" : "Updated"} owner account ${SEED_OWNER_EMAIL}`
  )

  // includeResultMetadata puts the document on `.value`, not on the result.
  const ownerId = result.value?._id
  if (!ownerId) throw new Error("Could not read back the owner account")

  await seedGarmentTypes()
  await seedDemoCustomer(String(ownerId))
}

async function seedDemoCustomer(createdBy: string): Promise<void> {
  // Through the same schema as the form, so the seeded phone is stored in the
  // same canonical E.164 shape as every other customer.
  const parsed = customerInputSchema.parse(DEMO_CUSTOMER)

  const outcome = await Customer.updateOne(
    { phone: parsed.phone, isDeleted: false },
    { $setOnInsert: { ...parsed, status: "lead", createdBy } },
    { upsert: true }
  )

  console.log(
    outcome.upsertedCount > 0
      ? `Created demo customer ${parsed.name} (${parsed.phone})`
      : `Left demo customer ${parsed.name} as it is`
  )
}

async function seedGarmentTypes(): Promise<void> {
  for (const garmentType of GARMENT_TYPE_SEED) {
    const result = await GarmentType.updateOne(
      { name: garmentType.name, isDeleted: false },
      {
        $setOnInsert: {
          name: garmentType.name,
          baseRate: toPaise(garmentType.baseRateRupees),
          measurementFields: garmentType.measurements.map(
            ([key, label, required], order) => ({
              key,
              label,
              unit: "in",
              required,
              order,
            })
          ),
          isActive: true,
          isDeleted: false,
        },
      },
      { upsert: true }
    )

    console.log(
      result.upsertedCount > 0
        ? `Created garment type ${garmentType.name}`
        : `Left garment type ${garmentType.name} as it is`
    )
  }
}

seed()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectFromDatabase()
  })
