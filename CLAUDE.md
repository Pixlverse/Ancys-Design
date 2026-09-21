# CLAUDE.md

Project memory for Claude Code. Read this before every task.

---

## 1. What this is

An internal **admin portal for a tailoring / fashion store**. Not a customer-facing
website. Shop staff use it to record measurements, take stitching orders, bill
customers, get order confirmations over WhatsApp, and track due dates on a calendar.

Users are shop staff on desktop and phone. They are not technical. Screens must be
fast to fill in, forgiving of mistakes, and readable in a busy shop.

### The real-world workflow being modelled

1. Customer walks in. Staff takes body measurements (chest, waist, shoulder…).
2. Customer often brings their own cloth, sometimes several pieces for different
   garments (one for a blouse, one for a pant).
3. For each piece, staff records: what garment it's for, a photo of the cloth,
   a reference/design image the customer wants it to look like, a pattern image,
   free-text notes, and a due date.
4. Staff sends the whole thing to the customer on WhatsApp for confirmation,
   together with the bill calculated from the shop's rate card.
5. Customer replies yes. Order becomes active, customer is saved permanently.
6. Work progresses through cutting → stitching → finishing → ready → delivered.
7. Staff watches a calendar of due dates and gets reminders before deadlines.

---

## 2. Stack

- **Next.js 15**, App Router, TypeScript strict mode
- **MongoDB Atlas** + **Mongoose** (no Prisma, no SQL)
- **Auth.js v5** (NextAuth), credentials provider, JWT sessions
- **Tailwind CSS** + **shadcn/ui** components
- **Zod** for all input validation, shared between client and server
- **Cloudinary** for image upload and transformation
- **@react-pdf/renderer** for invoice PDFs (no Puppeteer — must run on Vercel)
- **date-fns** + **date-fns-tz** for dates (no Moment, no Day.js)
- Deployed on **Vercel**

API lives in Next.js **route handlers** under `app/api/`. Do not add a separate
Express server. Mutations from forms use **server actions** where the result is a
simple redirect or revalidate; use route handlers where an external client
(webhook, future mobile app) needs the endpoint.

---

## 3. Commands

```bash
npm run dev          # local dev server
npm run build        # production build — must pass before any commit
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run seed         # seed garment types + a demo customer
```

Before you tell me a task is done, run `npm run typecheck` and `npm run build`
and confirm both pass. Do not claim success on unverified code.

---

## 4. Directory structure

```
app/
  (auth)/login/
  (portal)/
    customers/
    orders/
    calendar/
    settings/garment-types/
  api/
    webhooks/whatsapp/
    cron/reminders/
components/
  ui/              # shadcn primitives, do not hand-edit
  domain/          # MeasurementForm, OrderItemCard, RateCardTable…
lib/
  db.ts            # mongoose connection singleton
  auth.ts
  money.ts         # paise <-> rupee helpers
  phone.ts         # E.164 normalisation
  dates.ts         # IST helpers
  messaging/       # WhatsApp abstraction — see section 7
models/            # mongoose schemas, one file per collection
schemas/           # zod schemas, one file per entity
```

---

## 5. Data model

Collections. Embed what is always read together, reference what is queried alone.

### `customers`

```
{
  name, phone (E.164, unique index), altPhone?, address?, notes?,
  status: 'lead' | 'active',        // 'lead' until first order confirmed
  isDeleted: false,
  createdAt, updatedAt, createdBy
}
```

### `garmentTypes` — the rate card AND the measurement form definition

```
{
  name,                              // "Blouse", "Churidar Set", "Pant"
  baseRate,                          // integer paise
  measurementFields: [
    { key: 'bust', label: 'Bust', unit: 'in', required: true, order: 1 },
    ...
  ],
  isActive, isDeleted, createdAt, updatedAt
}
```

**Critical:** garment types and their measurement fields are _data_, never
hardcoded. The shop owner must be able to add "Lehenga" with its own fields from
the settings screen without a code change. Never write a TypeScript union of
garment names. Never write `if (garment === 'blouse')`.

### `measurementSets` — referenced, not embedded, so history is preserved

```
{
  customerId, garmentTypeId,
  values: { bust: 36, waist: 30, sleeveLength: 12.5 },   // numbers, inches
  takenOn, takenBy, notes?
}
```

Measurements change over time. Never overwrite an old set — always insert a new
one. An order item stores the `measurementSetId` it was stitched from, so old
orders keep their historical measurements.

### `orders`

```
{
  orderNo,                           // human-readable, e.g. "2026-0142"
  customerId,
  status: 'draft' | 'awaiting_confirmation' | 'confirmed' | 'in_progress'
        | 'ready' | 'delivered' | 'cancelled',
  items: [ OrderItem ],              // EMBEDDED
  subtotal, discount, total,         // integer paise
  advancePaid, balance,              // integer paise
  confirmation: {
    sentAt?, channel?, publicToken?, confirmedAt?, confirmedBy?, rawResponse?
  },
  promisedDate,                      // latest item due date, denormalised for calendar
  isDeleted, createdAt, updatedAt, createdBy
}
```

### `OrderItem` (embedded subdocument)

