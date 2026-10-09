import { z } from "zod";

export const locationShareSchema = z.object({
  consent: z.literal(true),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy_m: z.number().finite().min(0).max(20_000_000),
}).strict();

export type LocationShare = {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  captured_at: string;
  expires_at: string;
};

export const LOCATION_CONSENT_VERSION = "store-review-v1";
export const LOCATION_RETENTION_DAYS = 30;
