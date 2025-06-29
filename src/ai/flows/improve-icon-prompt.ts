// src/ai/flows/improve-icon-prompt.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow that improves an icon prompt by rewriting it.
 *
 * - improveIconPrompt - A function that takes an icon prompt and returns several improved versions.
 * - ImproveIconPromptInput - The input type for the improveIconPrompt function.
 * - ImproveIconPromptOutput - The return type for the improveIconPrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImproveIconPromptInputSchema = z.object({
  iconPrompt: z.string().describe('The original icon prompt.'),
});
export type ImproveIconPromptInput = z.infer<typeof ImproveIconPromptInputSchema>;

const ImproveIconPromptOutputSchema = z.object({
  improvedPrompts: z.array(z.string()).describe('An array of improved icon prompts.'),
});
export type ImproveIconPromptOutput = z.infer<typeof ImproveIconPromptOutputSchema>;

export async function improveIconPrompt(
  input: ImproveIconPromptInput
): Promise<ImproveIconPromptOutput> {
  return improveIconPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'improveIconPrompt',
  input: {schema: ImproveIconPromptInputSchema},
  output: {schema: ImproveIconPromptOutputSchema},
  prompt: `You are an expert at writing creative and detailed image generation prompts. Rewrite the following icon prompt in 3 different, more creative and detailed ways.

Original Prompt: {{{iconPrompt}}}

Improved Prompts:`,
});

const improveIconPromptFlow = ai.defineFlow(
  {
    name: 'improveIconPromptFlow',
    inputSchema: ImproveIconPromptInputSchema,
    outputSchema: ImproveIconPromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
