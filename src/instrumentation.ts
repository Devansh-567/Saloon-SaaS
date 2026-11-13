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
// 2026 Devansh Singh
// Guru AI Technologies
```
// 2026 Devansh Singh
// Guru AI Technologies
```export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureStorage } = await import("./lib/storage");
    await ensureStorage().catch((error) => {
      console.error(JSON.stringify({ level: "error", message: "storage_init_failed", error: String(error) }));
    });
  }
}

