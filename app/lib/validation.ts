import { z } from "zod";
import { isApproximatelyInYangon, isMyanmarCountry, normalizeMyanmarRegion, normalizeYangonTownship } from "./delivery-country";

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

export const pcBuildCartInputSchema = z.object({
  product_ids: z.array(z.number().int().positive()).min(1).max(8),
  quantity: z.number().int().positive().max(999),
});

export const wishlistInputSchema = z.object({
  product_id: z.number().int().positive().optional(),
  productId: z.number().int().positive().optional(),
});

export const productAlertInputSchema = z.object({
  product_id: z.number().int().positive(),
  kind: z.enum(["back_in_stock", "price_drop"]),
  // Optional ceiling for a price-drop alert ("tell me under 3,000,000").
  target_price: z.number().int().positive().max(2147483647).optional(),
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
    shipping_address_line1: z.string().trim().min(1).max(300).optional(),
    shipping_address_line2: z.string().trim().max(300).optional().nullable(),
    // Optional only for older clients that still send one combined
    // `shipping_address`. The current checkout always sends a township.
    shipping_city: z.string().trim().max(120).optional().transform((value, context) => {
      if (!value) return value;
      const township = normalizeYangonTownship(value);
      if (township) return township;
      if (value.toLowerCase() === "yangon") return "Yangon";
      context.addIssue({ code: "custom", message: "Select a Yangon township." });
      return z.NEVER;
    }),
    shipping_state: z.string().trim().refine((value) => normalizeMyanmarRegion(value) === "Yangon", "Delivery is available in Yangon only.").transform(() => "Yangon"),
    shipping_postal_code: z.string().trim().max(20).optional(),
    shipping_country: z.string().trim().refine(isMyanmarCountry, "We currently deliver within Myanmar only.").transform(() => "Myanmar"),
    payment_method: z
      .enum(["cash_on_delivery", "bank_transfer", "mmqr"])
      .default("cash_on_delivery"),
    /** Which account the customer says they paid into (bank transfer / MMQR). */
    payment_account: z.enum(["kbz", "aya", "mmqr"]).optional().nullable(),
    // The two COD promises below are checked in superRefine: they are required
    // for cash on delivery and meaningless for a prepaid order.
    cod_confirmation: z.literal(true).optional(),
    cod_contact_confirmation: z.literal(true).optional(),
    delivery_location_consent: z.boolean().optional().default(false),
    delivery_location: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy_m: z.number().nonnegative().max(100000).nullable(),
        captured_at: z.string().datetime({ offset: true }),
      })
      .optional()
      .nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    // The total the client last displayed. Used only to detect price drift
    // (409 response); the authoritative total is always recomputed server-side.
    expected_total: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    if (value.payment_method === "cash_on_delivery") {
      if (value.cod_confirmation !== true) {
        context.addIssue({
          code: "custom",
          path: ["cod_confirmation"],
          message: "Confirm that the delivery address and recipient are correct.",
        });
      }
      if (value.cod_contact_confirmation !== true) {
        context.addIssue({
          code: "custom",
          path: ["cod_contact_confirmation"],
          message: "Confirm that the recipient can answer the verification call.",
        });
      }
    } else if (!value.payment_account) {
      context.addIssue({
        code: "custom",
        path: ["payment_account"],
        message: "Choose the account you are paying into.",
      });
    } else if (value.payment_method === "mmqr" && value.payment_account !== "mmqr") {
      context.addIssue({
        code: "custom",
        path: ["payment_account"],
        message: "MMQR payments must use the MMQR account.",
      });
    } else if (value.payment_method === "bank_transfer" && value.payment_account === "mmqr") {
      context.addIssue({
        code: "custom",
        path: ["payment_account"],
        message: "Choose the KBZ or AYA bank account for a bank transfer.",
      });
    }
    if (value.delivery_location && !isApproximatelyInYangon(value.delivery_location.latitude, value.delivery_location.longitude)) {
      context.addIssue({
        code: "custom",
        path: ["delivery_location"],
        message: "This pin appears outside Yangon Region. Select the recipient’s Yangon location.",
      });
    }
    if (value.delivery_location && !value.delivery_location_consent) {
      context.addIssue({
        code: "custom",
        path: ["delivery_location_consent"],
        message: "Location coordinates require the customer's consent.",
      });
    }

    if (value.shipping_address) return;

    const requiredStructuredFields = [
      ["shipping_address_line1", value.shipping_address_line1],
      ["shipping_city", value.shipping_city],
      ["shipping_state", value.shipping_state],
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
    business_name: z.string().trim().min(2).max(160),
    business_review_note: z.string().trim().min(10).max(500),
    business_verified: z.literal(true),
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

const returnReasonCode = z.enum([
  "defective",
  "wrong_item",
  "wrong_color",
  "wrong_storage",
  "damaged_in_transit",
  "other",
]);

export const customerOrderActionSchema = z.union([
  z.object({
    action: z.literal("request_cancellation"),
    reason: orderRequestReason,
  }),
  z.object({
    action: z.literal("request_return"),
    reason: orderRequestReason,
    reason_code: returnReasonCode,
    pickup_method: z.literal("store_dropoff"),
    pickup_address: z.string().trim().max(500).optional().nullable(),
    evidence_url: z.string().trim().url().max(1000).optional().nullable(),
    evidence_attestation: z.literal(true),
  }),
  z.object({
    action: z.literal("request_return"),
    reason: orderRequestReason,
    reason_code: returnReasonCode,
    pickup_method: z.literal("courier_pickup"),
    pickup_address: z
      .string()
      .trim()
      .min(5, "Enter the address where the courier should collect the item.")
      .max(500),
    evidence_url: z.string().trim().url().max(1000).optional().nullable(),
    evidence_attestation: z.literal(true),
  }),
]);

// "Get help with this order": one button, five topics. The order, payment
// history, delivery events and past messages are attached server-side, so the
// customer only has to say what is wrong once.
export const helpCaseInputSchema = z.object({
  topic: z.enum([
    "payment",
    "delivery",
    "faulty_item",
    "cancel_order",
    "warranty",
  ]),
  summary: z
    .string()
    .trim()
    .min(5, "Please tell us briefly what went wrong.")
    .max(1000, "Please keep this under 1000 characters."),
});

export const adminHelpCaseUpdateSchema = z.object({
  status: z.enum(["open", "waiting_customer", "resolved", "closed"]),
  admin_note: z.string().trim().max(1000).optional().nullable(),
});

const returnResolution = z.enum(["replacement", "refund", "repair"]);

// A return names ONE order line, so a faulty mouse never drags the laptop it
// was bought with into the claim.
export const returnRequestInputSchema = z
  .object({
    order_id: z.string().uuid("A valid order is required."),
    order_item_id: z.string().uuid("Choose which item you are returning."),
    quantity: z.number().int().positive().max(999).default(1),
    reason_code: returnReasonCode,
    description: z
      .string()
      .trim()
      .min(10, "Please describe the problem in at least 10 characters.")
      .max(1000),
    preferred_resolution: returnResolution,
    collection_method: z.enum(["courier_pickup", "store_dropoff"]),
    pickup_address: z.string().trim().max(500).optional().nullable(),
    refund_bank_name: z.string().trim().max(120).optional().nullable(),
    refund_account_name: z.string().trim().max(160).optional().nullable(),
    refund_account_number: z
      .string()
      .trim()
      .max(80)
      .regex(/^[0-9A-Za-z .-]*$/, "Enter a valid bank account number.")
      .optional()
      .nullable(),
    preferred_service_at: z.string().datetime({ offset: true }).optional().nullable(),
    // The customer states they filmed the parcel before opening it.
    unboxing_video_confirmed: z.boolean().default(false),
    evidence_url: z.string().trim().url().max(1000).optional().nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.collection_method === "courier_pickup" &&
      (value.pickup_address ?? "").trim().length < 5
    ) {
      context.addIssue({
        code: "custom",
        path: ["pickup_address"],
        message: "Enter the address where the courier should collect the item.",
      });
    }
    // Transit damage is the one claim that depends on the unopened parcel, so
    // the continuous unboxing video is not optional there.
    if (
      value.reason_code === "damaged_in_transit" &&
      !value.unboxing_video_confirmed
    ) {
      context.addIssue({
        code: "custom",
        path: ["unboxing_video_confirmed"],
        message:
          "Transit damage needs the unboxing video you recorded before opening the parcel.",
      });
    }
    if (value.preferred_resolution === "refund") {
      if ((value.refund_bank_name ?? "").trim().length < 2) {
        context.addIssue({ code: "custom", path: ["refund_bank_name"], message: "Enter the bank or wallet name for your refund." });
      }
      if ((value.refund_account_name ?? "").trim().length < 2) {
        context.addIssue({ code: "custom", path: ["refund_account_name"], message: "Enter the account holder name for your refund." });
      }
      if ((value.refund_account_number ?? "").trim().length < 5) {
        context.addIssue({ code: "custom", path: ["refund_account_number"], message: "Enter the bank account or wallet number for your refund." });
      }
    }
    if (
      (value.preferred_resolution === "replacement" || value.preferred_resolution === "repair") &&
      !value.preferred_service_at
    ) {
      context.addIssue({ code: "custom", path: ["preferred_service_at"], message: "Choose your preferred replacement or repair date." });
    }
  });

