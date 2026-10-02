export function getProfilePhotoUrl(filename: string | null): string | null {
  if (!filename) return null;

  const baseUrl = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${baseUrl}/uploads/profile/${encodeURIComponent(filename)}`;
}
