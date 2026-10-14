/**
 * The returns and refunds policy, in English and Burmese, as data.
 *
 * Kept next to legal-content.ts for the same reason: the words change, the
 * page layout does not, and a section missing from one language is visible at
 * a glance. Burmese wording is new: please have a native speaker review it.
 */
export type Bi = { en: string; my: string };

export const RETURNS_NAV = {
  orders: { en: "My orders", my: "ကျွန်ုပ်၏ အော်ဒါများ" },
  store: { en: "Store", my: "ဆိုင်" },
} satisfies Record<string, Bi>;

export const RETURNS_HERO = {
  kicker: { en: "Aphrodite Myanmar RMA policy", my: "Aphrodite Myanmar RMA မူဝါဒ" },
  title: {
    en: "Returns for wrong, damaged, or faulty products.",
    my: "မှားယွင်း၊ ပျက်စီး သို့မဟုတ် ချို့ယွင်းသော ပစ္စည်းများအတွက် ပြန်ပို့ခြင်း။",
  },
  // The intro is built from parts so the bold button names and the phone
  // numbers can sit inside the sentence in either language.
  start: { en: "Start from ", my: "" },
  myOrders: { en: "My Orders", my: "My Orders" },
  and: { en: " and press ", my: " သို့ဝင်ပြီး " },
  help: { en: "Get help with this order", my: "ဤအော်ဒါအတွက် အကူအညီရယူရန်" },
  chatOrCall: { en: ", chat with us, or call ", my: " ကို နှိပ်ပါ၊ ကျွန်ုပ်တို့နှင့် စကားပြောပါ သို့မဟုတ် " },
  orEmail: { en: " or email ", my: " သို့မဟုတ် အီးမေးလ် " },
  callTail: { en: "", my: " သို့ ဖုန်းခေါ်ပါ" },
  hours: { en: "10 AM to 6 PM", my: "နံနက် ၁၀ နာရီမှ ညနေ ၆ နာရီအထိ" },
  never: {
    en: "Never send bank details or identity documents by ordinary email or chat.",
    my: "ဘဏ်အချက်အလက် သို့မဟုတ် မှတ်ပုံတင်စာရွက်စာတမ်းများကို သာမန်အီးမေးလ် သို့မဟုတ် စကားပြောခန်းဖြင့် မည်သည့်အခါမျှ မပို့ပါနှင့်။",
  },
} satisfies Record<string, Bi>;

export const RETURN_TYPES: { title: Bi; timing: Bi; evidence: Bi }[] = [
  {
    title: {
      en: "Wrong colour, model, storage or product",
      my: "အရောင်၊ မော်ဒယ်၊ သိုလှောင်မှု (storage) သို့မဟုတ် ပစ္စည်း မှားယွင်းခြင်း",
    },
    timing: {
      en: "Report as soon as you inspect the order and within 7 calendar days of delivery.",
      my: "အော်ဒါကို စစ်ဆေးပြီးသည်နှင့် ချက်ချင်း၊ ပို့ဆောင်ပြီး ရက်ပေါင်း ၇ ရက်အတွင်း အကြောင်းကြားပါ။",
    },
    evidence: {
      en: "Upload clear photos of the delivered product, model/serial label, packaging, and order label.",
      my: "ရရှိသော ပစ္စည်း၊ မော်ဒယ်/serial အညွှန်း၊ ပက်ကေ့ချ်နှင့် အော်ဒါအညွှန်းတို့၏ ပီပြင်သော ဓာတ်ပုံများ တင်ပါ။",
    },
  },
  {
    title: {
      en: "Defective product within 7 days",
      my: "၇ ရက်အတွင်း ချို့ယွင်းနေသော ပစ္စည်း",
    },
    timing: {
      en: "Open an RMA request within 7 calendar days of the delivery timestamp in My Orders.",
      my: "My Orders တွင် ပြထားသော ပို့ဆောင်ချိန်မှ ရက်ပေါင်း ၇ ရက်အတွင်း RMA တောင်းဆိုမှု ဖွင့်ပါ။",
    },
    evidence: {
      en: "Describe the fault and upload photos or video showing the problem. Keep the continuous unboxing video when available.",
      my: "ချို့ယွင်းချက်ကို ရှင်းပြပြီး ပြဿနာကို ပြသသော ဓာတ်ပုံ သို့မဟုတ် ဗီဒီယို တင်ပါ။ ရနိုင်ပါက ဘူးဖွင့်စဉ်မှစ၍ မဖြတ်ထားသော ဗီဒီယိုကို သိမ်းထားပါ။",
    },
  },
  {
    title: {
      en: "Damaged, torn, opened or incomplete parcel",
      my: "ပျက်စီး၊ ဆုတ်ပြဲ၊ ဖွင့်ထားသော သို့မဟုတ် မပြည့်စုံသော ပါဆယ်",
    },
    timing: {
      en: "Refuse delivery when safe and report transit damage within 24 hours.",
      my: "လုံခြုံပါက လက်ခံခြင်းကို ငြင်းဆိုပြီး သယ်ယူစဉ် ပျက်စီးမှုကို ၂၄ နာရီအတွင်း အကြောင်းကြားပါ။",
    },
    evidence: {
      en: "Photograph the unopened parcel from every side and record one continuous unboxing video before handling the product further.",
      my: "မဖွင့်ရသေးသော ပါဆယ်ကို ဘက်ပေါင်းစုံမှ ဓာတ်ပုံရိုက်ပြီး ပစ္စည်းကို ဆက်မကိုင်မီ ဘူးဖွင့်ခြင်းကို မဖြတ်ဘဲ ဗီဒီယိုတစ်ခုတည်းဖြင့် ရိုက်ကူးပါ။",
    },
  },
];

