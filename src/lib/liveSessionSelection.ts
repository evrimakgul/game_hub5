const LIVE_SESSION_SELECTION_STORAGE_KEY = "game_hub5.selected_live_session_id";

export function readSelectedLiveSessionId(storage: Storage | null): string {
  return storage?.getItem(LIVE_SESSION_SELECTION_STORAGE_KEY)?.trim() ?? "";
}

export function writeSelectedLiveSessionId(
  storage: Storage | null,
  sessionId: string
): void {
  const normalizedSessionId = sessionId.trim();
  if (!storage) {
    return;
  }

  if (normalizedSessionId) {
    storage.setItem(LIVE_SESSION_SELECTION_STORAGE_KEY, normalizedSessionId);
    return;
  }

  storage.removeItem(LIVE_SESSION_SELECTION_STORAGE_KEY);
}
