# Payment images

Checkout shows these four files. **They are not in the repository yet** — until
they are added, checkout falls back to a lettered badge (KBZ / AYA / MMQR)
instead of a broken-image icon, and the MMQR panel shows a notice telling the
customer to pay by bank transfer instead.

The account numbers and account names always show, with or without these files.

| File | What it is | Source |
| --- | --- | --- |
| `kbz.png` | KBZ Bank logo | the red/blue KBZ BANK mark |
| `aya.png` | AYA Bank logo | the red/grey AYA mark |
| `mmqr-logo.png` | MyanmarPay MMQR logo | the gold circle with the MMQR wordmark |
| `mmqr-qr.png` | The shop's own MMQR code | crop it out of the Aphrodite Myanmar bank-account card |

Square images work best (about 200×200 for the three logos).

## The QR is the one that matters

`mmqr-qr.png` must be the **original** image, cropped to the code itself with a
small white margin and nothing else — no flyer border, no wallet strip beneath
it. Save it at 600×600 or larger; it renders about 190px wide and has to stay
sharp enough for a phone to read.

Never redraw or regenerate this QR by eye from a screenshot. A QR that is even
slightly wrong still scans, and it sends the customer's money to whatever it
actually encodes. Only the real exported image is safe to use.

## Who sees what

The MMQR code is shown to retail customers only. Wholesale buyers see the KBZ
and AYA bank accounts and pay by transfer.
