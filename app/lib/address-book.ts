import { z } from "zod";
import { isApproximatelyInYangon, normalizeYangonTownship } from "./delivery-country";

export type SavedAddress = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  township: string;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export const savedAddressInputSchema = z.object({
  label: z.string().trim().min(1, "Give this address a label, such as Home or Office.").max(40),
  recipient_name: z.string().trim().min(2, "Recipient name is required.").max(200),
  phone: z.string().trim().min(7).max(30).regex(/^[0-9+\-()\s]+$/, "Enter a valid phone number."),
  address_line1: z.string().trim().min(2, "Enter the house number or building details.").max(300),
  address_line2: z.string().trim().max(300).optional().nullable(),
  township: z.string().trim().transform((value, context) => {
    const township = normalizeYangonTownship(value);
    if (!township) {
      context.addIssue({ code: "custom", message: "Select a Yangon township." });
      return z.NEVER;
    }
    return township;
  }),
  postal_code: z.string().trim().max(20).optional().nullable(),
  latitude: z.number().refine((value) => Number.isFinite(value)),
  longitude: z.number().refine((value) => Number.isFinite(value)),
  accuracy_m: z.number().nonnegative().max(100000).optional().nullable(),
  is_default: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (!isApproximatelyInYangon(value.latitude, value.longitude)) {
    context.addIssue({ code: "custom", path: ["latitude"], message: "Place the pin inside Yangon Region." });
  }
});

export type SavedAddressInput = z.infer<typeof savedAddressInputSchema>;
