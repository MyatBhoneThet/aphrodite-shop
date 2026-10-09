import { APHRODITE_BRANCHES, APHRODITE_HOURS } from "./contact-info";

/**
 * The text of the privacy policy and the data-deletion instructions, in both
 * languages, as data.
 *
 * Kept here rather than inside the pages for the same reason contact-info.ts
 * exists: the content is what changes, the rendering is not. It is also the
 * only honest way to keep the English and Burmese versions side by side,
 * where a section missing from one language is visible at a glance.
 *
 * This is not boilerplate copied from a generator. Every collection listed
 * below corresponds to something this codebase actually stores -- the columns
 * in supabase/schema.sql and its migrations -- and the retention promises
 * match what the database actually enforces. If you add a table that holds
 * customer data, it belongs here too.
 */

export type LegalSection = {
  heading: { en: string; my: string };
  /** Paragraphs. */
  body?: { en: string; my: string }[];
  /** Bulleted list, rendered under the paragraphs. */
  bullets?: { en: string; my: string }[];
};

/** Kept in one place so both pages can show the same "last reviewed" date. */
export const LEGAL_LAST_UPDATED = "2026-09-20";

const contactLine = {
  en: `${APHRODITE_BRANCHES[0].phones.join(" or ")} (${APHRODITE_HOURS.toLowerCase()})`,
  my: `${APHRODITE_BRANCHES[0].phones.join(" သို့မဟုတ် ")} (${APHRODITE_HOURS})`,
};

