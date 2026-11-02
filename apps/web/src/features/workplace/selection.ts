const LAST_WORKPLACE_KEY = 'kanban:last-workplace';

export function getLastWorkplaceId(): string | null {
  try {
    return window.localStorage.getItem(LAST_WORKPLACE_KEY);
  } catch {
    return null;
  }
}

export function setLastWorkplaceId(workplaceId: string): void {
  try {
    window.localStorage.setItem(LAST_WORKPLACE_KEY, workplaceId);
  } catch {
    // Storage can be unavailable in private contexts; selection is a convenience only.
  }
}