/** A declined customer asking for one more look. */
export const returnReviewRequestSchema = z.object({
  action: z.literal("request_review"),
  note: z
    .string()
    .trim()
    .min(10, "Tell us what you would like us to look at again.")
    .max(1000),
});

export const adminReturnDecisionSchema = z
  .object({
    action: z.literal("decide"),
    decision: z.enum(["approve", "more_info", "decline"]),
    resolution_granted: returnResolution.optional().nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((value, context) => {
    // A decline or an information request is only fair if it says why.
    if (value.decision !== "approve" && (value.note ?? "").trim().length < 10) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message:
          "Explain your decision so the customer knows what to do next.",
      });
    }
  });

/** Moving an approved item-return along the refund ladder. */
export const adminReturnAdvanceSchema = z.object({
  action: z.literal("advance"),
  stage: z.enum(["collected", "inspected", "refund_approved", "completed"]),
  note: z.string().trim().max(1000).optional().nullable(),
  refund_amount: z.number().int().nonnegative().optional().nullable(),
  refund_method: z
    .enum(["cash", "bank_transfer", "mobile_wallet", "store_credit"])
    .optional()
    .nullable(),
  refund_reference: z.string().trim().max(200).optional().nullable(),
});

/**
 * The date shown to the customer, and the explanation when it moves. Kept
 * apart from `advance` so staff can promise (or correct) a date at any stage
 * without pushing the refund forward.
 */
