# Copyright (c) 2026 Devansh Singh
# All Rights Reserved.
#
# This software and its source code are proprietary
# and confidential property of Guru AI Technologies.
#
# Unauthorized copying, modification, distribution,
# or use of this software, in whole or in part,
# is strictly prohibited without prior written
# permission from Guru AI Technologies.
COMPANY LOGO: where to put it and what to call it
==================================================
Put ONE file in this folder (public/brand/) with exactly this name:

    logo.png        <- best choice (transparent background)
  or  logo.webp / logo.jpg / logo.svg

The first one found is used, in this order: logo.png, logo.webp, logo.jpg, logo.svg.
(The grey "YOUR LOGO HERE" logo.svg is only a placeholder. Adding logo.png replaces it.)

Best size: a wide logo, about 600 x 150 pixels, transparent background.
Use a dark/coloured logo: it appears on white cards. On dark panels it is
automatically placed on a small white plate, so one file is enough.

Then set your company name in  src/lib/brand.ts  and redeploy.

Where it appears: the sign-in page (top of the card and the side panel), the side
menu footer ("Powered by"), the platform admin menu, and bills / PDF receipts.

OPTIONAL: sign-in background photo
Add  login-bg.jpg  (about 1600 x 1000, a calm salon photo) to this folder and it
becomes the soft background behind the sign-in card. Without it, a clean gradient is used.
