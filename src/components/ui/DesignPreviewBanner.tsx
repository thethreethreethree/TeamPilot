import { Beaker } from "lucide-react";

/**
 * Banner shown atop any surface that is a *visualization preview* of a feature
 * that has no real data source yet (Team / Finance / Marketing in the current
 * build). The constitution says day-one behavior is a lie (§3.4); the honest
 * fix is to label these surfaces clearly so they cannot be mistaken for
 * production.
 */
export default function DesignPreviewBanner({
  domain,
  needs,
}: {
  domain: string;
  /** What real data source this surface needs before it can become production. */
  needs: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/30">
      <Beaker className="w-4 h-4 text-violet-300 mt-0.5 flex-shrink-0" />
      <div className="text-xs leading-relaxed">
        <p className="text-violet-200 font-medium mb-1">
          Design preview — {domain} is not production yet
        </p>
        <p className="text-secondary">
          The numbers below are fixtures used to evaluate the surface design. {needs}{" "}
          Until that exists, the values you see here are illustrative, not derived.
        </p>
      </div>
    </div>
  );
}
