"use client"

import { useRef, useState } from "react"
import { Camera, ImagePlus, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_SIZES,
  MAX_UPLOAD_BYTES,
  cloudinaryUrl,
} from "@/lib/cloudinary"
import type { OrderImageKind } from "@/schemas/order"

export interface UploadedImage {
  url: string
  publicId: string
  kind: OrderImageKind
}

export interface ImageUploaderProps {
  kind: OrderImageKind
  label: string
  hint?: string
  images: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  disabled?: boolean
}

interface InFlight {
  id: string
  name: string
  progress: number
  error?: string
}

/**
 * Uploads straight from the browser to Cloudinary using a signature fetched from
 * our own server. Phone photos are large and shop wifi is not, so each file gets
 * its own progress bar and its own failure, and nothing blocks the rest of the
 * form.
 */
export function ImageUploader({
  kind,
  label,
  hint,
  images,
  onChange,
  disabled = false,
}: ImageUploaderProps) {
  const [inFlight, setInFlight] = useState<InFlight[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    // Reject locally first — no point spending a phone's data on a 40MB file
    // or a PDF the shop picked by accident.
    const rejected: InFlight[] = []
    const accepted: File[] = []

    for (const file of files) {
      const id = `${file.name}-${file.lastModified}-${Math.random()}`
      if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        rejected.push({ id, name: file.name, progress: 0, error: "Not an image" })
      } else if (file.size > MAX_UPLOAD_BYTES) {
        rejected.push({
          id,
          name: file.name,
          progress: 0,
          error: `Too large (${Math.round(file.size / 1024 / 1024)}MB, limit ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)`,
        })
      } else {
        accepted.push(file)
      }
    }

    if (rejected.length > 0) setInFlight((current) => [...current, ...rejected])
    if (accepted.length === 0) return

    let signature: {
      cloudName: string
      apiKey: string
      timestamp: number
      folder: string
      signature: string
    }

    try {
      const response = await fetch("/api/uploads/signature", { method: "POST" })
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        const message =
          body && typeof body === "object" && "error" in body
            ? String((body as { error: unknown }).error)
            : "Could not start the upload."
        setInFlight((current) => [
          ...current,
          { id: `sig-${Date.now()}`, name: label, progress: 0, error: message },
        ])
        return
      }
      signature = await response.json()
    } catch {
      setInFlight((current) => [
        ...current,
        {
          id: `sig-${Date.now()}`,
          name: label,
          progress: 0,
          error: "No connection. Check the signal and try again.",
        },
      ])
      return
    }

    await Promise.all(
      accepted.map((file) => uploadOne(file, signature))
    )
  }

  function uploadOne(
    file: File,
    signature: {
      cloudName: string
      apiKey: string
      timestamp: number
      folder: string
      signature: string
    }
  ): Promise<void> {
    const id = `${file.name}-${file.lastModified}-${Math.random()}`
    setInFlight((current) => [...current, { id, name: file.name, progress: 0 }])

    return new Promise((resolve) => {
      const body = new FormData()
      body.append("file", file)
      body.append("api_key", signature.apiKey)
      body.append("timestamp", String(signature.timestamp))
      body.append("folder", signature.folder)
      body.append("signature", signature.signature)

      // XHR rather than fetch: fetch cannot report upload progress, and on a
      // shop's connection a silent three-minute wait looks like a hang.
      const request = new XMLHttpRequest()
      request.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`
      )

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return
        const progress = Math.round((event.loaded / event.total) * 100)
        setInFlight((current) =>
          current.map((row) => (row.id === id ? { ...row, progress } : row))
        )
      })

      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          const result: { secure_url?: string; public_id?: string } = JSON.parse(
            request.responseText
          )
          if (result.secure_url && result.public_id) {
            onChange([
              ...images,
              { url: result.secure_url, publicId: result.public_id, kind },
            ])
            setInFlight((current) => current.filter((row) => row.id !== id))
            resolve()
            return
          }
        }
        setInFlight((current) =>
          current.map((row) =>
            row.id === id ? { ...row, error: "Upload was rejected" } : row
          )
        )
        resolve()
      })

      // Fires when the connection drops mid-upload.
      request.addEventListener("error", () => {
        setInFlight((current) =>
          current.map((row) =>
            row.id === id
              ? { ...row, error: "Connection lost. Try again." }
              : row
          )
        )
        resolve()
      })

      request.addEventListener("abort", () => {
        setInFlight((current) => current.filter((row) => row.id !== id))
        resolve()
      })

      request.send(body)
    })
  }

  const accept = ACCEPTED_IMAGE_TYPES.join(",")

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept={accept}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void handleFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(event) => {
              void handleFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="size-11"
            size="icon"
            aria-label={`Take a photo for ${label}`}
            disabled={disabled}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            Add
          </Button>
        </div>
      </div>

      {images.length > 0 || inFlight.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((image) => (
            <li key={image.publicId} className="relative">
              <a
                href={cloudinaryUrl(image.publicId, IMAGE_SIZES.full)}
                target="_blank"
                rel="noreferrer"
              >
                {/* Thumbnail transform, never the original file. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cloudinaryUrl(image.publicId, IMAGE_SIZES.thumb)}
                  alt={label}
                  loading="lazy"
                  className="aspect-square w-full rounded-md object-cover"
                />
              </a>
              <button
                type="button"
                aria-label="Remove image"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    images.filter((row) => row.publicId !== image.publicId)
                  )
                }
                className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}

          {inFlight.map((row) => (
            <li
              key={row.id}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed p-2 text-center"
            >
              {row.error ? (
                <>
                  <p className="text-xs text-destructive">{row.error}</p>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      setInFlight((current) =>
                        current.filter((item) => item.id !== row.id)
                      )
                    }
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {row.progress}%
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
