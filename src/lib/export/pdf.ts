/**
 * A small PDF writer: one full-page picture per page (JPEG, or lossless
 * Flate-compressed RGB for print). Enough for "PDF Standard" / "PDF Print"
 * downloads without a third-party library.
 */

export interface PdfImage {
  width: number;
  height: number;
  /** JPEG bytes (`DCTDecode`) or zlib-compressed 8-bit RGB rows (`FlateDecode`). */
  data: Uint8Array;
  filter: "DCTDecode" | "FlateDecode";
}

export interface PdfPage {
  /** Page size in PDF points (1/72 in). */
  widthPt: number;
  heightPt: number;
  image: PdfImage;
}

const encoder = new TextEncoder();

/** Design px (96 per inch) → PDF points (72 per inch). */
export const pxToPt = (px: number) => (px * 72) / 96;

/** A PDF text string that survives any language (UTF-16BE, hex). */
function pdfText(value: string): string {
  let hex = "FEFF";
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

export function buildPdf(pages: PdfPage[], info: { title?: string } = {}): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    write(`${id} 0 obj\n${body}\n`);
    if (stream) {
      write("stream\n");
      write(stream);
      write("\nendstream\n");
    }
    write("endobj\n");
  };

  // Objects: 1 catalog, 2 page tree, 3 info, then 3 per page (page, content, image).
  const pageId = (i: number) => 4 + i * 3;
  write("%PDF-1.4\n");
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  object(
    3,
    `<< /Producer ${pdfText("Lumora Studio")}${info.title ? ` /Title ${pdfText(info.title)}` : ""} >>`,
  );
  pages.forEach((page, i) => {
    const id = pageId(i);
    const w = num(page.widthPt);
    const h = num(page.heightPt);
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    const content = encoder.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    object(id + 1, `<< /Length ${content.length} >>`, content);
    const { image } = page;
    object(
      id + 2,
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter} /Length ${image.data.length} >>`,
      image.data,
    );
  });

  const count = 4 + pages.length * 3;
  const xref = length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) write(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