export const TRANSIT_DAMAGE = {
  title: { en: "Transit damage evidence", my: "သယ်ယူစဉ် ပျက်စီးမှု သက်သေ" },
  body: {
    en: "Inspect the parcel before accepting it. If it is badly damaged, opened or incomplete, ask the courier to record refusal and contact Aphrodite immediately. A continuous unboxing video is important evidence, but every request is reviewed fairly against the available order and courier records.",
    my: "ပါဆယ်ကို လက်မခံမီ စစ်ဆေးပါ။ ပျက်စီးမှုပြင်းထန်ပါက၊ ဖွင့်ထားပါက သို့မဟုတ် မပြည့်စုံပါက ကာရီယာအား ငြင်းဆိုမှုကို မှတ်တမ်းတင်ခိုင်းပြီး Aphrodite သို့ ချက်ချင်း ဆက်သွယ်ပါ။ ဘူးဖွင့်ခြင်းကို မဖြတ်ဘဲ ရိုက်ထားသော ဗီဒီယိုသည် အရေးကြီးသော သက်သေဖြစ်သော်လည်း တောင်းဆိုမှုတိုင်းကို ရရှိနိုင်သော အော်ဒါနှင့် ကာရီယာမှတ်တမ်းများနှင့် ကိုက်ညီစွာ ရိုးသားစွာ စစ်ဆေးပါသည်။",
  },
} satisfies Record<string, Bi | { title: Bi; body: Bi }>;

export const PROCESS_TITLE: Bi = { en: "RMA process", my: "RMA လုပ်ငန်းစဉ်" };

