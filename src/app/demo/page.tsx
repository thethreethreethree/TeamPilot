import { redirect } from "next/navigation";

/**
 * /demo route — deprecated.
 *
 * Previous implementation was a 700-line standalone snapshot of the
 * pre-constitution UI (referencing mockCompany.healthScore = 74 and the old
 * "AI Executive Briefing" overtake language). It went out of date the moment
 * the constitution was adopted and was never updated.
 *
 * The /dashboard route works fully in demo mode now (yellow "Demo" badge in
 * sidebar, fixtures clearly labeled, etc.) and IS the actual product. Anyone
 * landing here gets sent there.
 */
export default function DemoPage(): never {
  redirect("/dashboard");
}
