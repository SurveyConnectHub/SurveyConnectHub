export function firstOf<T>(relation: T | T[] | null | undefined): T | null {
  if (relation == null) return null;
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}