export const RMA_STEPS: { title: Bi; body: Bi }[] = [
  {
    title: { en: "Report", my: "အကြောင်းကြားခြင်း" },
    body: {
      en: "Open My Orders, select the delivered order, choose the exact problem, explain it, and upload evidence. You can also contact support.",
      my: "My Orders ကိုဖွင့်၍ ရရှိပြီးသော အော်ဒါကို ရွေးပါ၊ ပြဿနာအမျိုးအစားကို ရွေးချယ်ပြီး ရှင်းပြကာ သက်သေများ တင်ပါ။ ဝန်ဆောင်မှုအဖွဲ့ကိုလည်း တိုက်ရိုက် ဆက်သွယ်နိုင်ပါသည်။",
    },
  },
  {
    title: { en: "RMA review", my: "RMA စစ်ဆေးခြင်း" },
    body: {
      en: "Aphrodite checks the order, delivery time, serial information and evidence. Approval is not automatic.",
      my: "Aphrodite သည် အော်ဒါ၊ ပို့ဆောင်ချိန်၊ serial အချက်အလက်နှင့် သက်သေများကို စစ်ဆေးပါသည်။ အတည်ပြုခြင်းသည် အလိုအလျောက် မဟုတ်ပါ။",
    },
  },
  {
    title: { en: "Pickup or drop-off", my: "လာယူခြင်း သို့မဟုတ် လာပို့ခြင်း" },
    body: {
      en: "After approval, staff records a courier pickup appointment or store drop-off instructions. A courier may call one day before and again before collection.",
      my: "အတည်ပြုပြီးနောက် ဝန်ထမ်းမှ ကာရီယာလာယူမည့် ရက်ချိန်း သို့မဟုတ် ဆိုင်သို့ လာပို့ရမည့် ညွှန်ကြားချက်ကို မှတ်တမ်းတင်ပါမည်။ ကာရီယာမှ တစ်ရက်ကြိုတင်၍ နှင့် လာယူချိန်မတိုင်မီ ထပ်မံ ဖုန်းခေါ်နိုင်ပါသည်။",
    },
  },
  {
    title: { en: "Prepare the complete item", my: "ပစ္စည်းကို ပြည့်စုံအောင် ပြင်ဆင်ခြင်း" },
    body: {
      en: "Return the product with original packaging, foam, bags, manuals, charger and every included accessory. Back up data, sign out and remove passwords.",
      my: "မူလပက်ကေ့ချ်၊ အမြှုပ်၊ အိတ်များ၊ လက်စွဲစာအုပ်များ၊ အားသွင်းကြိုးနှင့် ပါလာသော ဆက်စပ်ပစ္စည်းအားလုံးနှင့်အတူ ပြန်ပို့ပါ။ ဒေတာကို ကူးယူသိမ်းဆည်းပြီး အကောင့်များမှ ထွက်ကာ စကားဝှက်များကို ဖယ်ရှားပါ။",
    },
  },
  {
    title: { en: "Inspection and decision", my: "စစ်ဆေးခြင်းနှင့် ဆုံးဖြတ်ခြင်း" },
    body: {
      en: "Staff records receipt and inspects the item, serial, accessories and reported fault. If no covered fault is found, the product may be sent back and return delivery charges may apply.",
      my: "ဝန်ထမ်းမှ လက်ခံရရှိမှုကို မှတ်တမ်းတင်ပြီး ပစ္စည်း၊ serial၊ ဆက်စပ်ပစ္စည်းများနှင့် တင်ပြထားသော ချို့ယွင်းချက်ကို စစ်ဆေးပါသည်။ အာမခံအကျုံးဝင်သော ချို့ယွင်းချက် မတွေ့ပါက ပစ္စည်းကို ပြန်ပို့နိုင်ပြီး ပြန်ပို့ခ ကျသင့်နိုင်ပါသည်။",
    },
  },
  {
    title: { en: "Refund", my: "ငွေပြန်အမ်းခြင်း" },
    body: {
      en: "An approved refund is sent to the original payment channel where possible. For COD, staff agrees a secure bank or mobile-wallet refund method. Target completion is 15–30 days after approval and inspection.",
      my: "အတည်ပြုထားသော ငွေပြန်အမ်းမှုကို ဖြစ်နိုင်ပါက မူလငွေပေးချေခဲ့သော လမ်းကြောင်းသို့ ပြန်ပို့ပါသည်။ COD ဖြစ်ပါက ဝန်ထမ်းနှင့် လုံခြုံသော ဘဏ် သို့မဟုတ် မိုဘိုင်းဝေါလက် နည်းလမ်းကို သဘောတူရပါမည်။ အတည်ပြုပြီး စစ်ဆေးပြီးနောက် ၁၅ ရက်မှ ၃၀ ရက်အတွင်း ပြီးစီးရန် ရည်မှန်းထားပါသည်။",
    },
  },
];

