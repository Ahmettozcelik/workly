// Merges space-separated ID lists (e.g. for aria-describedby), dropping empty
// values and duplicates. Returns undefined when nothing remains.
export function mergeIds(...values: Array<string | undefined>) {
  const ids = new Set(
    values.flatMap((value) => value?.split(/\s+/) ?? []).filter(Boolean),
  );
  return ids.size > 0 ? [...ids].join(" ") : undefined;
}
