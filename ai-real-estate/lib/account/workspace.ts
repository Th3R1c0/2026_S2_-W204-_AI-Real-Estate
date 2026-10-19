import type { SavedLocation } from "../saved-locations";

export type GeneralNote = { id: string; title: string; content: string; createdAt: string };
export type BuyerPropertyNote = { id: string; propertyId: string; content: string; category?: string; createdAt: string };
export type WorkspaceChatMessage = { role: "user" | "model"; text: string; time?: string };
export type BuyerWorkspace = {
  savedPropertyIds: string[];
  generalNotes: GeneralNote[];
  propertyNotes: Record<string, BuyerPropertyNote[]>;
  destinations: SavedLocation[];
  chatHistory: WorkspaceChatMessage[];
};
export type WorkspaceField = keyof BuyerWorkspace;

export const emptyWorkspace: BuyerWorkspace = {
  savedPropertyIds: [], generalNotes: [], propertyNotes: {}, destinations: [], chatHistory: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const shortText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;

function validGeneralNote(value: unknown): value is GeneralNote {
  return isRecord(value) && shortText(value.id, 80) && shortText(value.title, 200) && shortText(value.content, 10000) && shortText(value.createdAt, 80);
}

function validPropertyNote(value: unknown): value is BuyerPropertyNote {
  return isRecord(value) && shortText(value.id, 80) && shortText(value.propertyId, 120) && shortText(value.content, 10000) &&
    (value.category === undefined || shortText(value.category, 80)) && shortText(value.createdAt, 80);
}

function validLocation(value: unknown): value is SavedLocation {
  if (!isRecord(value) || !shortText(value.id, 80) || !shortText(value.name, 120) || !shortText(value.address, 300)) return false;
  const { latitude, longitude } = value;
  return (latitude === undefined && longitude === undefined) ||
    (typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
      typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180);
}

function validChatMessage(value: unknown): value is WorkspaceChatMessage {
  return isRecord(value) &&
    (value.role === "user" || value.role === "model") &&
    shortText(value.text, 5000) &&
    (value.time === undefined || shortText(value.time, 50));
}

export function validateWorkspaceChange(value: unknown): { error: string } | { field: WorkspaceField; value: BuyerWorkspace[WorkspaceField] } {
  if (!isRecord(value) || typeof value.field !== "string") return { error: "Invalid workspace change." };
  const content = value.value;
  switch (value.field) {
    case "savedPropertyIds":
      return Array.isArray(content) && content.length <= 1000 && content.every(item => shortText(item, 120))
        ? { field: value.field, value: content } : { error: "Invalid saved properties." };
    case "generalNotes":
      return Array.isArray(content) && content.length <= 200 && content.every(validGeneralNote)
        ? { field: value.field, value: content } : { error: "Invalid general notes." };
    case "propertyNotes":
      return isRecord(content) && Object.keys(content).length <= 200 && Object.entries(content).every(([key, notes]) =>
        key !== "__proto__" && key.length <= 120 && Array.isArray(notes) && notes.length <= 200 &&
        notes.every(note => validPropertyNote(note) && note.propertyId === key))
        ? { field: value.field, value: content as Record<string, BuyerPropertyNote[]> } : { error: "Invalid property notes." };
    case "destinations":
      return Array.isArray(content) && content.length <= 20 && content.every(validLocation)
        ? { field: value.field, value: content } : { error: "Invalid saved locations." };
    case "chatHistory":
      return Array.isArray(content) && content.length <= 100 && content.every(validChatMessage)
        ? { field: value.field, value: content } : { error: "Invalid chat history." };
    default:
      return { error: "Unknown workspace field." };
  }
}
