import { Schema, model, models, type InferSchemaType, type Model } from "mongoose"

import { USER_ROLES } from "@/schemas/user"

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never selected by default, so a stray `User.find()` cannot leak hashes
    // into a server component's props. Ask for it explicitly when signing in.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: "staff" },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
)

export type UserDocument = InferSchemaType<typeof userSchema>

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) ?? model<UserDocument>("User", userSchema)
