/** Smaller rendition for cards and lists. TheMealDB serves /medium (~350px) next to each photo. */
export function thumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https:\/\/www\.themealdb\.com\/images\/media\/meals\/[^/]+\.(jpg|jpeg|png)$/i.test(url)) return `${url}/medium`;
  return url;
}