```
{
  _id,
  garmentTypeId, garmentTypeName,    // name snapshotted at order time
  rate,                              // paise, snapshotted, editable per order
  quantity,
  measurementSetId,
  clothSource: 'customer' | 'shop',
  images: [ { url, publicId, kind: 'cloth' | 'reference' | 'pattern' } ],
  note,
  dueDate,
  itemStatus: 'pending' | 'cutting' | 'stitching' | 'finishing' | 'ready' | 'delivered',
  assignedTo?                        // userId of tailor
}
```

Rate and garment name are **snapshotted onto the item**. Changing the rate card
later must never alter the price of a past order.

### `notifications`

```
{ type, orderId, orderItemId?, dueAt, message, isRead, readBy?, createdAt }
```

### `users`

```
{ name, email, passwordHash, role: 'owner' | 'staff' | 'tailor', isActive }
```

---

## 6. Hard rules

1. **Money is integer paise.** Never float, never `Number.toFixed` arithmetic.
   ₹800 is `80000`. Format for display only, at the edge, via `lib/money.ts`.
2. **Phone is the customer identity key.** Normalise to E.164 (`+91…`) on the way
   in via `lib/phone.ts`. Warn on duplicate before creating a second customer.
3. **Timezone is Asia/Kolkata.** Store all timestamps UTC. Convert for display and
   for "due today" queries via `lib/dates.ts`. Never use raw `new Date()` for
   day-boundary logic.
4. **Soft delete only.** `isDeleted: true`. Never remove customer or order records.
5. **Every mutation validates with a Zod schema** from `schemas/` before touching
   the database. Client-side validation is a convenience, never the only check.
6. **Every route handler and server action checks the session and role.** No
   exceptions, including webhooks (verify Meta's signature instead).
7. **Measurement values are numbers in inches**, allowing decimals (32.5). Do not
   store as strings.
8. **Status transitions go through one function**, `lib/orders/transition.ts`.
   Do not scatter `order.status = 'ready'` across the codebase.
9. **No `any`.** No `@ts-ignore`. If types fight you, say so rather than silencing.
10. **Do not install a package without telling me first** and saying why the
    existing stack can't do it.

---

## 7. WhatsApp messaging

All outbound messaging goes through `lib/messaging/index.ts`, which exports a
single interface:

```ts
interface MessagingProvider {
  sendOrderConfirmation(order, customer): Promise<SendResult>;
  sendBill(order, customer, pdfBuffer): Promise<SendResult>;
  sendDueReminder(order, item, customer): Promise<SendResult>;
  sendReadyForPickup(order, customer): Promise<SendResult>;
}
```

Two implementations:

- `providers/manual.ts` — builds a formatted message and returns a `wa.me` deep
  link that staff opens and sends from their own phone. Staff then marks the
  order confirmed by hand. **This is the default and the one built first.**
- `providers/cloud-api.ts` — Meta WhatsApp Cloud API with approved templates and
  interactive buttons; customer's button tap arrives at
  `app/api/webhooks/whatsapp/` and updates the order automatically. Built later.

Selected by `MESSAGING_PROVIDER` env var. **No code outside `lib/messaging/` may
know which provider is active**, and no feature may depend on the Cloud API
existing.

Because a `wa.me` link cannot carry images, the manual provider includes a link to
a **public order page** at `/o/[token]` — a tokenised, read-only, no-login page
showing the items, photos, prices and due dates. Tokens are random 32-char
strings, not order IDs.

---

## 8. UI conventions

- Shop staff enter data quickly on a phone. Large tap targets, numeric keyboards
  for measurements, minimal required fields.
- Every list has search. Customer search is by phone first, name second.
- Money always displayed as `₹1,250` with Indian digit grouping.
- Dates displayed as `12 Mar` or `12 Mar 2026`; never ISO strings in the UI.
- Destructive actions need confirmation. Everything else saves without a modal.
- Loading and empty states are required, not optional. An empty customer list
  says what to do next, not "No data".
- Images: always show a thumbnail grid, tap to open full size. Phone photos are
  large — resize via Cloudinary transforms, never ship originals to the browser.

---

## 9. Domain glossary

- **Churidar / Churidar set** — tunic with fitted trousers; a common order type.
- **Blouse** — fitted top worn with a saree; heavily measurement-driven.
- **Falls / piping / lining** — finishing options that may add to the price.
- **Trial / fitting date** — an intermediate appointment before final delivery,
  distinct from the due date.
- **Alteration** — rework on a previously delivered garment; links to the original
  order rather than creating an unrelated one.

---

## 10. How I want you to work

- For any task bigger than a single file, **produce a plan first and wait for my
  approval** before writing code.
- Work in **small, verifiable steps**. Stop and report after each one.
- Prefer editing existing files over creating new ones. Don't create a new util
  file when `lib/` already has the right home.
- Do not write documentation files, READMEs, or summary markdown unless I ask.
- Do not add features I didn't ask for. If you think something is missing, say so
  and let me decide.
- When you finish a phase, run typecheck + build, then make one clean commit with
  a conventional-commit message. Don't commit mid-phase unless I ask.
- If something in this file is wrong or out of date, tell me instead of silently
  working around it.
