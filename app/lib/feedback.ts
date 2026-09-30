import { z } from "zod";

export const feedbackInputSchema = z.object({
  order_id: z.string().uuid(),
  rating: z.number().int().min(1, "Choose a star rating.").max(5),
  note: z.string().trim().max(1000, "Keep your note under 1000 characters.").optional().nullable(),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
