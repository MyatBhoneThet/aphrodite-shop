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
  stockQuantity: z
    .number()
    .int()
    .nonnegative("Stock quantity must be 0 or more.")
    .optional(),
  specs: z.record(z.string(), z.unknown()).default({}),
  fullSpecs: z.record(z.string(), z.unknown()).default({}),
});

// Admin edits may send a partial payload (only the changed fields).
export const productUpdateSchema = productInputSchema.partial();

// Wholesale bulk orders need large quantities; 9999 is a sanity cap, the
// real limit is per-product inventory (validated server-side).
export const cartItemInputSchema = z.object({
  product_id: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
  quantity: z.number().int().positive().max(9999).optional(),
});

export const cartQuantityUpdateSchema = z.object({
  quantity: z.number().int().positive().max(9999),
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
  // The total the client last displayed. Used only to detect price drift
  // (409 response); the authoritative total is always recomputed server-side.
  expected_total: z.number().int().nonnegative().optional(),
});

// Wholesale accounts are provisioned by an administrator only (there is no
// self-service application flow): grant turns an existing customer account
// into a wholesale account, revoke turns it back into a normal one.
export const wholesaleAccountUpdateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    price_list_id: z.string().uuid().optional().nullable(),
  }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("reactivate") }),
  z.object({
    action: z.literal("assign_price_list"),
    price_list_id: z.string().uuid("A valid price list is required."),
  }),
]);

export const priceListInputSchema = z.object({
  name: z.string().trim().min(2, "Price list name is required.").max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const priceListUpdateSchema = priceListInputSchema.partial();

const tierDates = {
  effective_from: z.string().datetime({ offset: true }).optional().nullable(),
  effective_to: z.string().datetime({ offset: true }).optional().nullable(),
};

export const tierInputSchema = z.object({
  price_list_id: z.string().uuid("A valid price list is required."),
  product_id: z.number().int().positive("A valid product is required."),
  min_quantity: z
    .number()
    .int()
    .positive("Minimum quantity must be at least 1."),
  unit_price: z.number().int().nonnegative("Unit price must be 0 or more."),
  is_active: z.boolean().optional(),
  ...tierDates,
});

export const tierUpdateSchema = z.object({
  min_quantity: z.number().int().positive().optional(),
  unit_price: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
  ...tierDates,
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