export const PRIVACY_INTRO = {
  en: "This policy explains what Aphrodite Myanmar collects when you use this website, why we collect it, who else can see it, and how to get it removed. It covers only this website and the orders placed through it.",
  my: "ဤမူဝါဒသည် Aphrodite Myanmar ဝဘ်ဆိုက်ကို အသုံးပြုသည့်အခါ ကျွန်ုပ်တို့ စုဆောင်းသည့် အချက်အလက်များ၊ အဘယ်ကြောင့် စုဆောင်းသည်၊ မည်သူမြင်နိုင်သည်နှင့် မည်သို့ ဖျက်ရမည်ကို ရှင်းပြထားပါသည်။",
};

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: { en: "What we collect", my: "ကျွန်ုပ်တို့ စုဆောင်းသည့် အချက်အလက်" },
    body: [
      {
        en: "We only store what the shop needs in order to work. That is:",
        my: "ဆိုင်လည်ပတ်ရန် လိုအပ်သည်များကိုသာ သိမ်းဆည်းပါသည်။ ၎င်းတို့မှာ —",
      },
    ],
    bullets: [
      {
        en: "Your account: email address, name, and phone number if you give one. Your password is stored only as a scrambled value that cannot be read back, and staff cannot see it.",
        my: "အကောင့်အချက်အလက် — အီးမေးလ်၊ အမည်နှင့် ဖုန်းနံပါတ် (ပေးထားပါက)။ စကားဝှက်ကို ပြန်ဖတ်၍မရသော ပုံစံဖြင့်သာ သိမ်းထားပြီး ဝန်ထမ်းများ မမြင်နိုင်ပါ။",
      },
      {
        en: "Orders: the delivery name, phone number and address you enter, what you bought, the price you paid, and the status of the order.",
        my: "အော်ဒါများ — ပို့ဆောင်ရန် အမည်၊ ဖုန်းနံပါတ်၊ လိပ်စာ၊ ဝယ်ယူသည့်ပစ္စည်း၊ ပေးချေသည့်စျေးနှုန်းနှင့် အော်ဒါအခြေအနေ။",
      },
      {
        en: "Anything you upload yourself: payment slips, and photos attached to a return or a support request.",
        my: "သင်တင်သော ဖိုင်များ — ငွေလွှဲပြေစာနှင့် ပစ္စည်းပြန်အမ်းခြင်း သို့မဟုတ် အကူအညီတောင်းခံမှုတွင် ပူးတွဲသော ဓာတ်ပုံများ။",
      },
      {
        en: "Shop activity: your cart, wishlist, recently viewed products, and any messages you send us in the chat.",
        my: "ဆိုင်တွင်းလှုပ်ရှားမှု — ဈေးခြင်း၊ စိတ်ကြိုက်စာရင်း၊ မကြာသေးမီက ကြည့်ရှုခဲ့သော ပစ္စည်းများနှင့် Chat မှ ပေးပို့သော စာများ။",
      },
      {
        en: "Your delivery location, but only if you tap to share it. We keep the map point and how accurate it is, never a continuous track of where you go.",
        my: "ပို့ဆောင်ရန်တည်နေရာ — သင်ကိုယ်တိုင် မျှဝေမှသာ ရယူပါသည်။ မြေပုံအမှတ်နှင့် တိကျမှုကိုသာ သိမ်းပြီး သင်သွားလာသည်ကို အမြဲခြေရာခံခြင်း မရှိပါ။",
      },
      {
        en: "Your settings: preferred language, and which emails you want to receive.",
        my: "ဆက်တင်များ — ဘာသာစကားရွေးချယ်မှုနှင့် လက်ခံလိုသော အီးမေးလ်အမျိုးအစားများ။",
      },
    ],
  },
  {
    heading: {
      en: "What we never collect",
      my: "ကျွန်ုပ်တို့ လုံးဝမစုဆောင်းသည့် အချက်အလက်",
    },
    bullets: [
      {
        en: "Card or bank details. This shop is cash on delivery only, so there is no card number to enter and none is ever stored.",
        my: "ကတ် သို့မဟုတ် ဘဏ်အချက်အလက်များ။ ဤဆိုင်သည် အိမ်အရောက်ငွေချေစနစ်သာဖြစ်၍ ကတ်နံပါတ် ထည့်စရာမလိုသလို သိမ်းဆည်းထားခြင်းလည်း မရှိပါ။",
      },
      {
        en: "Your password from Google, Facebook or LINE. When you sign in with one of those, we never see your password for it.",
        my: "Google, Facebook သို့မဟုတ် LINE ၏ စကားဝှက်။ ၎င်းတို့ဖြင့် ဝင်ရောက်သည့်အခါ သင့်စကားဝှက်ကို ကျွန်ုပ်တို့ လုံးဝမမြင်ရပါ။",
      },
    ],
  },
  {
    heading: {
      en: "Signing in with Google, Facebook or LINE",
      my: "Google, Facebook သို့မဟုတ် LINE ဖြင့် ဝင်ရောက်ခြင်း",
    },
    body: [
      {
        en: "If you choose one of these buttons, that company tells us your email address and your name, and nothing else. We use the email address to create or find your account. We do not post anything to your account, read your friends or contacts, or see your activity on their service.",
        my: "ဤခလုတ်များထဲမှ တစ်ခုကို ရွေးပါက ထိုကုမ္ပဏီမှ သင့်အီးမေးလ်နှင့် အမည်ကိုသာ ကျွန်ုပ်တို့အား ပေးပါသည်။ ထိုအီးမေးလ်ဖြင့် အကောင့်ကို ဖန်တီး သို့မဟုတ် ရှာဖွေပါသည်။ သင့်အကောင့်တွင် မည်သည့်အရာမျှ တင်ခြင်း၊ သူငယ်ချင်းစာရင်း ဖတ်ခြင်း သို့မဟုတ် ၎င်းတို့ဝန်ဆောင်မှုတွင် သင့်လှုပ်ရှားမှုကို ကြည့်ခြင်း မပြုပါ။",
      },
      {
        en: "Using these buttons is always optional. You can register with an email address and a password instead.",
        my: "ဤခလုတ်များ အသုံးပြုခြင်းသည် ရွေးချယ်ခွင့်သာဖြစ်သည်။ အီးမေးလ်နှင့် စကားဝှက်ဖြင့်လည်း အကောင့်ဖွင့်နိုင်ပါသည်။",
      },
    ],
  },
  {
    heading: { en: "Who else can see it", my: "အခြားမည်သူမြင်နိုင်သနည်း" },
    body: [
      {
        en: "We do not sell your information and we do not share it for advertising. It reaches these companies only because the shop runs on their services:",
        my: "သင့်အချက်အလက်ကို ရောင်းချခြင်း မရှိသလို ကြော်ငြာအတွက် မျှဝေခြင်းလည်း မရှိပါ။ ဆိုင်လည်ပတ်ရန် အသုံးပြုသော ဝန်ဆောင်မှုများကြောင့်သာ အောက်ပါကုမ္ပဏီများထံ ရောက်ရှိပါသည် —",
      },
    ],
    bullets: [
      {
        en: "Supabase — stores the database, your account, and the files you upload.",
        my: "Supabase — ဒေတာဘေ့စ်၊ အကောင့်နှင့် သင်တင်သော ဖိုင်များကို သိမ်းဆည်းပေးသည်။",
      },
      {
        en: "Google Cloud — runs the website itself.",
        my: "Google Cloud — ဝဘ်ဆိုက်ကို လည်ပတ်စေသည်။",
      },
      {
        en: "Gmail — sends your order confirmations and receipts.",
        my: "Gmail — အော်ဒါအတည်ပြုချက်နှင့် ပြေစာများ ပေးပို့ပေးသည်။",
      },
      {
        en: "Google Gemini — only if you use the Instant help assistant. What you type into that assistant is sent to Google to produce an answer. Do not type anything private into it.",
        my: "Google Gemini — အကူအညီ Assistant ကို သုံးမှသာ။ ထိုနေရာတွင် ရိုက်ထည့်သည်များကို အဖြေထုတ်ရန် Google ထံ ပေးပို့ပါသည်။ ကိုယ်ရေးကိုယ်တာ အချက်အလက်များ မရိုက်ထည့်ပါနှင့်။",
      },
      {
        en: "Our delivery staff — they see the name, phone number and address on an order so they can bring it to you.",
        my: "ပို့ဆောင်ရေးဝန်ထမ်းများ — ပစ္စည်းပို့ဆောင်ရန်အတွက် အော်ဒါပေါ်ရှိ အမည်၊ ဖုန်းနံပါတ်နှင့် လိပ်စာကို မြင်ရပါသည်။",
      },
    ],
  },
  {
    heading: { en: "How long we keep it", my: "မည်မျှကြာ သိမ်းထားသနည်း" },
    bullets: [
      {
        en: "A shared delivery location is deleted automatically after 30 days. The database enforces this, not a person.",
        my: "မျှဝေထားသော တည်နေရာကို ရက် ၃၀ အကြာတွင် အလိုအလျောက် ဖျက်ပါသည်။ လူမဟုတ်ဘဲ စနစ်ကိုယ်တိုင် ဆောင်ရွက်ပါသည်။",
      },
      {
        en: "Order records are kept as business and accounting records for as long as the law requires.",
        my: "အော်ဒါမှတ်တမ်းများကို စီးပွားရေးနှင့် စာရင်းကိုင်မှတ်တမ်းအဖြစ် ဥပဒေလိုအပ်သမျှ ကာလအထိ သိမ်းထားပါသည်။",
      },
      {
        en: "Everything else is kept until you ask us to delete your account.",
        my: "ကျန်အချက်အလက်များကို အကောင့်ဖျက်ရန် တောင်းဆိုသည်အထိ သိမ်းထားပါသည်။",
      },
    ],
  },
  {
    heading: { en: "What you can do", my: "သင်လုပ်ဆောင်နိုင်သည်များ" },
    bullets: [
      {
        en: "Change your name, phone number, address and email preferences yourself, on the Settings page.",
        my: "အမည်၊ ဖုန်းနံပါတ်၊ လိပ်စာနှင့် အီးမေးလ်ရွေးချယ်မှုများကို Settings စာမျက်နှာတွင် ကိုယ်တိုင် ပြင်နိုင်ပါသည်။",
      },
      {
        en: "Stop sharing your delivery location at any time. Turning it off in your browser stops any new location reaching us.",
        my: "တည်နေရာမျှဝေခြင်းကို အချိန်မရွေး ရပ်တန့်နိုင်ပါသည်။ ဘရောက်ဇာတွင် ပိတ်လိုက်ပါက တည်နေရာအသစ် ကျွန်ုပ်တို့ထံ မရောက်တော့ပါ။",
      },
      {
        en: "Ask for your account and its data to be deleted — see the Delete your data page.",
        my: "အကောင့်နှင့် ၎င်း၏အချက်အလက်များ ဖျက်ပေးရန် တောင်းဆိုနိုင်သည် — အချက်အလက်ဖျက်သိမ်းခြင်း စာမျက်နှာကို ကြည့်ပါ။",
      },
      {
        en: "Ask us what we hold about you, by phone or in person at either branch.",
        my: "သင်နှင့်ပတ်သက်၍ မည်သည့်အချက်အလက် သိမ်းထားကြောင်း ဖုန်းဖြင့်ဖြစ်စေ၊ ဆိုင်သို့ကိုယ်တိုင်လာ၍ဖြစ်စေ မေးမြန်းနိုင်ပါသည်။",
      },
    ],
  },
  {
    heading: { en: "Children", my: "ကလေးသူငယ်များ" },
    body: [
      {
        en: "This shop is meant for adults. We do not knowingly create accounts for children under 13. If you believe a child has an account here, call us and we will remove it.",
        my: "ဤဆိုင်သည် အရွယ်ရောက်ပြီးသူများအတွက် ရည်ရွယ်ပါသည်။ အသက် ၁၃ နှစ်အောက် ကလေးများအတွက် အကောင့် တမင်ဖွင့်ပေးခြင်း မရှိပါ။ ကလေးတစ်ဦး အကောင့်ရှိသည်ဟု ယူဆပါက ဖုန်းဆက်ပါ၊ ဖျက်ပေးပါမည်။",
      },
    ],
  },
  {
    heading: { en: "Changes to this policy", my: "ဤမူဝါဒ ပြောင်းလဲမှုများ" },
    body: [
      {
        en: "If we change what we collect or who it reaches, we will update this page and the date at the top of it.",
        my: "စုဆောင်းသည့်အချက်အလက် သို့မဟုတ် မျှဝေသည့်နေရာ ပြောင်းလဲပါက ဤစာမျက်နှာနှင့် အပေါ်ရှိ ရက်စွဲကို ပြင်ဆင်ပါမည်။",
      },
    ],
  },
  {
    heading: { en: "Contact us", my: "ဆက်သွယ်ရန်" },
    body: [
      {
        en: `Call ${contactLine.en}, or visit either branch — the addresses are at the bottom of the home page.`,
        my: `${contactLine.my} သို့ ဖုန်းဆက်ပါ၊ သို့မဟုတ် ဆိုင်ခွဲများသို့ လာရောက်နိုင်ပါသည် — လိပ်စာများကို ပင်မစာမျက်နှာအောက်ခြေတွင် ဖော်ပြထားပါသည်။`,
      },
    ],
  },
];