export const RETURNS_CARDS = {
  cod: {
    title: { en: "Refund information for COD", my: "COD အတွက် ငွေပြန်အမ်းမှု အချက်အလက်" },
    body: {
      en: "After approval, staff can request the account holder name, bank or wallet provider, account number and phone through a secure authenticated form. Access must be limited to authorised refund staff and retained only as required. Do not upload a full bank statement or national ID unless legally required and a secure, documented process exists.",
      my: "အတည်ပြုပြီးနောက် ဝန်ထမ်းမှ အကောင့်ပိုင်ရှင်အမည်၊ ဘဏ် သို့မဟုတ် ဝေါလက်ဝန်ဆောင်မှု၊ အကောင့်နံပါတ်နှင့် ဖုန်းနံပါတ်ကို လုံခြုံပြီး အတည်ပြုထားသော ဖောင်မှတစ်ဆင့် တောင်းခံနိုင်ပါသည်။ ၎င်းကို ခွင့်ပြုထားသော ငွေပြန်အမ်းဝန်ထမ်းများသာ ကြည့်ရှုနိုင်ရမည်ဖြစ်ပြီး လိုအပ်သလောက်သာ သိမ်းဆည်းရပါမည်။ ဥပဒေအရ လိုအပ်၍ လုံခြုံပြီး မှတ်တမ်းတင်ထားသော လုပ်ငန်းစဉ်မရှိလျှင် ဘဏ်ဖော်ပြချက်အပြည့်အစုံ သို့မဟုတ် မှတ်ပုံတင်ကို မတင်ပါနှင့်။",
    },
  },
  excluded: {
    title: { en: "Normally not eligible", my: "ပုံမှန်အားဖြင့် လက်မခံနိုင်သော အခြေအနေများ" },
    body: {
      en: "Change of mind after use, customer-caused damage, liquid damage, unauthorised repair, missing serial labels or material missing accessories are normally excluded. Warranty rights may still apply after the 7-day online RMA window.",
      my: "အသုံးပြုပြီးနောက် စိတ်ပြောင်းခြင်း၊ ဝယ်သူကြောင့် ပျက်စီးခြင်း၊ ရည်ကျခြင်း၊ ခွင့်မပြုသော ပြုပြင်ခြင်း၊ serial အညွှန်း ပျောက်နေခြင်း သို့မဟုတ် အရေးကြီးသော ဆက်စပ်ပစ္စည်း ပျောက်နေခြင်းတို့ကို ပုံမှန်အားဖြင့် ချန်လှပ်ထားပါသည်။ ၇ ရက် အွန်လိုင်း RMA ကာလကျော်လွန်ပြီးနောက်လည်း အာမခံအခွင့်အရေးများ ရှိနေနိုင်ပါသည်။",
    },
  },
  data: {
    title: { en: "Protect your data", my: "သင့်ဒေတာကို ကာကွယ်ပါ" },
    body: {
      en: "Back up files, sign out of personal accounts, remove activation locks and passwords, and remove SIM or memory cards before handover.",
      my: "လွှဲပြောင်းမပေးမီ ဖိုင်များကို ကူးယူသိမ်းဆည်းပါ၊ ကိုယ်ပိုင်အကောင့်များမှ ထွက်ပါ၊ activation lock နှင့် စကားဝှက်များကို ဖယ်ရှားပြီး SIM သို့မဟုတ် မမ်မိုရီကတ်များကို ထုတ်ယူပါ။",
    },
    button: { en: "Open my orders", my: "ကျွန်ုပ်၏ အော်ဒါများ ဖွင့်ရန်" },
  },
};

export const RETURNS_FOOTER = {
  before: {
    en: "This policy does not reduce any rights you have under the law. If something here is unclear, chat with us or call ",
    my: "ဤမူဝါဒသည် ဥပဒေအရ သင့်တွင်ရှိသော အခွင့်အရေးများကို လျှော့ချခြင်း မရှိပါ။ ဤနေရာတွင် မရှင်းလင်းသည်များရှိပါက မည်သည့်ပစ္စည်းကိုမျှ မပြန်ပို့မီ ကျွန်ုပ်တို့နှင့် စကားပြောပါ သို့မဟုတ် ",
  },
  after: {
    en: " before you send anything back.",
    my: " သို့ ဖုန်းခေါ်ပါ။",
  },
} satisfies Record<string, Bi>;