export const adminRefundPlanSchema = z.object({
  action: z.literal("refund_plan"),
  expected_refund_at: z.string().datetime({ offset: true }).optional().nullable(),
  delay_reason: z.string().trim().max(500).optional().nullable(),
});

export const adminReturnRequestMutationSchema = z.union([
  adminReturnDecisionSchema,
  adminReturnAdvanceSchema,
  adminRefundPlanSchema,
]);

const queueSubjectType = z.enum(["order", "help_case", "return_request"]);

/** Giving a case an owner, a next action and a due date. */
export const adminQueueAssignmentSchema = z.object({
  subject_type: queueSubjectType,
  subject_id: z.string().uuid("A valid case is required."),
  owner_id: z.string().uuid().optional().nullable(),
  next_action: z.string().trim().max(300).optional().nullable(),
  due_at: z.string().datetime({ offset: true }).optional().nullable(),
});

/** Internal only. Never reaches the customer's support thread. */
export const adminStaffNoteSchema = z.object({
  subject_type: queueSubjectType,
  subject_id: z.string().uuid("A valid case is required."),
  body: z
    .string()
    .trim()
    .min(1, "Write the note before saving it.")
    .max(2000, "Notes must be 2000 characters or fewer."),
});

export const adminOrderResolutionSchema = z.object({
  action: z.literal("resolve_request"),
  request_type: z.enum(["cancellation", "return"]),
  decision: z.enum(["approve", "reject"]),
  admin_note: z.string().trim().max(500).optional().nullable(),
});

export const adminOrderCancellationSchema = z.object({
  action: z.literal("admin_cancel"),
  reason_code: z.enum([
    "out_of_stock",
    "pricing_error",
    "customer_request",
    "other",
  ]),
  reason: orderRequestReason,
  admin_note: z.string().trim().max(500).optional().nullable(),
});

