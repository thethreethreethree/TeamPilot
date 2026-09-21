import { Scoreboard } from "@/components/sales-coach/Scoreboard";
import { PitchLeaderboard } from "@/components/sales-coach/PitchLeaderboard";

/**
 * /dashboard/sales-coach/scoreboard — the team boards.
 *
 * TWO BOARDS, NAMED, ON ONE PAGE, and that is the resolution of a collision rather than a layout
 * choice. Until now this route held one thing called "the leaderboard", ranked by gamification
 * points, while the rubric sheet (p.6) made Pitch Score the competition board. Two different
 * orderings of the same reps under one word is the least defensible state a metric can reach —
 * recorded as R3 of the two-systems map, and closed here.
 *
 * Putting them on the same page, each saying what it ranks, is deliberately not the tidier option.
 * The tidier option is to show one and quietly drop the other, and that loses information a team
 * is already using: the points board counts activity and consistency, the Pitch Score board counts
 * quality on the pitches that qualified. A rep can be first on one and fourth on the other, and
 * that difference is worth seeing rather than hiding.
 *
 * Pitch Score leads because the rubric says it is the competition board.
 */
export default function ScoreboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <PitchLeaderboard />
      </section>

      <section>
        <div className="mb-3 border-t border-default pt-6">
          <h2 className="text-sm font-semibold text-primary">Activity points</h2>
          <p className="mt-1 text-[11px] text-muted">
            A different board, ranking a different thing: points earned for sessions and deals, not
            pitch quality. A rep can lead one and not the other.
          </p>
        </div>
        <Scoreboard />
      </section>
    </div>
  );
}
