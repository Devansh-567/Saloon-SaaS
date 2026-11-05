export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureStorage } = await import("./lib/storage");
    await ensureStorage().catch((error) => {
      console.error(JSON.stringify({ level: "error", message: "storage_init_failed", error: String(error) }));
    });
  }
}
