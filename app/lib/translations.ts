export type Language = "en" | "my";

export const LANGUAGES: Language[] = ["en", "my"];

/**
 * Every string that has a Burmese version lives here, one entry per key with
 * both languages side by side, so a missing translation is obvious in this
 * file instead of silently falling back somewhere inside a component.
 *
 * Keys are grouped by area ("delivery.*", "orders.*"). Pages are being moved
 * onto this dictionary in batches; components not converted yet still hold
 * their own English/Burmese pairs.
 */
export const translations = {
  "builder.forPurpose": {"en": "For {purpose}", "my": "{purpose} အတွက်"},
  "builder.planLabel": {"en": "{label} build", "my": "{label} ဦးစားပေး အစီအစဉ်"},
  "builder.target": {"en": "Target {price}", "my": "ရည်မှန်းဘတ်ဂျက် {price}"},
  "builder.share": {"en": "{share}% of build", "my": "စုစုပေါင်းကုန်ကျစရိတ်၏ {share}%"},
  "builder.socketWarning": {"en": "No motherboard explicitly lists the {socket} socket. Confirm CPU and motherboard compatibility with the store.", "my": "{socket} တပ်ဆင်ပေါက်ကို ဖော်ပြထားသော မားသားဘုတ် မတွေ့ပါ။ ပရိုဆက်ဆာနှင့် မားသားဘုတ် ကိုက်ညီမှုကို ဆိုင်နှင့် အတည်ပြုပါ။"},
  "builder.memoryWarning": {"en": "No memory item explicitly matches {memory}. Confirm motherboard memory support with the store.", "my": "{memory} နှင့် ကိုက်ညီကြောင်း ဖော်ပြထားသော မမ်မိုရီ မတွေ့ပါ။ မားသားဘုတ်၏ မမ်မိုရီပံ့ပိုးမှုကို ဆိုင်နှင့် အတည်ပြုပါ။"},

  "location.pinAccuracy": { en: "Device-reported accuracy: about {meters} m. Adjust the pin if needed.", my: "စက်ကဖော်ပြသော တိကျမှု: ခန့်မှန်း {meters} မီတာ။ လိုအပ်ပါက မြေပုံအမှတ်ကို ရွှေ့ပါ။" },
  "filter.result": { en: "{count} result", my: "ပစ္စည်း {count} ခု တွေ့ရှိသည်" },
  "filter.results": { en: "{count} results", my: "ပစ္စည်း {count} ခု တွေ့ရှိသည်" },
  "filter.activeCount": { en: "{count} active", my: "စစ်ထုတ်မှု {count} ခု" },
  "cart.itemCount": { en: "{count} item(s)", my: "ပစ္စည်း {count} ခု" },
  "location.accuracy": { en: "Accuracy: about {meters} m", my: "တိကျမှု: ခန့်မှန်း {meters} မီတာ" },
  // Delivery attempts (customer-facing)
  "delivery.attempt.heading": {
    en: "Delivery attempt failed",
    my: "ပို့ဆောင်မှု မအောင်မြင်ပါ",
  },
  "delivery.attempt.message": {
    en: "We tried to deliver your order but could not reach you. Our team will contact you again to arrange the next delivery.",
    my: "သင့်အော်ဒါကို ပို့ဆောင်ရန် ကြိုးစားခဲ့သော်လည်း သင့်ကို ဆက်သွယ်၍ မရပါ။ နောက်တစ်ကြိမ် ပို့ဆောင်ရန် ကျွန်ုပ်တို့မှ ပြန်လည်ဆက်သွယ်ပါမည်။",
  },
  "delivery.attempt.count": {
    en: "Attempt {attempt} of {max}",
    my: "ကြိုးစားမှု {attempt} / {max}",
  },
  "delivery.attempt.nextAttempt": {
    en: "Next attempt: {date}",
    my: "နောက်တစ်ကြိမ် ပို့ဆောင်မည့်ရက်: {date}",
  },
  "delivery.attempt.callUs": {
    en: "You can also call us on {phone} to arrange a better time.",
    my: "အဆင်ပြေသည့်အချိန် ညှိနှိုင်းရန် {phone} သို့လည်း ဖုန်းခေါ်ဆိုနိုင်ပါသည်။",
  },
  "delivery.attempt.lastAttempt": {
    en: "This was the last planned attempt. Please contact us, or the order may be cancelled.",
    my: "ဤသည်မှာ နောက်ဆုံးကြိုးစားမှု ဖြစ်ပါသည်။ ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ၊ မဟုတ်ပါက အော်ဒါကို ပယ်ဖျက်ရနိုင်ပါသည်။",
  },

  // Why an attempt failed
  "delivery.reason.no_answer": {
    en: "No answer on the phone",
    my: "ဖုန်း မကိုင်ပါ",
  },
  "delivery.reason.phone_off": {
    en: "Phone switched off or unreachable",
    my: "ဖုန်း ပိတ်ထားသည် သို့မဟုတ် ဆက်သွယ်၍ မရပါ",
  },
  "delivery.reason.address_problem": {
    en: "Address could not be found",
    my: "လိပ်စာကို ရှာမတွေ့ပါ",
  },
  "delivery.reason.customer_rescheduled": {
    en: "Customer asked to deliver later",
    my: "ဝယ်ယူသူက နောက်မှ ပို့ရန် တောင်းဆိုသည်",
  },
  "delivery.reason.nobody_home": {
    en: "Nobody available to receive the order",
    my: "အော်ဒါ လက်ခံမည့်သူ မရှိပါ",
  },

  // Order tracking stages (customer-facing)
  "tracking.order_placed": { en: "Order received", my: "အော်ဒါ လက်ခံရရှိပါပြီ" },
  "tracking.verification_pending": { en: "Awaiting verification", my: "အတည်ပြုရန် စောင့်ဆိုင်းဆဲ" },
  "tracking.verified": { en: "Order verified", my: "အော်ဒါ အတည်ပြုပြီး" },
  "tracking.packed": { en: "Packed", my: "ထုပ်ပိုးပြီး" },
  "tracking.handed_to_courier": { en: "Handed to courier", my: "ပို့ဆောင်ရေးသို့ အပ်နှံပြီး" },
  "tracking.in_transit": { en: "In transit", my: "လမ်းခရီးတွင်" },
  "tracking.out_for_delivery": { en: "Out for delivery", my: "ပို့ဆောင်နေဆဲ" },
  "tracking.delivered": { en: "Delivered", my: "ပို့ဆောင်ပြီး" },
  "tracking.delivery_failed": {
    en: "Delivery attempt failed",
    my: "ပို့ဆောင်မှု မအောင်မြင်ပါ",
  },

  // Paying by bank transfer or MMQR
  "payment.method.cash_on_delivery": {
    en: "Cash on delivery",
    my: "ပစ္စည်းရောက်မှ ငွေချေခြင်း",
  },
  "payment.method.cash_on_delivery.help": {
    en: "Pay the delivery driver after checking your package.",
    my: "ပစ္စည်းကို စစ်ဆေးပြီးမှ ပို့ဆောင်သူထံ ငွေပေးချေပါ။",
  },
  "payment.method.bank_transfer": { en: "Bank transfer", my: "ဘဏ်လွှဲပြောင်းခြင်း" },
  "payment.method.bank_transfer.help": {
    en: "Transfer to our KBZ or AYA account, then upload the transfer slip.",
    my: "ကျွန်ုပ်တို့၏ KBZ သို့မဟုတ် AYA အကောင့်သို့ လွှဲပြီး ငွေလွှဲပြေစာကို တင်ပါ။",
  },
  "payment.method.mmqr": { en: "MMQR (scan to pay)", my: "MMQR (စကင်ဖတ်၍ ပေးချေရန်)" },
  "payment.method.mmqr.help": {
    en: "Scan the MMQR code with your banking app, then upload the transfer slip.",
    my: "MMQR ကုဒ်ကို သင့်ဘဏ်အက်ပ်ဖြင့် စကင်ဖတ်ပြီး ငွေလွှဲပြေစာကို တင်ပါ။",
  },
  "payment.accountNumber": { en: "Account number", my: "အကောင့်နံပါတ်" },
  "payment.accountHolder": { en: "Account name", my: "အကောင့်အမည်" },
  "payment.amountToTransfer": { en: "Amount to transfer", my: "လွှဲရမည့် ပမာဏ" },
  "payment.scanQr": { en: "Scan the MMQR here", my: "MMQR ကို ဤနေရာတွင် စကင်ဖတ်ပါ" },
  "payment.qrMissing": {
    en: "The MMQR code image is not available right now. Please pay by bank transfer, or contact us for the QR code.",
    my: "MMQR ကုဒ်ပုံ ယခုမရနိုင်သေးပါ။ ဘဏ်လွှဲပြောင်းခြင်းဖြင့် ပေးချေပါ သို့မဟုတ် QR ကုဒ်အတွက် ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ။",
  },
  "payment.slip.title": { en: "Upload your transfer slip", my: "ငွေလွှဲပြေစာ တင်ပါ" },
  "payment.slip.help": {
    en: "Upload a photo or screenshot of the transfer. We check it before preparing your order.",
    my: "ငွေလွှဲထားသည့် ဓာတ်ပုံ သို့မဟုတ် ဖန်သားပြင်ဓာတ်ပုံကို တင်ပါ။ အော်ဒါမပြင်ဆင်မီ စစ်ဆေးပါမည်။",
  },
  "payment.slip.uploaded": { en: "Slip uploaded", my: "ပြေစာ တင်ပြီးပါပြီ" },
  "payment.status.pending": {
    en: "Waiting for us to check your payment",
    my: "သင့်ငွေပေးချေမှုကို စစ်ဆေးရန် စောင့်ဆိုင်းနေပါသည်",
  },
  "payment.status.verified": {
    en: "Payment verified. We are preparing your order.",
    my: "ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ။ သင့်အော်ဒါကို ပြင်ဆင်နေပါသည်။",
  },
  "payment.status.rejected": {
    en: "We could not confirm this payment. Please check the slip or contact us.",
    my: "ဤငွေပေးချေမှုကို အတည်မပြုနိုင်ပါ။ ပြေစာကို ပြန်စစ်ပါ သို့မဟုတ် ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ။",
  },
  // Navigation and shared buttons
  "nav.laptops": { en: "Laptops", my: "လက်ပ်တော့များ" },
  "nav.accessories": { en: "Accessories", my: "ဆက်စပ်ပစ္စည်းများ" },
  "nav.pcParts": { en: "PC Parts", my: "ကွန်ပျူတာ အစိတ်အပိုင်းများ" },
  "nav.findLaptop": { en: "Find Laptop", my: "လက်ပ်တော့ ရှာရန်" },
  "nav.pcBuilder": { en: "PC Builder", my: "ကွန်ပျူတာ ဆင်ရန်" },
  "nav.search": { en: "Search products...", my: "ပစ္စည်း ရှာရန်..." },
  "nav.account": { en: "Account", my: "အကောင့်" },
  "nav.login": { en: "Login", my: "ဝင်ရောက်ရန်" },
  "nav.logout": { en: "Logout", my: "ထွက်ရန်" },
  "nav.wishlist": { en: "Wishlist", my: "စိတ်ကြိုက်စာရင်း" },
  "nav.cart": { en: "Cart", my: "ဈေးခြင်းတောင်း" },
  "nav.orders": { en: "My orders", my: "ကျွန်ုပ်၏ အော်ဒါများ" },
  "nav.settings": { en: "Settings", my: "ဆက်တင်များ" },

  "nav.returns": { en: "Returns", my: "ပြန်ပို့ခြင်း" },
  "nav.support": { en: "Support", my: "အကူအညီ" },
  "nav.register": { en: "Register", my: "အကောင့်ဖွင့်ရန်" },
  "nav.locationSharing": { en: "Location sharing", my: "တည်နေရာ မျှဝေခြင်း" },
  "nav.returnPolicy": { en: "Return policy", my: "ပြန်ပို့ရေး မူဝါဒ" },
  "nav.suggestions": { en: "Suggestions", my: "အကြံပြုချက်များ" },
  "nav.clearSearch": { en: "Clear search", my: "ရှာဖွေမှု ရှင်းရန်" },

  // Product cards and lists
  "product.viewDetails": { en: "View Details", my: "အသေးစိတ် ကြည့်ရန်" },
  "product.inStock": { en: "In Stock", my: "ပစ္စည်း ရှိသည်" },
  "product.outOfStock": { en: "Out of Stock", my: "ပစ္စည်း ကုန်သွားပါပြီ" },
  "product.promotionalPrice": { en: "Promotional price", my: "အထူးလျှော့ဈေး" },
  "product.regularPrice": { en: "Regular price", my: "ပုံမှန်ဈေးနှုန်း" },
  "product.originalPrice": { en: "Original", my: "မူလဈေး" },
  "cart.totalSavings": { en: "Total savings", my: "စုစုပေါင်း သက်သာမှု" },
  "product.from": { en: "From", my: "မှစ၍" },
  "product.wholesaleFrom": {
    en: "Wholesale from {price} ({min}+ units)",
    my: "လက်ကား {price} မှစ၍ ({min}+ ခု)",
  },
  "product.detailsPending": {
    en: "Product details are being prepared.",
    my: "ပစ္စည်း အသေးစိတ်ကို ပြင်ဆင်နေပါသည်။",
  },
  "section.count": { en: "{count} products", my: "ပစ္စည်း {count} ခု" },
  "section.countOne": { en: "1 product", my: "ပစ္စည်း ၁ ခု" },
  "section.noProducts": { en: "No products found.", my: "ပစ္စည်း မတွေ့ပါ။" },
  "section.promotions": { en: "Promotions", my: "အထူးလျှော့ဈေး ပစ္စည်းများ" },
  "section.regularItems": { en: "Regular items", my: "ပုံမှန်ဈေး ပစ္စည်းများ" },
  "section.showMore": { en: "Show {count} more", my: "နောက်ထပ် {count} ခု ကြည့်ရန်" },

  "recent.title": { en: "Recently viewed", my: "မကြာသေးမီက ကြည့်ခဲ့သည်များ" },
  "recent.subtitle": {
    en: "Saved privately to this customer account.",
    my: "ဤအကောင့်အတွင်း၌သာ သီးသန့် သိမ်းဆည်းထားပါသည်။",
  },
  "recent.clear": { en: "Clear history", my: "မှတ်တမ်း ရှင်းရန်" },

  "contact.heading": { en: "Contact", my: "ဆက်သွယ်ရန်" },

  // Sign in
  "login.title": { en: "Welcome back", my: "ပြန်လည် ကြိုဆိုပါသည်" },
  "login.subtitle": {
    en: "Sign in to track orders, save your wishlist, and see your business prices.",
    my: "အော်ဒါများ ခြေရာခံရန်၊ စိတ်ကြိုက်စာရင်း သိမ်းရန်နှင့် လုပ်ငန်းသုံးစျေးနှုန်း ကြည့်ရန် ဝင်ရောက်ပါ။",
  },
  "login.email": { en: "Email", my: "အီးမေးလ်" },
  "login.password": { en: "Password", my: "စကားဝှက်" },
  "login.passwordPlaceholder": { en: "Your password", my: "သင့်စကားဝှက်" },
  "login.submit": { en: "Sign in", my: "ဝင်ရောက်ရန်" },
  "login.submitting": { en: "Signing in...", my: "ဝင်ရောက်နေသည်..." },
  "login.pitch": {
    en: "Laptops, accessories and PC parts — retail and wholesale.",
    my: "Laptops, Accessories နှင့် PC Parts — အလက်နှင့် အကား။",
  },
  "login.benefitTracking": {
    en: "Track every order from confirmed to delivered",
    my: "အော်ဒါတိုင်းကို အတည်ပြုချိန်မှ လက်ခံရရှိချိန်အထိ ခြေရာခံနိုင်သည်",
  },
  "login.benefitBusiness": {
    en: "Business accounts see bulk prices automatically",
    my: "လုပ်ငန်းအကောင့်များသည် အကားစျေးနှုန်းကို အလိုအလျောက် မြင်ရသည်",
  },
  "login.benefitFavourites": {
    en: "Save favourites and check out in seconds",
    my: "စိတ်ကြိုက်များ သိမ်းပြီး လျင်မြန်စွာ ဝယ်ယူနိုင်သည်",
  },
  // One phrasing for every social button, so the stack reads as a set.
  "login.withGoogle": {
    en: "Log in with your Google account",
    my: "Google အကောင့်ဖြင့် ဝင်ရောက်ရန်",
  },
  "login.withFacebook": {
    en: "Log in with your Facebook account",
    my: "Facebook အကောင့်ဖြင့် ဝင်ရောက်ရန်",
  },
  "login.withLine": {
    en: "Log in with your LINE account",
    my: "LINE အကောင့်ဖြင့် ဝင်ရောက်ရန်",
  },
  "login.or": { en: "or", my: "သို့မဟုတ်" },
  "login.justTracking": {
    en: "Only want to know where your order is?",
    my: "အော်ဒါ ဘယ်ရောက်နေလဲ သိလိုရုံသာလား?",
  },
  "login.trackOrder": {
    en: "Track it without signing in",
    my: "အကောင့်မဝင်ဘဲ စစ်ဆေးရန်",
  },
  "login.noAccount": {
    en: "Don't have an account yet?",
    my: "အကောင့် မရှိသေးဘူးလား?",
  },
  "login.registerNew": {
    en: "Register for a new account",
    my: "အကောင့်အသစ် ဖွင့်ရန်",
  },
  "login.forgotPassword": {
    en: "Forgot password?",
    my: "စကားဝှက် မေ့နေပါသလား?",
  },
  "login.resetDone": {
    en: "Your password has been changed. Sign in with your new password.",
    my: "သင့်စကားဝှက်ကို ပြောင်းလဲပြီးပါပြီ။ စကားဝှက်အသစ်ဖြင့် ဝင်ရောက်ပါ။",
  },

  // Forgot / reset password
  "forgot.title": { en: "Reset your password", my: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်" },
  "forgot.subtitle": {
    en: "Enter the email address on your account and we will send you a link to choose a new password.",
    my: "သင့်အကောင့်၏ အီးမေးလ်လိပ်စာကို ထည့်ပါ။ စကားဝှက်အသစ် ရွေးချယ်ရန် လင့်ခ်တစ်ခု ပေးပို့ပါမည်။",
  },
  "forgot.email": { en: "Email", my: "အီးမေးလ်" },
  "forgot.submit": { en: "Send reset link", my: "လင့်ခ် ပေးပို့ရန်" },
  "forgot.submitting": { en: "Sending...", my: "ပေးပို့နေသည်..." },
  "forgot.backToLogin": { en: "Back to sign in", my: "ဝင်ရောက်ရန် စာမျက်နှာသို့ ပြန်သွားရန်" },
  "forgot.checkInbox": {
    en: "If that email address has an account, a reset link is on its way. Check your inbox and spam folder.",
    my: "ထိုအီးမေးလ်ဖြင့် အကောင့်ရှိပါက ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ကို ပေးပို့လိုက်ပါပြီ။ Inbox နှင့် Spam folder ကို စစ်ဆေးပါ။",
  },
  "reset.title": { en: "Choose a new password", my: "စကားဝှက်အသစ် ရွေးချယ်ပါ" },
  "reset.subtitle": {
    en: "Pick a password you have not used on this account before. It must be at least 8 characters.",
    my: "ဤအကောင့်တွင် ယခင်က မသုံးဖူးသော စကားဝှက်ကို ရွေးပါ။ အနည်းဆုံး စာလုံး ၈ လုံး ရှိရပါမည်။",
  },
  "reset.password": { en: "New password", my: "စကားဝှက် အသစ်" },
  "reset.confirm": { en: "Confirm new password", my: "စကားဝှက် အသစ် အတည်ပြုရန်" },
  "reset.mismatch": {
    en: "The two passwords do not match.",
    my: "စကားဝှက် နှစ်ခု မတူညီပါ။",
  },
  "reset.submit": { en: "Change my password", my: "စကားဝှက် ပြောင်းရန်" },
  "reset.submitting": { en: "Changing...", my: "ပြောင်းလဲနေသည်..." },
  "reset.missingToken": {
    en: "This reset link is incomplete. Request a new one from the sign-in page.",
    my: "ဤလင့်ခ်သည် မပြည့်စုံပါ။ ဝင်ရောက်ရန်စာမျက်နှာမှ အသစ်တစ်ခု တောင်းခံပါ။",
  },

  // Wishlist
  "wishlist.title": { en: "Your Wishlist", my: "သင့် စိတ်ကြိုက်စာရင်း" },
  "wishlist.loginTitle": {
    en: "Login to view your wishlist",
    my: "စိတ်ကြိုက်စာရင်း ကြည့်ရန် ဝင်ရောက်ပါ",
  },
  "wishlist.empty": { en: "Your wishlist is empty.", my: "စိတ်ကြိုက်စာရင်း ဗလာဖြစ်နေပါသည်။" },
  "wishlist.alerts": { en: "Alerts", my: "အသိပေးချက်များ" },

  // Filters
  "filter.title": { en: "Filter products", my: "ပစ္စည်းများ စစ်ထုတ်ရန်" },
  "filter.allTypes": { en: "All types", my: "အမျိုးအစား အားလုံး" },
  "filter.allCategories": { en: "All categories", my: "ကဏ္ဍ အားလုံး" },
  "filter.allStock": { en: "All stock", my: "လက်ကျန် အားလုံး" },
  "filter.allBrands": { en: "All brands", my: "အမှတ်တံဆိပ် အားလုံး" },
  "filter.recommended": { en: "Recommended", my: "အကြံပြုထားသည်" },
  "filter.priceLowHigh": { en: "Price: low to high", my: "စျေးနှုန်း: နိမ့်မှ မြင့်" },
  "filter.priceHighLow": { en: "Price: high to low", my: "စျေးနှုန်း: မြင့်မှ နိမ့်" },
  "filter.nameAZ": { en: "Name A–Z", my: "အမည် A–Z" },

  // Product detail
  "detail.notFound": { en: "Product not found", my: "ပစ္စည်း မတွေ့ပါ" },
  "detail.quantity": { en: "Quantity", my: "အရေအတွက်" },
  "detail.decrease": { en: "Decrease quantity", my: "အရေအတွက် လျှော့ရန်" },
  "detail.increase": { en: "Increase quantity", my: "အရေအတွက် တိုးရန်" },
  "detail.unitPrice": { en: "Unit price", my: "တစ်ခုချင်း စျေးနှုန်း" },
  "detail.retail": { en: "Retail", my: "အလက်" },
  "detail.related": { en: "Related Products", my: "ဆက်စပ် ပစ္စည်းများ" },

  "detail.addToCart": { en: "Add to Cart", my: "ဈေးခြင်းထဲ ထည့်ရန်" },
  "detail.pricePending": {
    en: "Price pending — contact support",
    my: "စျေးနှုန်း အတည်မပြုရသေးပါ — ဆက်သွယ်ပါ",
  },
  "detail.loginToCart": {
    en: "Please login before adding products to cart.",
    my: "ဈေးခြင်းထဲ မထည့်မီ ဝင်ရောက်ပါ။",
  },
  "detail.outOfStockMessage": {
    en: "This product is currently out of stock.",
    my: "ဤပစ္စည်း လက်ရှိ ကုန်နေပါသည်။",
  },
  "detail.addedToCart": { en: "Added to cart successfully.", my: "ဈေးခြင်းထဲ ထည့်ပြီးပါပြီ။" },
  "detail.loginToSave": {
    en: "Please login before saving products.",
    my: "ပစ္စည်း သိမ်းရန် ဝင်ရောက်ပါ။",
  },

  // Settings
  "settings.profile": { en: "Profile and contact", my: "ကိုယ်ရေးအချက်အလက်နှင့် ဆက်သွယ်ရန်" },
  "settings.deliveryAddress": { en: "Delivery address", my: "ပို့ဆောင်ရမည့် လိပ်စာ" },
  "settings.preferences": { en: "Preferences", my: "စိတ်ကြိုက် သတ်မှတ်ချက်များ" },
  "settings.shoppingPrivacy": { en: "Shopping and privacy", my: "ဈေးဝယ်ခြင်းနှင့် ကိုယ်ရေးလုံခြုံမှု" },
  "settings.passwordSecurity": { en: "Password and security", my: "စကားဝှက်နှင့် လုံခြုံရေး" },
  "settings.preferredLanguage": { en: "Preferred language", my: "နှစ်သက်ရာ ဘာသာစကား" },
  "settings.fullName": { en: "Full name", my: "အမည် အပြည့်အစုံ" },
  "settings.phone": { en: "Phone", my: "ဖုန်းနံပါတ်" },
  "settings.addressLine1": { en: "Address line 1", my: "လိပ်စာ (၁)" },
  "settings.addressLine2": { en: "Address line 2", my: "လိပ်စာ (၂)" },
  "settings.city": { en: "City / District", my: "မြို့ / မြို့နယ်" },
  "settings.state": { en: "Province / State", my: "တိုင်းဒေသကြီး / ပြည်နယ်" },
  "settings.postalCode": { en: "Postal code", my: "စာပို့သင်္ကေတ" },
  "settings.country": { en: "Country", my: "နိုင်ငံ" },
  "settings.orderUpdates": { en: "Order status updates", my: "အော်ဒါ အခြေအနေ အသိပေးချက်" },
  "settings.supportUpdates": { en: "Support reply updates", my: "အကူအညီ ပြန်ကြားချက်" },
  "settings.marketing": { en: "Offers and promotions", my: "အထူးကမ်းလှမ်းချက်များ" },

  // Chat
  "chat.title": { en: "Aphrodite Help", my: "Aphrodite အကူအညီ" },
  "chat.subtitle": {
    en: "Instant answers or private admin support",
    my: "ချက်ချင်း အဖြေ သို့မဟုတ် သီးသန့် အကူအညီ",
  },
  "chat.ask": { en: "Ask", my: "မေးရန်" },
  "chat.askPlaceholder": {
    en: "Ask about products or your order...",
    my: "ပစ္စည်း သို့မဟုတ် အော်ဒါအကြောင်း မေးပါ...",
  },
  "chat.messagePlaceholder": { en: "Type your message...", my: "စာရေးပါ..." },
  "chat.button": { en: "💬 Ask Aphrodite", my: "💬 အကူအညီ" },
  "chat.loginTitle": { en: "Login for live support", my: "တိုက်ရိုက် အကူအညီအတွက် ဝင်ရောက်ပါ" },
  "chat.loginBody": {
    en: "Your private conversation goes directly to the Aphrodite administrator.",
    my: "သင့်စကားဝိုင်းသည် Aphrodite စီမံခန့်ခွဲသူထံ တိုက်ရိုက် ရောက်ပါသည်။",
  },
  "chat.loading": { en: "Loading conversation...", my: "စကားဝိုင်း ဖွင့်နေသည်..." },

  // Cart and checkout
  "cart.title": { en: "Your Cart", my: "သင့် ဈေးခြင်းတောင်း" },
  "cart.loginTitle": { en: "Login to view your cart", my: "ဈေးခြင်းတောင်း ကြည့်ရန် ဝင်ရောက်ပါ" },
  "cart.empty": { en: "Your cart is empty.", my: "ဈေးခြင်းတောင်း ဗလာဖြစ်နေပါသည်။" },
  "cart.orderPlaced": { en: "Order placed", my: "အော်ဒါ တင်ပြီးပါပြီ" },
  "cart.checkout": { en: "Checkout", my: "ငွေရှင်းရန်" },
  "cart.retailSubtotal": { en: "Retail subtotal", my: "အလက်စျေး စုစုပေါင်း" },
  "cart.wholesaleSavings": { en: "Wholesale savings", my: "အကားစျေး သက်သာမှု" },
  "cart.pendingPrices": {
    en: "Some items are waiting for confirmed MMK prices. They are not free. Remove these items or contact support before placing an order.",
    my: "အချို့ပစ္စည်းများသည် MMK စျေးနှုန်း အတည်ပြုရန် စောင့်နေပါသည်။ အခမဲ့ မဟုတ်ပါ။ အော်ဒါမတင်မီ ဖယ်ရှားပါ သို့မဟုတ် ကျွန်ုပ်တို့ကို ဆက်သွယ်ပါ။",
  },
  "cart.addressLine1": { en: "House number and street", my: "အိမ်အမှတ်နှင့် လမ်း" },
  "cart.addressLine2": { en: "Apartment, suite, or landmark", my: "တိုက်ခန်း သို့မဟုတ် အမှတ်အသား" },
  "cart.myanmarOnly": {
    en: "Myanmar delivery addresses only. No international shipping.",
    my: "မြန်မာနိုင်ငံအတွင်း လိပ်စာများသာ။ နိုင်ငံရပ်ခြား ပို့ဆောင်ခြင်း မရှိပါ။",
  },
  "cart.noPin": {
    en: "I cannot confirm a map pin. Please call to confirm my written Myanmar address. My COD order must be reviewed before dispatch.",
    my: "မြေပုံအမှတ်အသား မပေးနိုင်ပါ။ ကျွန်ုပ်ရေးထားသော လိပ်စာကို ဖုန်းဖြင့် အတည်ပြုပေးပါ။ ပစ္စည်းမပို့မီ စစ်ဆေးရန် လိုအပ်သည်။",
  },
  "cart.paymentMethod": { en: "Payment method", my: "ငွေပေးချေမှု နည်းလမ်း" },
  "cart.codConfirmAddress": {
    en: "I confirm the recipient name and delivery address are correct.",
    my: "လက်ခံမည့်သူအမည်နှင့် ပို့ဆောင်ရမည့် လိပ်စာ မှန်ကန်ကြောင်း အတည်ပြုပါသည်။",
  },
  "cart.codConfirmPhone": {
    en: "I confirm this phone is reachable for COD verification. Unverified orders may be held or cancelled.",
    my: "ဤဖုန်းနံပါတ်ဖြင့် ဆက်သွယ်၍ရကြောင်း အတည်ပြုပါသည်။ အတည်မပြုနိုင်သော အော်ဒါများကို ဆိုင်းငံ့ခြင်း သို့မဟုတ် ပယ်ဖျက်ခြင်း ဖြစ်နိုင်ပါသည်။",
  },

  // Register
  "register.inviteCode": { en: "Code from Aphrodite", my: "Aphrodite မှ ကုဒ်" },
  "register.shopName": { en: "Your shop name", my: "သင့်ဆိုင် အမည်" },
  "register.contactPerson": { en: "Who we call", my: "ဆက်သွယ်ရမည့်သူ" },
  "register.phone": { en: "09...", my: "09..." },
  "register.yourName": { en: "Your name", my: "သင့်အမည်" },
  "register.passwordHint": { en: "At least 8 characters", my: "အနည်းဆုံး စာလုံး ၈ လုံး" },

  // Admin tables
  "adminTable.product": { en: "Product", my: "ပစ္စည်း" },
  "adminTable.type": { en: "Type", my: "အမျိုးအစား" },
  "adminTable.price": { en: "Price", my: "စျေးနှုန်း" },
  "adminTable.stock": { en: "Stock", my: "လက်ကျန်" },
  "adminTable.action": { en: "Action", my: "လုပ်ဆောင်ချက်" },
  "adminTable.order": { en: "Order", my: "အော်ဒါ" },
  "adminTable.customer": { en: "Customer", my: "ဖောက်သည်" },
  "adminTable.items": { en: "Items", my: "ပစ္စည်းများ" },
  "adminTable.total": { en: "Total", my: "စုစုပေါင်း" },
  "adminTable.status": { en: "Status", my: "အခြေအနေ" },
  "adminTable.payment": { en: "Payment", my: "ငွေပေးချေမှု" },
  "adminTable.request": { en: "Customer Request", my: "ဖောက်သည် တောင်းဆိုချက်" },
  "adminTable.shipping": { en: "Shipping", my: "ပို့ဆောင်ရေး" },

  "common.save": { en: "Save", my: "သိမ်းဆည်းရန်" },
  "common.cancel": { en: "Cancel", my: "မလုပ်တော့ပါ" },
  "common.close": { en: "Close", my: "ပိတ်ရန်" },
  "common.back": { en: "Back", my: "နောက်သို့" },
  "common.refresh": { en: "Refresh", my: "ပြန်လည်ရယူရန်" },
  "common.loading": { en: "Loading...", my: "ခဏစောင့်ပါ..." },
  "common.saving": { en: "Saving...", my: "သိမ်းဆည်းနေသည်..." },
  "common.viewAll": { en: "View all", my: "အားလုံးကြည့်ရန်" },

  // Admin panel shell
  "admin.manage": { en: "Manage", my: "စီမံခန့်ခွဲရန်" },
  "admin.overview": { en: "Overview", my: "ခြုံငုံသုံးသပ်ချက်" },
  "admin.products": { en: "Products", my: "ပစ္စည်းများ" },
  "admin.purchases": { en: "Customer Purchases", my: "ဝယ်ယူမှုများ" },
  "admin.locations": { en: "Customer Locations", my: "ဖောက်သည် တည်နေရာများ" },
  "admin.liveChat": { en: "Live Chat", my: "တိုက်ရိုက် ချက်" },
  "admin.wholesale": { en: "Wholesale", my: "လက်ကား" },
  "admin.priceLists": { en: "Price Lists & Tiers", my: "စျေးနှုန်းစာရင်းများ" },
  "admin.homepageAds": { en: "Homepage Ads", my: "ပင်မစာမျက်နှာ ကြော်ငြာများ" },
  "admin.sheetSync": { en: "Google Sheet Sync", my: "Google Sheet ချိတ်ဆက်ခြင်း" },
  "admin.backToStore": { en: "Back to Store", my: "ဆိုင်သို့ ပြန်သွားရန်" },
  "admin.shop": { en: "Shop", my: "ဆိုင်" },

  "payment.status.awaitingSlip": {
    en: "Please upload your transfer slip so we can check your payment.",
    my: "ငွေပေးချေမှုကို စစ်ဆေးနိုင်ရန် ငွေလွှဲပြေစာကို တင်ပေးပါ။",
  },
  "payment.status.correctionRequested": {
    en: "We need you to correct something about this payment.",
    my: "ဤငွေပေးချေမှုနှင့် ပတ်သက်၍ ပြင်ဆင်ပေးရန် လိုအပ်ပါသည်။",
  },
  "payment.verification": { en: "Payment verification", my: "ငွေပေးချေမှု အတည်ပြုခြင်း" },

  // The checkout button names the method the customer actually chose.
  "cart.placingOrder": { en: "Placing order...", my: "အော်ဒါ တင်နေသည်..." },
  "cart.place.cash_on_delivery": {
    en: "Place cash-on-delivery order",
    my: "အိမ်အရောက် ငွေချေ အော်ဒါ တင်ရန်",
  },
  "cart.place.bank_transfer": {
    en: "Place order and pay by bank transfer",
    my: "အော်ဒါတင်ပြီး ဘဏ်လွှဲဖြင့် ပေးချေရန်",
  },
  "cart.place.mmqr": {
    en: "Place order and pay by MMQR",
    my: "အော်ဒါတင်ပြီး MMQR ဖြင့် ပေးချေရန်",
  },
  "payment.amountReceived": { en: "Amount we received", my: "လက်ခံရရှိသော ပမာဏ" },
  "payment.amountRemaining": { en: "Still to pay", my: "ပေးချေရန် ကျန်ရှိ" },

  // "What happens next?" — one instruction per order (see lib/next-step.ts).
  "next.heading": { en: "What happens next?", my: "နောက်တစ်ဆင့် ဘာလုပ်ရမလဲ?" },

  "next.pay_now": {
    en: "Upload your advance-payment receipt",
    my: "ကြိုတင်ငွေပေးချေမှု ပြေစာကို တင်ပါ",
  },
  "next.pay_now.detail": {
    en: "Transfer the amount below, then upload your slip so we can start preparing your order.",
    my: "အောက်ပါပမာဏကို လွှဲပြီး ပြေစာကို တင်ပေးပါ။ ထို့နောက် သင့်အော်ဒါကို စတင်ပြင်ဆင်ပါမည်။",
  },

  "next.checking_payment": {
    en: "We are checking your payment",
    my: "သင့်ငွေပေးချေမှုကို စစ်ဆေးနေပါသည်",
  },
  "next.checking_payment.detail": {
    en: "Your slip has arrived. Nothing more to do — we usually confirm within a few hours during shop hours.",
    my: "သင့်ပြေစာ ရောက်ရှိပါပြီ။ ထပ်မံလုပ်ဆောင်စရာ မရှိပါ — ဆိုင်ဖွင့်ချိန်အတွင်း နာရီအနည်းငယ်အတွင်း အတည်ပြုပေးလေ့ရှိပါသည်။",
  },

  "next.pay_again": {
    en: "Upload a correct payment receipt",
    my: "မှန်ကန်သော ငွေပေးချေမှု ပြေစာ တင်ပါ",
  },
  "next.pay_again.detail": {
    en: "We could not confirm the last slip. Please read the note below and upload again.",
    my: "ယခင်ပြေစာကို အတည်မပြုနိုင်ပါ။ အောက်ပါမှတ်ချက်ကို ဖတ်ပြီး ပြန်လည်တင်ပေးပါ။",
  },

  "next.pay_remaining": {
    en: "Send the remaining amount",
    my: "ကျန်ရှိသော ပမာဏကို ထပ်မံလွှဲပါ",
  },
  "next.pay_remaining.detail": {
    en: "Part of your payment arrived. Send exactly the amount below to the same account, then upload the new slip.",
    my: "သင့်ငွေပေးချေမှု တစ်စိတ်တစ်ပိုင်း ရောက်ရှိပါသည်။ အောက်ပါပမာဏအတိအကျကို အကောင့်တူတူသို့ လွှဲပြီး ပြေစာအသစ်ကို တင်ပေးပါ။",
  },

  "next.fix_slip": {
    en: "Send a clearer payment receipt",
    my: "ပိုမိုရှင်းလင်းသော ငွေလွှဲပြေစာ တင်ပါ",
  },
  "next.fix_slip.detail": {
    en: "We could not read your slip. Please upload a clearer photo showing the amount, the date and the account.",
    my: "သင့်ပြေစာကို ဖတ်၍ မရပါ။ ပမာဏ၊ ရက်စွဲနှင့် အကောင့်ကို မြင်ရသော ပိုမိုရှင်းလင်းသည့် ဓာတ်ပုံကို တင်ပေးပါ။",
  },

  "next.overpaid": {
    en: "You paid more than the order total",
    my: "အော်ဒါစုစုပေါင်းထက် ပိုမိုပေးချေထားပါသည်",
  },
  "next.overpaid.detail": {
    en: "The extra amount below will be returned to you. Our team will contact you to arrange it.",
    my: "ပိုလျှံသော အောက်ပါပမာဏကို ပြန်အမ်းပေးပါမည်။ ကျွန်ုပ်တို့မှ ဆက်သွယ်ညှိနှိုင်းပါမည်။",
  },

  "next.payment_confirmed": {
    en: "Payment confirmed — preparing your order",
    my: "ငွေပေးချေမှု အတည်ပြုပြီး — အော်ဒါ ပြင်ဆင်နေပါသည်",
  },
  "next.payment_confirmed.detail": {
    en: "Nothing more to do. We will tell you when your order is on the way.",
    my: "ထပ်မံလုပ်ဆောင်စရာ မရှိပါ။ အော်ဒါ ထွက်ခွာသည့်အခါ အကြောင်းကြားပါမည်။",
  },

  "next.preparing": { en: "We are preparing your order", my: "သင့်အော်ဒါကို ပြင်ဆင်နေပါသည်" },
  "next.preparing.detail": {
    en: "Nothing more to do. We will tell you when the courier collects it.",
    my: "ထပ်မံလုပ်ဆောင်စရာ မရှိပါ။ ပို့ဆောင်သူ လာယူသည့်အခါ အကြောင်းကြားပါမည်။",
  },

  "next.prepare_cash": {
    en: "Prepare cash for the delivery",
    my: "ပို့ဆောင်ချိန်အတွက် ငွေသား ပြင်ဆင်ထားပါ",
  },
  "next.prepare_cash.detail": {
    en: "Have exactly the amount below ready for the courier when your order arrives.",
    my: "အော်ဒါရောက်ရှိချိန်တွင် အောက်ပါပမာဏအတိအကျကို ပို့ဆောင်သူအတွက် ပြင်ဆင်ထားပါ။",
  },

  "next.on_the_way": { en: "Your order is on the way", my: "သင့်အော်ဒါ လမ်းမှာ ရှိနေပါပြီ" },
  "next.on_the_way.detail": {
    en: "Keep your phone nearby so the courier can reach you.",
    my: "ပို့ဆောင်သူ ဆက်သွယ်နိုင်ရန် ဖုန်းကို အနီးတွင် ထားပါ။",
  },

  "next.delivered_window": {
    en: "Delivered — you can still return an item",
    my: "ပို့ဆောင်ပြီး — ပစ္စည်းကို ပြန်လည်ပေးပို့နိုင်ပါသေးသည်",
  },
  "next.delivered_window.detail": {
    en: "If something is wrong, start a return within 7 days of delivery.",
    my: "တစ်ခုခု မှားယွင်းနေပါက ပို့ဆောင်ပြီး ၇ ရက်အတွင်း ပြန်အမ်းရန် တောင်းဆိုပါ။",
  },

  "next.delivered_done": { en: "Delivered and closed", my: "ပို့ဆောင်ပြီး ပိတ်သိမ်းပြီး" },
  "next.delivered_done.detail": {
    en: "The 7-day return window has passed. If the machine develops a fault, open a warranty case.",
    my: "၇ ရက် ပြန်အမ်းကာလ ကုန်ဆုံးပါပြီ။ စက်တွင် ချွတ်ယွင်းမှု ဖြစ်ပါက အာမခံ ကိစ္စဖွင့်ပါ။",
  },

  "next.refund_details": {
    en: "Add your refund bank information",
    my: "ငွေပြန်လည်လက်ခံရန် ဘဏ်အချက်အလက် ဖြည့်ပါ",
  },
  "next.refund_details.detail": {
    en: "Your advance payment was confirmed. Enter the bank or wallet account where we should return the amount below.",
    my: "သင့်ကြိုတင်ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ။ အောက်ပါပမာဏကို ပြန်လည်လက်ခံလိုသော ဘဏ် သို့မဟုတ် ပိုက်ဆံအိတ်အကောင့်ကို ဖြည့်ပါ။",
  },
  "next.refund_pending": {
    en: "Your refund is being prepared",
    my: "သင့်ငွေပြန်အမ်းမှုကို ပြင်ဆင်နေပါသည်",
  },
  "next.refund_pending.detail": {
    en: "We received your bank information. The store will send the refund and record the transfer reference here.",
    my: "သင့်ဘဏ်အချက်အလက်ကို လက်ခံရရှိပါပြီ။ ဆိုင်မှ ငွေပြန်ပို့ပြီး ငွေလွှဲအမှတ်ကို ဤနေရာတွင် မှတ်တမ်းတင်ပါမည်။",
  },
  "next.refund_sent": {
    en: "Your refund has been sent",
    my: "သင့်ငွေကို ပြန်လည်ပေးပို့ပြီးပါပြီ",
  },
  "next.refund_sent.detail": {
    en: "Check your bank or wallet account. Keep the transfer reference until the money appears.",
    my: "သင့်ဘဏ် သို့မဟုတ် ပိုက်ဆံအိတ်အကောင့်ကို စစ်ဆေးပါ။ ငွေဝင်လာသည်အထိ ငွေလွှဲအမှတ်ကို သိမ်းထားပါ။",
  },

  "next.cancelled": { en: "This order was cancelled", my: "ဤအော်ဒါကို ပယ်ဖျက်ပြီးပါပြီ" },
  "next.cancelled.detail": { en: "Nothing more to do.", my: "ထပ်မံလုပ်ဆောင်စရာ မရှိပါ။" },

  "next.returned": { en: "This order was returned", my: "ဤအော်ဒါကို ပြန်လည်ပေးပို့ပြီးပါပြီ" },
  "next.returned.detail": { en: "Nothing more to do.", my: "ထပ်မံလုပ်ဆောင်စရာ မရှိပါ။" },

  // "Get help with this order"
  "help.button": { en: "Get help with this order", my: "ဤအော်ဒါအတွက် အကူအညီ ရယူရန်" },
  "help.title": { en: "What do you need help with?", my: "ဘာအတွက် အကူအညီ လိုပါသလဲ?" },
  "help.intro": {
    en: "Choose the problem. Your order, payment history, delivery updates and earlier messages are attached automatically — you do not have to explain them again.",
    my: "ပြဿနာကို ရွေးပါ။ သင့်အော်ဒါ၊ ငွေပေးချေမှု မှတ်တမ်း၊ ပို့ဆောင်မှု အခြေအနေနှင့် ယခင်စာများကို အလိုအလျောက် ပူးတွဲပေးပါမည် — ထပ်မံရှင်းပြရန် မလိုပါ။",
  },
  "help.topic.payment": { en: "Payment problem", my: "ငွေပေးချေမှု ပြဿနာ" },
  "help.topic.delivery": { en: "Delivery problem", my: "ပို့ဆောင်မှု ပြဿနာ" },
  "help.topic.faulty_item": { en: "Wrong or faulty item", my: "မှားယွင်းသော သို့မဟုတ် ချွတ်ယွင်းသော ပစ္စည်း" },
  "help.topic.cancel_order": { en: "Cancel order", my: "အော်ဒါ ပယ်ဖျက်ရန်" },
  "help.topic.warranty": { en: "Warranty help", my: "အာမခံ အကူအညီ" },
  "help.summary": { en: "Tell us what happened", my: "ဘာဖြစ်ခဲ့သည်ကို ပြောပြပါ" },
  "help.summaryPlaceholder": {
    en: "Example: I transferred on Monday but the order still says waiting for payment.",
    my: "ဥပမာ: တနင်္လာနေ့က ငွေလွှဲပြီးပါပြီ၊ သို့သော် အော်ဒါတွင် ငွေစောင့်နေသည်ဟု ပြနေပါသည်။",
  },
  "help.submit": { en: "Send to support", my: "အကူအညီသို့ ပို့ရန်" },
  "help.sending": { en: "Sending...", my: "ပို့နေသည်..." },
  "help.sent": {
    en: "Your case is open. Our team can see your order and will reply in your chat.",
    my: "သင့်ကိစ္စကို ဖွင့်လိုက်ပါပြီ။ ကျွန်ုပ်တို့သည် သင့်အော်ဒါကို မြင်နိုင်ပြီး ချက်တွင် ပြန်ကြားပါမည်။",
  },
  "help.openCase": { en: "Open case", my: "ဖွင့်ထားသော ကိစ္စ" },
  "help.status.open": { en: "Open", my: "ဖွင့်ထားသည်" },
  "help.status.waiting_customer": { en: "Waiting for you", my: "သင့်ကို စောင့်နေသည်" },
  "help.status.resolved": { en: "Resolved", my: "ဖြေရှင်းပြီး" },
  "help.status.closed": { en: "Closed", my: "ပိတ်ပြီး" },

  // Guided return: select item, describe, choose a solution
  "return.start": { en: "Return an item", my: "ပစ္စည်း ပြန်ပို့ရန်" },
  "return.step": { en: "Step {step} of 3", my: "အဆင့် {step} / ၃" },
  "return.step1": { en: "Select return products", my: "ပြန်ပို့မည့် ပစ္စည်းများကို ရွေးပါ" },
  "return.step2": { en: "Describe the problem", my: "ပြဿနာကို ဖော်ပြပါ" },
  "return.step3": { en: "Choose what you want", my: "လိုချင်သည်ကို ရွေးပါ" },
  "return.step1Help": {
    en: "Select one or more products to return. For bulk quantities, choose how many of each product.",
    my: "ပြန်ပို့မည့် ပစ္စည်းတစ်ခု သို့မဟုတ် အများအပြားကို ရွေးပါ။ အရေအတွက်များပါက ပစ္စည်းတစ်မျိုးစီ၏ အရေအတွက်ကို ရွေးပါ။",
  },
  "return.quantity": { en: "How many of this item?", my: "ဤပစ္စည်း ဘယ်နှစ်ခု?" },
  "return.problem": { en: "What is wrong?", my: "ဘာဖြစ်နေပါသလဲ?" },
  "return.describe": { en: "Describe the problem", my: "ပြဿနာကို ဖော်ပြပါ" },
  "return.describePlaceholder": {
    en: "Example: The screen has a crack in the corner and the box was already torn.",
    my: "ဥပမာ: မျက်နှာပြင် ထောင့်တွင် အက်ကြောင်းရှိပြီး ဘူးလည်း စုတ်ပြဲနေပါသည်။",
  },
  "return.evidence": { en: "Photos and unboxing video", my: "ဓာတ်ပုံများနှင့် ထုပ်ပိုးဖွင့်သည့် ဗီဒီယို" },
  "return.uploadEvidence": { en: "Upload photo or video (important)", my: "ဓာတ်ပုံ သို့မဟုတ် ဗီဒီယို တင်ပါ (အရေးကြီးသည်)" },
  "return.evidenceHelp": {
    en: "Add clear photos of the problem. For delivery damage, also add the video you recorded while opening the parcel.",
    my: "ပြဿနာကို ရှင်းလင်းစွာ မြင်ရသော ဓာတ်ပုံများ ထည့်ပါ။ ပို့ဆောင်စဉ် ပျက်စီးမှုအတွက် ပါဆယ်ဖွင့်စဉ် ရိုက်ထားသော ဗီဒီယိုကိုပါ ထည့်ပါ။",
  },
  "return.videoRule": {
    en: "Please film the sealed parcel and keep recording while you open it. One continuous video of about 30 seconds is enough, and it is the strongest evidence for transit damage.",
    my: "ပါဆယ်ကို မဖွင့်မီ ရိုက်ကူးပြီး ဖွင့်နေစဉ်တစ်လျှောက် ဆက်လက်ရိုက်ကူးပါ။ စက္ကန့် ၃၀ ခန့် တစ်ဆက်တည်း ဗီဒီယိုတစ်ခုဖြင့် လုံလောက်ပြီး ပို့ဆောင်စဉ် ပျက်စီးမှုအတွက် အခိုင်မာဆုံး သက်သေ ဖြစ်ပါသည်။",
  },
  "return.videoConfirm": {
    en: "I recorded the parcel before opening it, and the video shows the whole unboxing.",
    my: "ပါဆယ်ကို မဖွင့်မီ ရိုက်ကူးထားပြီး ဗီဒီယိုတွင် ဖွင့်သည့် အစအဆုံး ပါဝင်ပါသည်။",
  },
  "return.fileLimit": {
    en: "Photos up to 10 MB, video up to 25 MB (about 30 seconds). If your video is larger, paste a secure link instead.",
    my: "ဓာတ်ပုံ ၁၀ MB အထိ၊ ဗီဒီယို ၂၅ MB (စက္ကန့် ၃၀ ခန့်) အထိ။ ဗီဒီယို ကြီးလွန်းပါက လုံခြုံသော လင့်ခ်ကို ကူးထည့်ပါ။",
  },
  "return.evidenceLink": { en: "Secure video link (optional)", my: "လုံခြုံသော ဗီဒီယို လင့်ခ် (မဖြစ်မနေ မဟုတ်)" },
  "return.resolution": { en: "What would you like?", my: "ဘာကို လိုချင်ပါသလဲ?" },
  "return.resolution.replacement": { en: "Replacement", my: "အစားထိုး ပစ္စည်း" },
  "return.resolution.refund": { en: "Refund", my: "ငွေပြန်အမ်းခြင်း" },
  "return.resolution.repair": { en: "Repair", my: "ပြုပြင်ခြင်း" },
  "return.resolutionHelp": {
    en: "We check what is available for this item. If we cannot do what you chose, we will explain and offer the closest option.",
    my: "ဤပစ္စည်းအတွက် ရနိုင်သည်များကို စစ်ဆေးပါမည်။ သင်ရွေးထားသည်ကို မလုပ်ပေးနိုင်ပါက ရှင်းပြပြီး အနီးစပ်ဆုံး နည်းလမ်းကို ကမ်းလှမ်းပါမည်။",
  },
  "return.bankName": { en: "Bank or wallet name", my: "ဘဏ် သို့မဟုတ် Wallet အမည်" },
  "return.accountName": { en: "Account holder name", my: "အကောင့်ပိုင်ရှင် အမည်" },
  "return.accountNumber": { en: "Bank account / wallet number", my: "ဘဏ်အကောင့် / Wallet နံပါတ်" },
  "return.refundAccountRequired": { en: "Enter the bank or wallet, account holder, and account number for the refund.", my: "ငွေပြန်အမ်းရန် ဘဏ် သို့မဟုတ် Wallet၊ အကောင့်ပိုင်ရှင်နှင့် အကောင့်နံပါတ်ကို ထည့်ပါ။" },
  "return.replacementDate": { en: "Preferred replacement date", my: "အစားထိုးလိုသည့် ရက်နှင့် အချိန်" },
  "return.repairDate": { en: "Preferred repair date", my: "ပြုပြင်လိုသည့် ရက်နှင့် အချိန်" },
  "return.serviceDateRequired": { en: "Choose your preferred date and time.", my: "နှစ်သက်ရာ ရက်နှင့် အချိန်ကို ရွေးပါ။" },
  "return.collection": { en: "How should we collect it?", my: "မည်သို့ ပြန်လည်ရယူရမလဲ?" },
  "return.collection.courier_pickup": { en: "Courier pickup", my: "ပို့ဆောင်သူက လာယူရန်" },
  "return.collection.store_dropoff": { en: "Drop off at the store", my: "ဆိုင်တွင် လာပေးရန်" },
  "return.pickupAddress": { en: "Pickup address", my: "လာယူရမည့် လိပ်စာ" },
  "return.deadline": {
    en: "You can request a return until {date}.",
    my: "{date} အထိ ပြန်ပို့ရန် တောင်းဆိုနိုင်ပါသည်။",
  },
  "return.deadlinePassed": {
    en: "The 7-day return window has closed. Open a warranty case instead and we will check what is still covered.",
    my: "၇ ရက် ပြန်ပို့ခွင့် ကာလ ကုန်ဆုံးသွားပါပြီ။ အာမခံ ကိစ္စတစ်ခု ဖွင့်ပါ၊ ကျန်ရှိသေးသော အကျုံးဝင်မှုကို စစ်ဆေးပေးပါမည်။",
  },
  "return.next": { en: "Next", my: "ရှေ့သို့" },
  "return.back": { en: "Back", my: "နောက်သို့" },
  "return.submit": { en: "Send return request", my: "ပြန်ပို့ရန် တောင်းဆိုချက် ပို့မည်" },
  "return.submitting": { en: "Sending...", my: "ပို့နေသည်..." },
  "return.sent": {
    en: "Return request sent. We will review your evidence and reply.",
    my: "ပြန်ပို့ရန် တောင်းဆိုချက် ပို့ပြီးပါပြီ။ သက်သေများကို စစ်ဆေးပြီး ပြန်ကြားပါမည်။",
  },
  "return.myRequests": { en: "Your return requests", my: "သင့် ပြန်ပို့ရန် တောင်းဆိုချက်များ" },
  // Admin work queue
  "admin.queue": { en: "Work Queue", my: "လုပ်ငန်း စာရင်း" },
  "queue.title": { en: "Cases needing attention", my: "ဂရုစိုက်ရန် လိုအပ်သော ကိစ္စများ" },
  "queue.none": { en: "Nothing waiting. The queue is clear.", my: "စောင့်ဆိုင်းနေသည် မရှိပါ။ လုပ်ငန်းစာရင်း ရှင်းနေပါသည်။" },
  "queue.lane.awaiting_payment_check": { en: "Awaiting payment check", my: "ငွေပေးချေမှု စစ်ဆေးရန်" },
  "queue.lane.delivery_issue": { en: "Delivery issue", my: "ပို့ဆောင်မှု ပြဿနာ" },
  "queue.lane.return_review": { en: "Return review", my: "ပြန်ပို့မှု စစ်ဆေးရန်" },
  "queue.lane.inspection": { en: "Inspection", my: "ပစ္စည်း စစ်ဆေးရန်" },
  "queue.lane.refund_due": { en: "Refund due", my: "ငွေပြန်အမ်းရန်" },
  "queue.lane.warranty_repair": { en: "Warranty repair", my: "အာမခံ ပြုပြင်ရန်" },
  "queue.owner": { en: "Owner", my: "တာဝန်ရှိသူ" },
  "queue.unassigned": { en: "Unassigned", my: "တာဝန် မသတ်မှတ်ရသေး" },
  "queue.nextAction": { en: "Next action", my: "နောက်တစ်ဆင့် လုပ်ရန်" },
  "queue.dueDate": { en: "Due date", my: "သတ်မှတ်ရက်" },
  "queue.overdue": { en: "Overdue", my: "ရက်လွန်နေသည်" },
  "queue.save": { en: "Save", my: "သိမ်းရန်" },
  "queue.staffNotes": { en: "Staff notes", my: "ဝန်ထမ်း မှတ်စု" },
  "queue.internalOnly": {
    en: "Internal only — the customer never sees these.",
    my: "အတွင်းရေးသာ — ဖောက်သည်များ မမြင်ရပါ။",
  },
  "queue.addNote": { en: "Add note", my: "မှတ်စု ထည့်ရန်" },
  "queue.markDone": { en: "Mark done", my: "ပြီးစီးကြောင်း မှတ်ရန်" },
  "queue.markingDone": { en: "Closing...", my: "ပိတ်နေသည်..." },
  "queue.openOrder": { en: "Open in Customer Purchases", my: "ဗယ်ယူမှုများတွင် ဖွင့်ရန်" },
  "queue.clears.order": {
    en: "Clears itself once the payment or delivery is sorted.",
    my: "ငွေပေးချေမှု သို့မဟုတ် ပို့ဆောင်မှု ပြီးပြတ်သည်နှင့် အလိုအလျောက် ပျောက်သွားပါမည်။",
  },
  "queue.clears.return": {
    en: "Clears itself once the return reaches its decision.",
    my: "ပြန်ပို့မှု ဆုံးဖြတ်ချက် ချပြီးသည်နှင့် အလိုအလျောက် ပျောက်သွားပါမည်။",
  },
  "queue.notePlaceholder": {
    en: "Example: Called the bank, transfer not visible yet, try again tomorrow.",
    my: "ဥပမာ: ဘဏ်ကို ဖုန်းဆက်ပြီးပါပြီ၊ ငွေလွှဲ မပေါ်သေးပါ၊ မနက်ဖြန် ထပ်စစ်ပါမည်။",
  },

  // Refund tracker: the five steps a customer can follow
  "refund.title": { en: "Refund progress", my: "ငွေပြန်အမ်းမှု အခြေအနေ" },
  "refund.view": { en: "View refund status", my: "ငွေပြန်အမ်းမှု အခြေအနေ ကြည့်ရန်" },
  "refund.step.request_received": { en: "Request received", my: "တောင်းဆိုချက် လက်ခံရရှိပြီး" },
  "refund.step.under_review": { en: "Under review", my: "စစ်ဆေးနေဆဲ" },
  "refund.step.item_received": { en: "Item received", my: "ပစ္စည်း လက်ခံရရှိပြီး" },
  "refund.step.refund_approved": { en: "Refund approved", my: "ငွေပြန်အမ်းရန် အတည်ပြုပြီး" },
  "refund.step.money_sent": { en: "Money sent", my: "ငွေ ပြန်လည်ပေးပို့ပြီး" },
  "refund.expected": { en: "Expected by {date}", my: "{date} အထိ မျှော်မှန်းထားသည်" },
  "refund.noEstimate": {
    en: "We will confirm a refund date once we have checked the item.",
    my: "ပစ္စည်းကို စစ်ဆေးပြီးသည်နှင့် ငွေပြန်အမ်းမည့်ရက်ကို အတည်ပြုပေးပါမည်။",
  },
  "refund.delayed": { en: "This is taking longer than expected", my: "မျှော်မှန်းထားသည်ထက် ကြာနေပါသည်" },
  "refund.amount": { en: "Refund amount", my: "ပြန်အမ်းမည့် ပမာဏ" },
  "refund.sentOn": { en: "Sent on {date}", my: "{date} တွင် ပေးပို့ပြီး" },
  "refund.reference": { en: "Reference", my: "ကိုးကားနံပါတ်" },
  "refund.stopped": {
    en: "This request was closed without a refund. The reason is shown above.",
    my: "ဤတောင်းဆိုချက်ကို ငွေပြန်အမ်းခြင်း မရှိဘဲ ပိတ်လိုက်ပါသည်။ အကြောင်းရင်းကို အထက်တွင် ဖော်ပြထားပါသည်။",
  },
  "refund.setExpected": { en: "Expected refund date", my: "ငွေပြန်အမ်းမည့် မျှော်မှန်းရက်" },
  "refund.setDelayReason": { en: "Why is it delayed?", my: "အဘယ်ကြောင့် နောက်ကျနေသနည်း?" },
  "refund.savePlan": { en: "Save refund date", my: "ငွေပြန်အမ်းရက် သိမ်းရန်" },
  "refund.approveRefund": { en: "Approve refund", my: "ငွေပြန်အမ်းရန် အတည်ပြုမည်" },
  "refund.markSent": { en: "Mark money sent", my: "ငွေပေးပို့ပြီးဟု မှတ်မည်" },

  "return.status.refund_approved": { en: "Refund approved", my: "ငွေပြန်အမ်းရန် အတည်ပြုပြီး" },
  "return.status.requested": { en: "Waiting for review", my: "စစ်ဆေးရန် စောင့်ဆိုင်းဆဲ" },
  "return.status.more_info_needed": { en: "More information needed", my: "အချက်အလက် ထပ်လိုအပ်သည်" },
  "return.status.approved": { en: "Approved", my: "အတည်ပြုပြီး" },
  "return.status.declined": { en: "Declined", my: "ငြင်းပယ်ခဲ့သည်" },
  "return.status.collected": { en: "Collected", my: "ပြန်လည်ရယူပြီး" },
  "return.status.inspected": { en: "Inspected", my: "စစ်ဆေးပြီး" },
  "return.status.completed": { en: "Completed", my: "ပြီးဆုံးပြီး" },
  "return.status.cancelled": { en: "Cancelled", my: "ပယ်ဖျက်ပြီး" },
  "return.bar.title": { en: "Last return process", my: "နောက်ဆုံး ပြန်အပ်မှု အခြေအနေ" },
  "return.bar.view": { en: "View return status", my: "ပြန်အပ်မှု အခြေအနေ ကြည့်ရန်" },
  "return.order.requested": { en: "Return requested", my: "ပြန်အပ်ရန် တောင်းဆိုပြီး" },
  "return.order.approved": { en: "Return approved", my: "ပြန်အပ်မှု အတည်ပြုပြီး" },
  "return.order.pickup_scheduled": { en: "Pickup / drop-off scheduled", my: "လာယူရန် / ပို့ရန် စီစဉ်ပြီး" },
  "return.order.received": { en: "Item received", my: "ပစ္စည်း လက်ခံရရှိပြီး" },
  "return.order.refunded": { en: "Refunded", my: "ငွေပြန်အမ်းပြီး" },
  "return.order.rejected": { en: "Return rejected", my: "ပြန်အပ်မှု ငြင်းပယ်ထားသည်" },
  "return.askReview": { en: "Ask us to look again", my: "ပြန်လည် စစ်ဆေးပေးရန် တောင်းဆိုမည်" },
  "return.askReviewHelp": {
    en: "If you think this decision is wrong, tell us why and a second person will review it.",
    my: "ဤဆုံးဖြတ်ချက် မှားသည်ဟု ထင်ပါက အကြောင်းရင်းကို ပြောပြပါ၊ အခြားသူတစ်ဦးက ပြန်လည်စစ်ဆေးပါမည်။",
  },
  "return.reviewSent": {
    en: "Thank you. We will look at this again.",
    my: "ကျေးဇူးတင်ပါသည်။ ဤကိစ္စကို ပြန်လည် စစ်ဆေးပါမည်။",
  },

  // Admin: help cases and return reviews
  "admin.cases": { en: "Help Cases", my: "အကူအညီ ကိစ္စများ" },
  "adminCase.inbox": { en: "Customer help cases", my: "ဖောက်သည် အကူအညီ ကိစ္စများ" },
  "adminCase.none": { en: "No help cases yet.", my: "အကူအညီ ကိစ္စ မရှိသေးပါ။" },
  "adminCase.order": { en: "Order", my: "အော်ဒါ" },
  "adminCase.topic": { en: "Topic", my: "ခေါင်းစဉ်" },
  "adminCase.customerSays": { en: "Customer says", my: "ဖောက်သည် ပြောသည်" },
  "adminCase.payments": { en: "Payment history", my: "ငွေပေးချေမှု မှတ်တမ်း" },
  "adminCase.delivery": { en: "Delivery", my: "ပို့ဆောင်ရေး" },
  "adminCase.evidence": { en: "Photos and video", my: "ဓာတ်ပုံနှင့် ဗီဒီယို" },
  "adminCase.conversation": { en: "Open the chat", my: "ချက်ကို ဖွင့်ရန်" },
  "adminCase.markResolved": { en: "Mark resolved", my: "ဖြေရှင်းပြီးဟု မှတ်ရန်" },
  "adminCase.reopen": { en: "Reopen", my: "ပြန်ဖွင့်ရန်" },
  "adminCase.returns": { en: "Return requests", my: "ပြန်ပို့ရန် တောင်းဆိုချက်များ" },
  "adminCase.approve": { en: "Approve", my: "အတည်ပြုရန်" },
  "adminCase.moreInfo": { en: "Ask for more information", my: "အချက်အလက် ထပ်တောင်းရန်" },
  "adminCase.decline": { en: "Decline", my: "ငြင်းပယ်ရန်" },
  "adminCase.decisionNote": { en: "Explain your decision", my: "ဆုံးဖြတ်ချက်ကို ရှင်းပြပါ" },
  "adminCase.grant": { en: "What are you giving?", my: "ဘာကို ပေးမည်နည်း?" },
  "adminCase.reviewRequested": {
    en: "Customer asked for another review",
    my: "ဖောက်သည်က ပြန်လည်စစ်ဆေးရန် တောင်းဆိုထားသည်",
  },
} satisfies Record<string, Record<Language, string>>;

export type TranslationKey = keyof typeof translations;

/**
 * Looks up a key and fills `{name}` placeholders, so numbers and dates are
 * formatted by the caller rather than baked into the dictionary.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  vars: Record<string, string | number> = {}
) {
  const entry = translations[key];
  if (!entry) return String(key);

  return entry[language].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}
