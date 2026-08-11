/**
 * Whether a menu row should render while the panel filter is active.
 * Rows without `filterText` (Label, Separator, custom Item) always stay visible.
 */
export function isMenuItemVisible(
  filterEnabled: boolean,
  filterQuery: string,
  filterText?: string,
): boolean {
  if (!filterEnabled || filterText === undefined) return true;
  const query = filterQuery.trim().toLowerCase();
  if (!query) return true;
  return filterText.toLowerCase().includes(query);
}