export const DELETION_INTRO = {
  en: "You can ask us to delete your Aphrodite Myanmar account and the data attached to it at any time, whether you registered with an email address or signed in with Google, Facebook or LINE.",
  my: "အီးမေးလ်ဖြင့် အကောင့်ဖွင့်ထားသည်ဖြစ်စေ၊ Google, Facebook သို့မဟုတ် LINE ဖြင့် ဝင်ရောက်ထားသည်ဖြစ်စေ သင့် Aphrodite Myanmar အကောင့်နှင့် ဆက်စပ်အချက်အလက်များကို အချိန်မရွေး ဖျက်ပေးရန် တောင်းဆိုနိုင်ပါသည်။",
};

export const DELETION_SECTIONS: LegalSection[] = [
  {
    heading: { en: "How to ask", my: "မည်သို့တောင်းဆိုရမည်" },
    body: [
      {
        en: `Call ${contactLine.en} and say you want your account deleted. Tell us the email address or phone number on the account so we can find it.`,
        my: `${contactLine.my} သို့ ဖုန်းဆက်၍ အကောင့်ဖျက်လိုကြောင်း ပြောပါ။ အကောင့်ရှာတွေ့ရန် အသုံးပြုထားသော အီးမေးလ် သို့မဟုတ် ဖုန်းနံပါတ်ကို ပြောပြပါ။`,
      },
      {
        en: "You can also ask in person at either branch, or send the request through the chat on this website while you are signed in.",
        my: "ဆိုင်ခွဲများသို့ ကိုယ်တိုင်လာ၍လည်း တောင်းဆိုနိုင်ပါသည်။ သို့မဟုတ် အကောင့်ဝင်ထားစဉ် ဤဝဘ်ဆိုက်၏ Chat မှတစ်ဆင့်လည်း ပေးပို့နိုင်ပါသည်။",
      },
    ],
  },
  {
    heading: { en: "What happens then", my: "ထို့နောက် မည်သို့ဖြစ်မည်" },
    body: [
      {
        en: "We confirm the request is really from you, then delete the account. This normally takes up to 7 days.",
        my: "တောင်းဆိုမှုသည် သင်ကိုယ်တိုင်ဖြစ်ကြောင်း အတည်ပြုပြီးနောက် အကောင့်ကို ဖျက်ပါသည်။ ပုံမှန်အားဖြင့် ၇ ရက်အတွင်း ပြီးစီးပါသည်။",
      },
      { en: "Deleted with the account:", my: "အကောင့်နှင့်အတူ ဖျက်သိမ်းမည့်အရာများ —" },
    ],
    bullets: [
      {
        en: "Your name, email address, phone number and saved addresses.",
        my: "အမည်၊ အီးမေးလ်၊ ဖုန်းနံပါတ်နှင့် သိမ်းထားသော လိပ်စာများ။",
      },
      {
        en: "Your cart, wishlist and recently viewed products.",
        my: "ဈေးခြင်း၊ စိတ်ကြိုက်စာရင်းနှင့် မကြာသေးမီက ကြည့်ရှုခဲ့သော ပစ္စည်းများ။",
      },
      {
        en: "Your support chat messages and anything you uploaded to them.",
        my: "အကူအညီ Chat စာများနှင့် ၎င်းတို့တွင် တင်ထားသော ဖိုင်များ။",
      },
      {
        en: "Any delivery location you shared.",
        my: "မျှဝေထားသော ပို့ဆောင်ရန်တည်နေရာများ။",
      },
    ],
  },
  {
    heading: {
      en: "What we have to keep",
      my: "ဆက်လက်သိမ်းထားရမည့်အရာများ",
    },
    body: [
      {
        en: "Completed orders stay in our accounting records, because a shop is required to keep its sales records. These are kept only as business records — they are not used to contact you, and your account is gone.",
        my: "ပြီးစီးသွားသော အော်ဒါများကို စာရင်းကိုင်မှတ်တမ်းတွင် ဆက်လက်ထားရှိပါသည်။ အရောင်းမှတ်တမ်း သိမ်းဆည်းရန် တာဝန်ရှိသောကြောင့်ဖြစ်သည်။ ၎င်းတို့ကို စီးပွားရေးမှတ်တမ်းအဖြစ်သာ ထားရှိပြီး သင့်ကို ဆက်သွယ်ရန် အသုံးမပြုတော့ပါ။",
      },
      {
        en: "If you have an order that is still on its way, we finish delivering it first and delete the account afterwards.",
        my: "လမ်းခရီးတွင် ရှိနေသော အော်ဒါရှိပါက ပို့ဆောင်ပြီးမှသာ အကောင့်ကို ဖျက်ပါမည်။",
      },
    ],
  },
  {
    heading: {
      en: "If you signed in with Google, Facebook or LINE",
      my: "Google, Facebook သို့မဟုတ် LINE ဖြင့် ဝင်ရောက်ခဲ့ပါက",
    },
    body: [
      {
        en: "Deleting your Aphrodite account removes everything listed above from us. It does not touch your Google, Facebook or LINE account, which stays exactly as it was. You can also remove this shop's access from within that company's own settings.",
        my: "Aphrodite အကောင့်ဖျက်ခြင်းဖြင့် အထက်ပါအရာများကို ကျွန်ုပ်တို့ထံမှ ဖယ်ရှားပါသည်။ သင့် Google, Facebook သို့မဟုတ် LINE အကောင့်ကို ထိခိုက်ခြင်း မရှိပါ။ ထိုကုမ္ပဏီ၏ ဆက်တင်များထဲတွင်လည်း ဤဆိုင်၏ ခွင့်ပြုချက်ကို ဖယ်ရှားနိုင်ပါသည်။",
      },
    ],
  },
];
