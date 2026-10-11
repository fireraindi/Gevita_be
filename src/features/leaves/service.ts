import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../../db";
import { leaves } from "../../db/schema";
import { validate } from "../../helpers/validate";
import { createLeaveSchema } from "./validation";
import type { CreateLeaveRequest } from "./model/request";
import type { LeaveResponseData } from "./model/response";

let lastLeaveImageTimestamp = 0;

export async function insertLeaveRecord(values: {
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  category: "Sakit" | "Izin";
  imageFilename: string | null;
}): Promise<LeaveResponseData> {
  const [row] = await db.insert(leaves).values({
    user_id: values.userId,
    start_date: values.startDate,
    end_date: values.endDate,
    reason: values.reason,
    category: values.category,
    image: values.imageFilename,
  }).returning({
    id: leaves.id,
    startDate: leaves.start_date,
    endDate: leaves.end_date,
    reason: leaves.reason,
    status: leaves.status,
    image: leaves.image,
    createdAt: leaves.created_at,
  });
  if (!row) throw new Error("Leave insert returned no row");
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    status: row.status,
    image: row.image,
    created_at: row.createdAt.toISOString(),
  };
}

async function storeLeaveImage(file: File): Promise<{ filename: string; filepath: string }> {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const directory = join(process.cwd(), "uploads", "leave");
  await mkdir(directory, { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  let timestamp = Math.max(Date.now(), lastLeaveImageTimestamp + 1);
  while (true) {
    const filename = `${timestamp}${extension}`;
    const filepath = join(directory, filename);
    try {
      await writeFile(filepath, bytes, { flag: "wx" });
      lastLeaveImageTimestamp = timestamp;
      return { filename, filepath };
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "EEXIST") throw error;
      timestamp += 1;
    }
  }
}

export async function createLeave(userId: string, request: CreateLeaveRequest): Promise<LeaveResponseData> {
  const input = validate(createLeaveSchema, request);
  const imageFile = input.image instanceof File ? input.image : undefined;
  const storedImage = imageFile ? await storeLeaveImage(imageFile) : null;
  try {
    return await insertLeaveRecord({
      userId,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      category: input.category,
      imageFilename: storedImage?.filename ?? null,
    });
  } catch (error) {
    if (storedImage) await unlink(storedImage.filepath).catch(() => undefined);
    throw error;
  }
}
