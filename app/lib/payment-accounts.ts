/**
 * The shop's payment accounts, as printed on the Aphrodite Myanmar bank card.
 *
 * Bank transfers are typed by the customer from these numbers; MMQR is scanned
 * from the QR image. Both end with the customer uploading a transfer slip that
 * an admin verifies before the order can be confirmed or shipped.
 *
 * The images live in `public/payments/` (see `logo` / `qr` below). Until those
 * files are added the details still show; only the pictures are missing.
 */

export type PaymentMethod = "cash_on_delivery" | "bank_transfer" | "mmqr";

export type PrepaidMethod = Exclude<PaymentMethod, "cash_on_delivery">;

export type PaymentAccountId = "kbz" | "aya" | "mmqr";

export type PaymentAccount = {
  id: PaymentAccountId;
  method: PrepaidMethod;
  /** Shown as the account label, e.g. "KBZ (Special Account)". */
  label: string;
  holder: string;
  /** Bank accounts only: the number the customer transfers to. */
  accountNumber?: string;
  logo: string;
  /** MMQR only: the QR image the customer scans. */
  qr?: string;
  /**
   * The MMQR QR is for retail customers only, at the shop owner's request;
   * wholesale buyers pay by bank transfer.
   */
  retailOnly?: boolean;
};

export const PAYMENT_ACCOUNTS: PaymentAccount[] = [
  {
    id: "kbz",
    method: "bank_transfer",
    label: "KBZ (Special Account)",
    holder: "Aung Htet Thu + 1",
    accountNumber: "25151205701264601",
    logo: "/payments/kbz.png",
  },
  {
    id: "aya",
    method: "bank_transfer",
    label: "AYA (Special Account)",
    holder: "Aung Htet Thu + 1",
    accountNumber: "40038019281",
    logo: "/payments/aya.png",
  },
  {
    id: "mmqr",
    method: "mmqr",
    label: "MMQR (MyanmarPay)",
    holder: "Aphrodite Myanmar",
    logo: "/payments/mmqr-logo.png",
    qr: "/payments/mmqr-qr.png",
    retailOnly: true,
  },
];

/** Wholesale buyers get the bank accounts; the MMQR QR stays retail-only. */
export function paymentAccountsFor(options: { wholesale: boolean }) {
  return PAYMENT_ACCOUNTS.filter((account) => !(options.wholesale && account.retailOnly));
}

export function paymentAccountById(id: string | null | undefined) {
  return PAYMENT_ACCOUNTS.find((account) => account.id === id) ?? null;
}

/** COD needs no slip; everything else is paid before delivery. */
export function isPrepaidMethod(method: string | null | undefined): method is PrepaidMethod {
  return method === "bank_transfer" || method === "mmqr";
}
