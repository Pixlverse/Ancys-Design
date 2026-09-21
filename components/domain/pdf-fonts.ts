import path from "node:path"

import { Font } from "@react-pdf/renderer"

/**
 * The font every generated PDF uses.
 *
 * It is not decoration: the PDF standard fonts have no ₹ glyph (U+20B9), so a
 * document set in Helvetica prints a blank where the currency should be. It is
 * also the family the portal uses on screen, so a printed page and the portal
 * look like the same shop.
 */
export const PDF_FONT_FAMILY = "EncodeSansSemiExpanded"

let registered = false

export function registerPdfFonts(): void {
  if (registered) return
  const dir = path.join(process.cwd(), "assets", "fonts")
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(dir, "EncodeSansSemiExpanded-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "EncodeSansSemiExpanded-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(dir, "EncodeSansSemiExpanded-Bold.ttf"), fontWeight: 700 },
    ],
  })
  registered = true
}
