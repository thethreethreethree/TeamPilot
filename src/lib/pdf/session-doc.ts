/**
 * The call, turned into the document the PDF writer draws.
 *
 * ONE SOURCE FOR BOTH EXPORTS. The plain-text share and this PDF are the same
 * record in two containers, so they read the same session, segments and cues, in
 * the same order, through the same `buildTimeline`. Two exports of one call that
 * disagreed about what was said would be worse than having only one of them.
 *
 * THE UNATTRIBUTED WARNING TRAVELS. When nobody has said which voice is the rep,
 * every line reads "Unclear" — and a manager opening a PDF away from the app has
 * no other way to learn that this means nobody has answered the question, not
 * that the audio was poor. The text export already says so; a PDF that dropped it
 * would look like a worse recording than it was.
 *
 * PURE, so the shape of the document is tested rather than eyeballed in a viewer.
 */
import type { CoachingCue, CoachingSession, TranscriptSegment } from '@/types/backend';
import { clockTime, duration, money, outcomeLabel, shortDate } from '@/lib/format';
import { buildTimeline } from '@/lib/session-timeline';
import type { DocBlock, SessionDoc } from './session-pdf';

export function buildSessionDoc({
  session,
  segments,
  cues,
}: {
  session: CoachingSession;
  segments: TranscriptSegment[];
  cues: CoachingCue[];
}): SessionDoc {
  const title = session.client_label?.trim() || 'Session';
  const blocks: DocBlock[] = [];

  const length = duration(session.audio_duration_seconds);
  if (length) blocks.push({ kind: 'fact', label: 'Length', value: length });
  blocks.push({ kind: 'fact', label: 'Outcome', value: outcomeLabel(session.outcome) });

  const value = money(session.deal_value);
  if (value) blocks.push({ kind: 'fact', label: 'Deal value', value });
  if (session.territory) blocks.push({ kind: 'fact', label: 'Where', value: session.territory });
  if (session.approach) blocks.push({ kind: 'fact', label: 'How', value: session.approach });
  if (session.offer) blocks.push({ kind: 'fact', label: 'What', value: session.offer });

  const { entries, unplacedCues } = buildTimeline(segments, cues);

  blocks.push({ kind: 'gap' });
  blocks.push({ kind: 'heading', text: 'Conversation' });

  if (segments.length === 0) {
    // Not an empty section. An empty section under a heading reads as a call
    // where nobody spoke.
    blocks.push({
      kind: 'note',
      text: 'There is no transcript for this call. The recording was not transcribed.',
    });
  } else {
    if (!segments.some((seg) => seg.speaker === 'agent' || seg.speaker === 'customer')) {
      blocks.push({
        kind: 'note',
        text: 'Nobody has said which voice is the salesperson, so the lines below are not attributed. "Unclear" does not mean the audio was bad.',
      });
      blocks.push({ kind: 'gap' });
    }
    for (const entry of entries) {
      if (entry.kind === 'segment') {
        const seg = entry.segment;
        const who =
          seg.speaker === 'agent' ? 'Me' : seg.speaker === 'customer' ? 'Customer' : 'Unclear';
        blocks.push({ kind: 'turn', who, text: seg.text });
      } else {
        const kind = entry.cue.mode === 'guide_response' ? 'Guided response' : 'Suggestion';
        blocks.push({ kind: 'cue', text: `Coach - ${kind}: ${entry.cue.text}` });
      }
    }
  }

  // With no transcript there is nothing to interleave against, so the cues are
  // listed on their own rather than silently vanishing from the export.
  const listedApart = segments.length === 0 ? cues : unplacedCues;
  if (segments.length === 0 || unplacedCues.length > 0) {
    blocks.push({ kind: 'gap' });
    blocks.push({
      kind: 'heading',
      text: segments.length === 0 ? 'Coach cues' : 'Cues without a time',
    });
    if (listedApart.length === 0) {
      blocks.push({ kind: 'note', text: 'None were delivered during this call.' });
    } else {
      for (const cue of listedApart) {
        const kind = cue.mode === 'guide_response' ? 'Guided response' : 'Suggestion';
        blocks.push({ kind: 'cue', text: `${kind}: ${cue.text}` });
      }
    }
  }

  return {
    title,
    // A middle dot, not an em dash: the base font is WinAnsi and the house style
    // bans em dashes in generated copy for exactly this reason.
    subtitle: `${shortDate(session.started_at)} at ${clockTime(session.started_at)}`,
    blocks,
  };
}
