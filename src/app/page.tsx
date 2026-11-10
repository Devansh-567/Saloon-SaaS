import { redirect } from "next/navigation";
import { getVerifiedViewer } from "@/lib/auth";

// No marketing page: the app opens straight on the sign-in screen.
export default async function HomePage() {
  const viewer = await getVerifiedViewer();
  redirect(viewer ? (viewer.user.platformRole === "SUPER_ADMIN" ? "/platform" : "/dashboard") : "/login");
}
