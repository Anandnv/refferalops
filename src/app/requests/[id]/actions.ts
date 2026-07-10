"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db/client";

export async function addNote(requestId: string, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await prisma.note.create({ data: { requestId, content } });
  revalidatePath(`/requests/${requestId}`);
}