export const cancellationRefundDetailsSchema = z.object({
  action: z.literal("submit_cancellation_refund_details"),
  bank_name: z.string().trim().min(2, "Enter the bank or wallet name.").max(120),
  account_name: z.string().trim().min(2, "Enter the account holder name.").max(160),
  account_number: z
    .string()
    .trim()
    .min(5, "Enter the bank account or wallet number.")
    .max(120)
    .regex(/^[0-9A-Za-z+ .()/-]+$/, "Enter a valid bank account or wallet number."),
});

export const completeCancellationRefundSchema = z.object({
  action: z.literal("complete_cancellation_refund"),
  refund_method: z.enum(["bank_transfer", "mobile_wallet"]),
  refund_reference: z.string().trim().min(3, "Enter the transfer reference.").max(200),
  refund_amount: z.number().int().positive(),
  admin_note: z.string().trim().max(500).optional().nullable(),
});

const optionalAdminText = z.string().trim().max(500).optional().nullable();

/** Admin decision on an uploaded transfer slip. */
export const adminPaymentVerificationSchema = z
  .object({
    action: z.literal("verify_payment"),
    decision: z.enum(["verified", "rejected", "correction_requested"]),
    /** Bank reference or transaction id the admin matched against the slip. */
    payment_reference: z.string().trim().max(200).optional().nullable(),
    reason: z.string().trim().max(500).optional().nullable(),
    /** What actually arrived, so the customer sees the exact remainder. */
    amount_received: z.number().int().nonnegative().optional().nullable(),
    correction_reason: z
      .enum(["short_payment", "overpaid", "unclear_slip", "wrong_account", "other"])
      .optional()
      .nullable(),
  })
  .superRefine((value, context) => {
    if (value.decision !== "correction_requested") return;

    if (!value.correction_reason) {
      context.addIssue({
        code: "custom",
        path: ["correction_reason"],
        message: "Choose what the customer needs to correct.",
      });
    }
    // The whole point of a correction is that the customer is told exactly
    // what to do, so the explanation is required rather than optional.
    if ((value.reason ?? "").trim().length < 10) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Explain the correction so the customer knows exactly what to send.",
      });
    }
    // Without a counted amount we cannot show a remainder, so "short payment"
    // would leave the customer guessing.
    if (
      (value.correction_reason === "short_payment" || value.correction_reason === "overpaid") &&
      typeof value.amount_received !== "number"
    ) {
      context.addIssue({
        code: "custom",
        path: ["amount_received"],
        message: "Enter how much actually arrived so the customer sees the exact amount.",
      });
    }
  });

/** Courier could not hand the order over: recorded against a shipped order. */
export const adminDeliveryAttemptSchema = z.object({
  action: z.literal("delivery_attempt_failed"),
  reason: z.enum([
    "no_answer",
    "phone_off",
    "address_problem",
    "customer_rescheduled",
    "nobody_home",
  ]),
  next_attempt_at: z.string().datetime({ offset: true }).optional().nullable(),
  admin_note: optionalAdminText,
});

export const adminReturnWorkflowSchema = z.union([
  z.object({
    action: z.literal("advance_return"),
    stage: z.literal("schedule_pickup"),
    scheduled_for: z.string().datetime({ offset: true }),
    instructions: optionalAdminText,
    tracking_number: z.string().trim().max(120).optional().nullable(),
    admin_note: optionalAdminText,
  }),
  z.object({
    action: z.literal("advance_return"),
    stage: z.literal("mark_received"),
    inspection_notes: optionalAdminText,
    restock_approved: z.boolean(),
    admin_note: optionalAdminText,
  }),
  z.object({
    action: z.literal("advance_return"),
    stage: z.literal("complete_refund"),
    refund_method: z.enum([
      "cash",
      "bank_transfer",
      "mobile_wallet",
      "store_credit",
    ]),
    refund_reference: z.string().trim().max(200).optional().nullable(),
    refund_amount: z.number().int().nonnegative(),
    admin_note: optionalAdminText,
  }),
]);

