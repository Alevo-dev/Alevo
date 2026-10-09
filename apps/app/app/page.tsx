import { redirect } from "next/navigation";

/** The app root has no landing page of its own — send signed-in users to the
 *  dashboard. (proxy.ts already redirects unauthenticated users to sign-in.) */
export default function Home() {
  redirect("/dashboard");
}
