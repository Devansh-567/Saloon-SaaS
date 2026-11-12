import { redirect } from "next/navigation";
import { getVerifiedViewer } from "@/lib/auth";

export default async function HomePage() {
  const viewer = await getVerifiedViewer();
  redirect(viewer ? (viewer.user.platformRole === "SUPER_ADMIN" ? "/platform" : "/dashboard") : "/login");
}
