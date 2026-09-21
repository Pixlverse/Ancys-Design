import { Schema, model, models, type Model } from "mongoose"

/**
 * Atomic sequence counters, one document per sequence key.
 *
 * Not a domain collection — it exists because order numbers must be sequential
 * per year and safe when two staff save an order at the same moment. Reading the
 * highest existing number and adding one races; `$inc` does not.
 */
export interface CounterDocument {
  _id: string
  seq: number
}

const counterSchema = new Schema<CounterDocument>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
)

export const Counter: Model<CounterDocument> =
  (models.Counter as Model<CounterDocument>) ??
  model<CounterDocument>("Counter", counterSchema)

/** Increments and returns the next value for `key`, creating it if needed. */
export async function nextSequence(key: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  ).lean()

  // The upsert guarantees a document, but the driver's type does not.
  if (!counter) throw new Error(`Could not allocate a number for ${key}`)
  return counter.seq
}