export const adminDeliveryUpdateSchema = z
  .object({
    action: z.literal("update_delivery"),
    callback_confirmed: z.boolean().default(false),
    address_confirmed: z.boolean().default(false),
    verification_note: z.string().trim().max(500).optional().nullable(),
    verification_status: z.enum([
      "pending",
      "phone_verified",
      "deposit_verified",
      "approved",
      "rejected",
    ]),
    verification_method: z
      .enum(["phone_callback", "cod_deposit", "admin_review"])
      .optional()
      .nullable(),
    courier_name: z.string().trim().max(120).optional().nullable(),
    tracking_number: z.string().trim().max(120).optional().nullable(),
    estimated_delivery_at: z.string().datetime({ offset: true }).optional().nullable(),
    stage: z
      .enum([
        "verification_pending",
        "verified",
        "packed",
        "handed_to_courier",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
      ])
      .optional()
      .nullable(),
    event_title: z.string().trim().min(2).max(120).optional().nullable(),
    event_description: z.string().trim().max(500).optional().nullable(),
    event_location: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.stage && !value.event_title) {
      context.addIssue({
        code: "custom",
        path: ["event_title"],
        message: "Add a customer-facing title for the delivery event.",
      });
    }
  });

// Admin: email the full receipt of a delivered order to the customer again.
export const adminReceiptResendSchema = z
  .object({ action: z.literal("resend_receipt") })
  .strict();

export const adminDeliveryProgressSchema = z
  .object({
    action: z.literal("advance_delivery_progress"),
    stage: z.enum([
      "verified",
      "packed",
      "handed_to_courier",
      "out_for_delivery",
      "delivered",
    ]),
  })
  .strict();

export const orderMutationSchema = z.union([
  orderStatusSchema,
  customerOrderActionSchema,
  adminOrderResolutionSchema,
  adminOrderCancellationSchema,
  adminReturnWorkflowSchema,
  adminDeliveryUpdateSchema,
  adminReceiptResendSchema,
  adminDeliveryProgressSchema,
  adminDeliveryAttemptSchema,
  adminPaymentVerificationSchema,
  cancellationRefundDetailsSchema,
  completeCancellationRefundSchema,
]);

// Instant-help assistant. Shorter cap than live support: these go to an
// external model, so the prompt stays small and cheap.
export const assistantMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Please enter a question.")
    .max(500, "Question must be 500 characters or fewer."),
  // Earlier turns of this conversation, so follow-up questions make sense.
  // Capped hard: this is client-supplied text that goes into the AI prompt.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().trim().max(1000),
      })
    )
    .max(10)
    .optional(),
});

// What the administrator broadcasts to customers in the live-chat panel.
export const adminPresenceSchema = z.object({
  status: z.enum(["online", "away", "busy", "offline"]),
  message: z
    .string()
    .trim()
    .max(200, "Message must be 200 characters or fewer.")
    .optional(),
  back_in_minutes: z
    .number()
    .int()
    .min(1, "Return time must be at least 1 minute.")
    .max(480, "Return time must be 8 hours or fewer.")
    .nullable()
    .optional(),
});

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

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

// The token comes from the emailed link, so it is opaque here -- only its
// shape is checked. Confirmation is matched in the form, not on the server:
// the server has nothing to compare a typo against.
export const passwordResetSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "This reset link is incomplete. Request a new one.")
    .max(512),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128),
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

// Wholesale signup. The invite code is the ONLY thing that can grant wholesale
// pricing -- the client still never sends a role (see the register route).
export const wholesaleRegisterInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  full_name: z.string().trim().max(200).optional(),
  invite_code: z
    .string()
    .trim()
    .min(6, "Enter the registration code your supplier gave you.")
    .max(64),
  business_name: z
    .string()
    .trim()
    .min(2, "Enter your business or shop name.")
    .max(160),
  contact_person: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const inviteCodeInputSchema = z.object({
  label: z.string().trim().max(160).optional(),
  price_list_id: z.string().uuid("Choose a valid price list.").optional(),
  max_uses: z
    .number()
    .int()
    .min(1, "A code must allow at least one use.")
    .max(500)
    .optional(),
  expires_in_days: z
    .number()
    .int()
    .min(1, "Expiry must be at least one day.")
    .max(365)
    .optional(),
});

export const percentBandInputSchema = z.object({
  price_list_id: z.string().uuid("Choose a valid price list."),
  product_id: z.number().int().positive().nullable().optional(),
  min_quantity: z.number().int().positive("Minimum quantity must be at least 1."),
  discount_percent: z
    .number()
    .min(0, "Discount must be 0% or more.")
    .max(90, "Discount cannot be more than 90%."),
  is_active: z.boolean().optional(),
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
