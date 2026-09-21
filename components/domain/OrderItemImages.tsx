import { IMAGE_SIZES, cloudinaryUrl } from "@/lib/cloudinary"
import type { OrderImage } from "@/models/order"
import type { OrderImageKind } from "@/schemas/order"

const KIND_LABELS: Record<OrderImageKind, string> = {
  cloth: "Cloth",
  reference: "Reference",
  pattern: "Pattern",
}

/**
 * Thumbnail grid, grouped by what the photo is of. Every image is requested at
 * a transform size — the originals are phone photos of several megabytes and
 * must never be shipped to a list (CLAUDE.md section 8).
 */
export function OrderItemImages({ images }: { images: OrderImage[] }) {
  if (images.length === 0) return null

  const kinds = (Object.keys(KIND_LABELS) as OrderImageKind[]).filter((kind) =>
    images.some((image) => image.kind === kind)
  )

  return (
    <div className="space-y-3">
      {kinds.map((kind) => (
        <div key={kind} className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{KIND_LABELS[kind]}</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {images
              .filter((image) => image.kind === kind)
              .map((image) => (
                <li key={image.publicId}>
                  <a
                    href={cloudinaryUrl(image.publicId, IMAGE_SIZES.full)}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cloudinaryUrl(image.publicId, IMAGE_SIZES.thumb)}
                      alt={`${KIND_LABELS[kind]} photo`}
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
