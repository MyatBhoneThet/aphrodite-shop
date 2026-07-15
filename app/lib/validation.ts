import { z } from "zod";

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Product name is required."),
  type: z.enum(["laptop", "accessory"]),
  category: z.string().trim().min(1, "Category is required."),
  brand: z.string().trim().min(1, "Brand is required."),
  price: z.number().int().nonnegative("Retail price must be 0 or more."),
  wholesalePrice: z
    .number()
    .int()
    .nonnegative("Wholesale price must be 0 or more.")
    .optional(),
  image: z.string().trim().min(1, "Image path is required."),
  model3D: z.string().trim().optional(),
  stock: z.enum(["In Stock", "Out of Stock"]),
  specs: z.record(z.string(), z.unknown()).default({}),
  fullSpecs: z.record(z.string(), z.unknown()).default({}),
});

// Admin edits may send a partial payload (only the changed fields).
export const productUpdateSchema = productInputSchema.partial();

export const cartItemInputSchema = z.object({
  product_id: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
  quantity: z.number().int().positive().max(99).optional(),
});

export const cartQuantityUpdateSchema = z.object({
  quantity: z.number().int().positive().max(99),
});

export const wishlistInputSchema = z.object({
  product_id: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
});

export const orderInputSchema = z.object({
  shipping_name: z.string().trim().min(1, "Shipping name is required."),
  shipping_phone: z.string().trim().min(1, "Shipping phone is required."),
  shipping_address: z.string().trim().min(1, "Shipping address is required."),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]),
});

export const loginInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const registerInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  full_name: z.string().trim().max(200).optional(),
});

export function firstIssueMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid request.";
}
