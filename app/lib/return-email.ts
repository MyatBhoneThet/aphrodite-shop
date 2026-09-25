import { emailFooterHtml } from "./email-footer";
import {
  isUnreachableFromEmail,
  publicSiteUrl,
  sendMail,
  type MailContent,
  type MailResult,
} from "./mailer";
import type { ReturnRequestRow, ReturnRequestStatus } from "./supabase";

export type ReturnEmailEvent = ReturnRequestStatus | "refund_plan_updated";

type StatusCopy = {
  heading: string;
  summary: string;
  burmeseHeading: string;
  burmeseSummary: string;
};

const STATUS_COPY: Record<ReturnEmailEvent, StatusCopy> = {
  requested: {
    heading: "Return request received",
    summary: "We received your request and our team will review the information you sent.",
    burmeseHeading: "ပစ္စည်းပြန်အပ်ရန် တောင်းဆိုချက်ကို လက်ခံရရှိပါပြီ",
    burmeseSummary: "သင်ပေးပို့ထားသော အချက်အလက်များကို ကျွန်ုပ်တို့အဖွဲ့မှ စစ်ဆေးပါမည်။",
  },
  more_info_needed: {
    heading: "More information is needed",
    summary: "We need a little more information before we can continue. Please open your order and check the staff note.",
    burmeseHeading: "နောက်ထပ်အချက်အလက် လိုအပ်ပါသည်",
    burmeseSummary: "ဆက်လက်ဆောင်ရွက်နိုင်ရန် သင့်အော်ဒါရှိ ဝန်ထမ်းမှတ်ချက်ကို ကြည့်ပြီး လိုအပ်သည့်အချက်အလက် ပေးပို့ပါ။",
  },
  approved: {
    heading: "Return approved — under review",
    summary: "Your return was approved. We are now waiting for the item to be collected or dropped off and checked.",
    burmeseHeading: "ပစ္စည်းပြန်အပ်မှုကို အတည်ပြုပြီး စစ်ဆေးနေပါသည်",
    burmeseSummary: "ပစ္စည်းကို လာယူခြင်း သို့မဟုတ် ဆိုင်သို့ လာပို့ခြင်းပြီးနောက် စစ်ဆေးပါမည်။",
  },
  declined: {
    heading: "Return request declined",
    summary: "We could not approve this request. Open your order to read the reason or ask us to review it again.",
    burmeseHeading: "ပစ္စည်းပြန်အပ်မှုကို အတည်မပြုနိုင်ပါ",
    burmeseSummary: "အကြောင်းရင်းကိုကြည့်ရန် သင့်အော်ဒါကိုဖွင့်ပါ။ လိုအပ်ပါက ပြန်လည်စစ်ဆေးပေးရန် တောင်းဆိုနိုင်ပါသည်။",
  },
  collected: {
    heading: "Item received for return",
    summary: "Your item has been collected or received at the store. Our team will inspect it next.",
    burmeseHeading: "ပြန်အပ်သည့်ပစ္စည်းကို လက်ခံရရှိပါပြီ",
    burmeseSummary: "ပစ္စည်းကို လက်ခံရရှိပြီး နောက်တစ်ဆင့်တွင် စစ်ဆေးပါမည်။",
  },
  inspected: {
    heading: "Item inspection completed",
    summary: "We finished checking the returned item and are preparing the approved resolution.",
    burmeseHeading: "ပစ္စည်းစစ်ဆေးမှု ပြီးဆုံးပါပြီ",
    burmeseSummary: "ပြန်အပ်သည့်ပစ္စည်းကို စစ်ဆေးပြီး အတည်ပြုထားသည့် ဖြေရှင်းမှုကို ပြင်ဆင်နေပါသည်။",
  },
  refund_approved: {
    heading: "Refund approved",
    summary: "Your refund is approved. We will send the money using the refund details on your request.",
    burmeseHeading: "ငွေပြန်အမ်းမှုကို အတည်ပြုပါပြီ",
    burmeseSummary: "သင့်တောင်းဆိုချက်ရှိ ငွေပြန်အမ်းရန်အချက်အလက်များအတိုင်း ငွေပေးပို့ပါမည်။",
  },
  completed: {
    heading: "Refund process completed",
    summary: "Your return process is complete. If this was a refund, the money has been sent and the payment reference is shown below.",
    burmeseHeading: "ငွေပြန်အမ်းမှု လုပ်ငန်းစဉ်ပြီးဆုံးပါပြီ",
    burmeseSummary: "ငွေပြန်အမ်းမှုဖြစ်ပါက ငွေပေးပို့ပြီးဖြစ်ပြီး အောက်တွင် ငွေလွှဲအမှတ်ကို ကြည့်နိုင်ပါသည်။",
  },
  cancelled: {
    heading: "Return request cancelled",
    summary: "This return request has been cancelled. Open your order or contact us if you need help.",
    burmeseHeading: "ပစ္စည်းပြန်အပ်မှုကို ပယ်ဖျက်ထားပါသည်",
    burmeseSummary: "အကူအညီလိုအပ်ပါက သင့်အော်ဒါကိုဖွင့်ပါ သို့မဟုတ် ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ။",
  },
  refund_plan_updated: {
    heading: "Refund timing updated",
    summary: "The expected refund date or refund information for your return has been updated.",
    burmeseHeading: "ငွေပြန်အမ်းမည့်အချိန်ကို ပြင်ဆင်ထားပါသည်",
    burmeseSummary: "သင့်ပစ္စည်းပြန်အပ်မှုအတွက် ခန့်မှန်းငွေပြန်အမ်းရက် သို့မဟုတ် အချက်အလက်ကို ပြင်ဆင်ထားပါသည်။",
  },
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortCode(id: string) {
  return id.replaceAll("-", "").slice(0, 8).toUpperCase();
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return null;
  return `MMK ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Yangon",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : null;
}

export function returnStatusEmailContent(
  request: ReturnRequestRow,
  event: ReturnEmailEvent,
  env: NodeJS.ProcessEnv = process.env
): MailContent {
  const copy = STATUS_COPY[event];
  const orderUrl = `${publicSiteUrl(env)}/orders`;
  const product = request.order_items?.products?.name ?? "Returned item";
  const details = [
    ["Order", `#${shortCode(request.order_id)}`],
    ["Item", `${product} × ${request.quantity}`],
    ["Resolution", label(request.resolution_granted ?? request.preferred_resolution)],
    ["Refund amount", formatMoney(request.refund_amount)],
    ["Expected refund", formatDate(request.expected_refund_at)],
    ["Refund method", label(request.refund_method)],
    ["Payment reference", request.refund_reference],
    ["Update from our team", request.admin_decision_note],
    ["Reason for date change", request.delay_reason],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  const detailHtml = details
    .map(
      ([key, value]) => `<tr>
        <td style="padding:7px 12px 7px 0;color:#71717a;vertical-align:top">${escapeHtml(key)}</td>
        <td style="padding:7px 0;color:#18181b;font-weight:600">${escapeHtml(value)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:640px;margin:0 auto;padding:28px 12px">
      <div style="background:#fff;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden">
        <div style="height:6px;background:#ef0011"></div>
        <div style="padding:28px 24px 4px">
          <div style="color:#ef0011;font-size:12px;font-weight:800;letter-spacing:1.5px">APHRODITE MYANMAR · RETURN UPDATE</div>
          <h1 style="font-size:27px;line-height:34px;margin:14px 0 10px">${escapeHtml(copy.heading)}</h1>
          <p style="font-size:16px;line-height:25px;color:#52525b;margin:0 0 18px">${escapeHtml(copy.summary)}</p>
          <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:12px 16px;margin-bottom:20px">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:20px">${detailHtml}</table>
          </div>
          <div style="border-top:1px solid #e4e4e7;padding-top:18px">
            <div style="font-size:19px;font-weight:800;line-height:28px">${escapeHtml(copy.burmeseHeading)}</div>
            <p style="font-size:15px;line-height:25px;color:#52525b;margin:8px 0 20px">${escapeHtml(copy.burmeseSummary)}</p>
          </div>
          <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:13px 22px">View return progress</a>
        </div>
        ${emailFooterHtml()}
      </div>
    </div>
  </body></html>`;

  const textDetails = details.map(([key, value]) => `${key}: ${value}`).join("\n");
  const text = [
    copy.heading,
    copy.summary,
    "",
    textDetails,
    "",
    copy.burmeseHeading,
    copy.burmeseSummary,
    "",
    `View return progress: ${orderUrl}`,
  ].join("\n");

  return { subject: `${copy.heading} — Aphrodite Myanmar`, html, text };
}

/** Sends a return/refund update without ever throwing into the workflow. */
export async function sendReturnStatusEmail(
  request: ReturnRequestRow,
  event: ReturnEmailEvent,
  options: { idempotencySuffix?: string } = {},
  env: NodeJS.ProcessEnv = process.env
): Promise<MailResult> {
  const recipient = request.profiles?.email;
  if (!recipient) return { status: "not_configured" };

  if (isUnreachableFromEmail(publicSiteUrl(env))) {
    console.warn("[returns] email links point at a local address; set PUBLIC_SITE_URL", {
      return_request_id: request.id,
      base: publicSiteUrl(env),
    });
  }

  return sendMail(recipient, returnStatusEmailContent(request, event, env), {
    idempotencyKey: ["return", request.id, event, options.idempotencySuffix]
      .filter(Boolean)
      .join("-"),
    env,
  });
}
