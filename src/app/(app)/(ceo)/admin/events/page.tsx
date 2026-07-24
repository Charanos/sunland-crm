import { redirect } from "next/navigation";

// The standalone Events board is absorbed by the unified Operations Scheduler
// (ADR 019). Kept as a redirect so old links and bookmarks still land.
export default function EventsPage() {
  redirect("/admin/scheduler?mode=events&scope=personal");
}
