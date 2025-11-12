import { Message, Part } from "@a2a-js/sdk";

export function extractText(data: Message | string | undefined | null): string {
  if (!data) return "";

  if (typeof data === "string") return data;

  const parts = (data as Message).parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p: Part): p is Part & { text: string } => typeof (p as any).text === "string")
      .map(p => (p as any).text)
      .join("");
  }

  return JSON.stringify(data);
}