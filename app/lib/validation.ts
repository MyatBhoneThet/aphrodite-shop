import { z } from "zod";

const productJsonSchema = z.record(z.string(), z.unknown());

const productFields = {
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
  specs: productJsonSchema,
  fullSpecs: productJsonSchema,
};

export const productInputSchema = z.object({
  ...productFields,
  specs: productJsonSchema.default({}),
  fullSpecs: productJsonSchema.default({}),
});

// Admin edits may send a partial payload (only the changed fields), but an
// empty PATCH is never meaningful.
export const productUpdateSchema = z.object(productFields).partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one product field is required."
);

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

export const orderInputSchema = z
  .object({
    shipping_name: z
      .string()
      .trim()
      .min(2, "Shipping name is required.")
      .max(200),
    shipping_phone: z
      .string()
      .trim()
      .min(7, "Enter a valid delivery phone number.")
      .max(30)
      .regex(
        /^[0-9+\-()\s]+$/,
        "Phone number can only contain numbers, spaces, +, -, and parentheses."
      ),
    // `shipping_address` remains accepted for older API clients. New clients
    // submit the structured COD delivery fields below.
    shipping_address: z.string().trim().min(5).max(1000).optional(),
    shipping_address_line1: z.string().trim().min(3).max(300).optional(),
    shipping_address_line2: z.string().trim().max(300).optional().nullable(),
    shipping_city: z.string().trim().min(2).max(120).optional(),
    shipping_state: z.string().trim().min(2).max(120).optional(),
    shipping_postal_code: z.string().trim().min(2).max(20).optional(),
    shipping_country: z.string().trim().min(2).max(120).optional(),
    payment_method: z.literal("cash_on_delivery").default("cash_on_delivery"),
    notes: z.string().trim().max(1000).optional().nullable(),
    // The total the client last displayed. Used only to detect price drift
    // (409 response); the authoritative total is always recomputed server-side.
    expected_total: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    if (value.shipping_address) return;

    const requiredStructuredFields = [
      ["shipping_address_line1", value.shipping_address_line1],
      ["shipping_city", value.shipping_city],
      ["shipping_state", value.shipping_state],
      ["shipping_postal_code", value.shipping_postal_code],
      ["shipping_country", value.shipping_country],
    ] as const;

    for (const [path, fieldValue] of requiredStructuredFields) {
      if (!fieldValue) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: "Complete delivery address is required for cash on delivery.",
        });
      }
    }
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
  status: z.enum(["pending", "confirmed", "shipped", "delivered"]),
});

const orderRequestReason = z
  .string()
  .trim()
  .min(3, "Please provide a reason.")
  .max(500, "Reason must be 500 characters or fewer.");

export const customerOrderActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request_cancellation"),
    reason: orderRequestReason,
  }),
  z.object({
    action: z.literal("request_return"),
    reason: orderRequestReason,
  }),
]);

export const adminOrderResolutionSchema = z.object({
  action: z.literal("resolve_request"),
  request_type: z.enum(["cancellation", "return"]),
  decision: z.enum(["approve", "reject"]),
  admin_note: z.string().trim().max(500).optional().nullable(),
});

export const orderMutationSchema = z.union([
  orderStatusSchema,
  customerOrderActionSchema,
  adminOrderResolutionSchema,
]);

export const supportMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Please enter a message.")
    .max(1000, "Message must be 1000 characters or fewer."),
});

export const supportConversationStatusSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

const optionalSettingsText = (maximum: number) =>
  z.string().trim().max(maximum);

export const customerSettingsSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(200),
  phone: optionalSettingsText(30).refine(
    (value) => !value || /^[0-9+\-()\s]+$/.test(value),
    "Phone number can only contain numbers, spaces, +, -, and parentheses."
  ),
  shipping_address_line1: optionalSettingsText(300),
  shipping_address_line2: optionalSettingsText(300),
  shipping_city: optionalSettingsText(120),
  shipping_state: optionalSettingsText(120),
  shipping_postal_code: optionalSettingsText(20),
  shipping_country: z.string().trim().min(2).max(120),
  preferred_language: z.enum(["en", "my"]),
  order_updates_enabled: z.boolean(),
  support_updates_enabled: z.boolean(),
  marketing_emails_enabled: z.boolean(),
});

export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required."),
    new_password: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128),
  })
  .refine((value) => value.current_password !== value.new_password, {
    path: ["new_password"],
    message: "New password must be different from the current password.",
  });

export const recentlyViewedInputSchema = z.object({
  product_id: z.number().int().positive("A valid product is required."),
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

/**
 * Parses a product id path segment. Product ids are positive integers; anything
 * else (e.g. "abc", "1.5", "-2") returns null so routes can answer 404
 * instead of forwarding `id=eq.NaN` to PostgREST (which fails with a 500).
 */
export function parseProductIdParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
