import { del, get, set } from "idb-keyval";
import type { DealForm } from "@/domain/schemas";

export interface Draft {
  form: DealForm;
  savedAt: number;
}

function key(id: string): string {
  return `byrsadvct:draft:${id}`;
}

export async function loadDraft(id: string): Promise<Draft | null> {
  try {
    const d = await get<Draft>(key(id));
    return d ?? null;
  } catch {
    return null;
  }
}

export async function saveDraft(id: string, form: DealForm): Promise<void> {
  try {
    await set(key(id), { form, savedAt: Date.now() } satisfies Draft);
  } catch {
    // Storage unavailable (private mode). The form still works; it just will not survive a reload.
  }
}

export async function clearDraft(id: string): Promise<void> {
  try {
    await del(key(id));
  } catch {
    // ignore
  }
}
