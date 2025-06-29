
"use server";

import { generateIcon } from "@/ai/flows/generate-icon";
import { improveIconPrompt } from "@/ai/flows/improve-icon-prompt";
import { z } from "zod";

const generateIconSchema = z.object({
  prompt: z.string(),
  referenceImageDataUri: z.string().optional(),
});

export async function generateIconAction(values: { prompt: string; referenceImageDataUri?: string }) {
  const parsed = generateIconSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: "Invalid input." };
  }

  try {
    const result = await generateIcon({ 
      prompt: parsed.data.prompt,
      referenceImageDataUri: parsed.data.referenceImageDataUri,
     });
    return { data: result, error: null };
  } catch (error) {
    console.error(error);
    return { data: null, error: "Failed to generate icon. Please try again." };
  }
}

const improvePromptSchema = z.object({
  prompt: z.string(),
});

export async function improvePromptAction(values: { prompt: string }) {
  const parsed = improvePromptSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: "Invalid input." };
  }

  try {
    const result = await improveIconPrompt({ iconPrompt: parsed.data.prompt });
    return { data: result, error: null };
  } catch (error) {
    console.error(error);
    return {
      data: null,
      error: "Failed to get suggestions. Please try again.",
    };
  }
}
