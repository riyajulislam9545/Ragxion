export function getTournamentImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `/api/storage${imagePath.startsWith("/") ? imagePath : `/${imagePath}`}`;
}