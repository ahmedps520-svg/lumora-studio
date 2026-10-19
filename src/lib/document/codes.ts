/**
 * QR codes and EAN-13 barcodes as plain data (rows of dark/light modules, or a
 * bar pattern), so they can be drawn crisply at any size.
 */
import qrcode from "qrcode-generator";

/** Encodes text (any language, as UTF-8) into QR modules: rows of `true` = dark. */
export function qrMatrix(value: string, errorCorrection: "L" | "M" | "Q" | "H" = "M"): boolean[][] {
  const qr = qrcode(0, errorCorrection);
  // The library reads one byte per character, so hand it the UTF-8 bytes that way.
  let bytes = "";
  for (const b of new TextEncoder().encode(value)) bytes += String.fromCharCode(b);
  qr.addData(bytes, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

const L_CODES = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const R_CODES = L_CODES.map((code) => [...code].map((b) => (b === "0" ? "1" : "0")).join(""));
const G_CODES = R_CODES.map((code) => [...code].reverse().join(""));
/** Which of the first six digits use the G set, chosen by the leading digit. */
const PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * The 13 digits (adding the check digit to a 12-digit number), or null when
 * the value isn't a valid EAN-13.
 */
export function normalizeEan13(value: string): string | null {
  const digits = value.replace(/\s+/g, "");
  if (/^\d{12}$/.test(digits)) return digits + ean13CheckDigit(digits);
  if (/^\d{13}$/.test(digits) && ean13CheckDigit(digits.slice(0, 12)) === Number(digits[12])) {
    return digits;
  }
  return null;
}

/** The 95 modules of an EAN-13 barcode ("1" = bar), guards included. */
export function ean13Pattern(digits: string): string {
  const parity = PARITY[Number(digits[0])]!;
  let bits = "101";
  for (let i = 1; i <= 6; i++) {
    const d = Number(digits[i]);
    bits += parity[i - 1] === "L" ? L_CODES[d] : G_CODES[d];
  }
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R_CODES[Number(digits[i])];
  return bits + "101";
}
