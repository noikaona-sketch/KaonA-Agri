/**
 * Supabase Nested Relation Helpers
 *
 * Supabase .select('relation(...)') ALWAYS returns array[], even for FK 1:1.
 * Use these helpers to safely extract the first item and get proper typing.
 *
 * @see docs/SUPABASE_RULES.md
 */

/**
 * Extract first item from a Supabase nested relation (always an array).
 *
 * @example
 * // Instead of: item.plots?.name          ← type error
 * // Instead of: item.plots?.[0]?.name     ← works but verbose
 * // Use:
 * const plot = first(item.plots);
 * plot?.name  // ← clean, type-safe
 */
export function first<T>(relation: T[] | null | undefined): T | null {
  if (!relation || !Array.isArray(relation)) return null;
  return relation[0] ?? null;
}

/**
 * Extract all items from a Supabase nested relation safely.
 * Returns empty array instead of null/undefined.
 */
export function all<T>(relation: T[] | null | undefined): T[] {
  if (!relation || !Array.isArray(relation)) return [];
  return relation;
}

/**
 * Type helper for Supabase nested relation fields.
 * Use instead of `{ field: string } | null`
 *
 * @example
 * type Cycle = {
 *   id: string;
 *   plots: NestedRelation<{ name: string; province: string | null }>;
 *   members: NestedRelation<{ full_name: string; phone: string | null }>;
 * };
 */
export type NestedRelation<T> = T[] | null;
