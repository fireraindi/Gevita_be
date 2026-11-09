import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestError } from "../errors/errors";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);

let lastUploadTimestamp = 0;

export async function storeUploadedImage(
  subDirectory: "profile" | "checkin" | "leave",
  file: File,
): Promise<{ filename: string; filepath: string }> {
  if (file.size > 1024 * 1024) {
    throw new BadRequestError("File size must not exceed 1MB");
  }

  const rawExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const extension = allowedExtensions.has(rawExt)
    ? rawExt
    : file.type === "image/png"
    ? ".png"
    : file.type === "image/webp"
    ? ".webp"
    : ".jpg";

  const directory = join(process.cwd(), "uploads", subDirectory);
  await mkdir(directory, { recursive: true });

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Prevent obvious script/executable uploads
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) || // %PDF
      (bytes[0] === 0x4d && bytes[1] === 0x5a) || // MZ executable
      (bytes[0] === 0x3c && bytes[1] === 0x21) || // <!
      (bytes[0] === 0x3c && bytes[1] === 0x68) || // <h (html)
      (bytes[0] === 0x3c && bytes[1] === 0x73)) // <s (script)
  ) {
    throw new BadRequestError("Unsupported image format");
  }

  let timestamp = Math.max(Date.now(), lastUploadTimestamp + 1);
  while (true) {
    const filename = `${timestamp}${extension}`;
    const filepath = join(directory, filename);
    try {
      await writeFile(filepath, bytes, { flag: "wx" });
      lastUploadTimestamp = timestamp;
      return { filename, filepath };
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      timestamp += 1;
    }
  }
}

