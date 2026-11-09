import { config } from "../config";

export function getProfilePhotoUrl(filename: string | null): string | null {
  if (!filename) return null;

  const baseUrl = (process.env.PUBLIC_BASE_URL ?? config.PUBLIC_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/uploads/profile/${encodeURIComponent(filename)}`;
}

export function getCheckInPhotoUrl(filename: string | null): string | null {
  if (!filename) return null;

  const baseUrl = (process.env.PUBLIC_BASE_URL ?? config.PUBLIC_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/uploads/checkin/${encodeURIComponent(filename)}`;
}

export function getLeavePhotoUrl(filename: string | null): string | null {
  if (!filename) return null;

  const baseUrl = (process.env.PUBLIC_BASE_URL ?? config.PUBLIC_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/uploads/leave/${encodeURIComponent(filename)}`;
}
