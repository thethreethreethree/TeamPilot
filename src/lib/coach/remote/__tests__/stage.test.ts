import { describe, it, expect } from 'vitest';
import { remoteStage, type StageFacts } from '../session/stage';

const base: StageFacts = { status: 'ended', hasAudio: true, segmentCount: 10, hasAnalysis: true, scored: false, failure: null };

describe('remoteStage (RSS Phase 1, F6.6)', () => {
  it('walks the stages in order from what exists', () => {
    expect(remoteStage({ ...base, hasAudio: false, segmentCount: 0, hasAnalysis: false }).state).toBe('uploading');
    expect(remoteStage({ ...base, segmentCount: 0, hasAnalysis: false }).state).toBe('transcribing');
    expect(remoteStage({ ...base, hasAnalysis: false }).state).toBe('analyzing');
    expect(remoteStage(base).state).toBe('scoring');
    expect(remoteStage({ ...base, scored: true }).state).toBe('scored');
  });
  it('a live session is live, whatever else exists', () => {
    expect(remoteStage({ ...base, status: 'active', scored: true }).state).toBe('live');
  });
  it('a recorded failure stops the walk and carries its reason; a score outranks an old failure', () => {
    expect(remoteStage({ ...base, failure: 'NO_SPEECH' })).toEqual({ state: 'failed', failure: 'NO_SPEECH' });
    expect(remoteStage({ ...base, failure: 'BELOW_SCORING_FLOOR' })).toEqual({ state: 'not_scored', failure: 'BELOW_SCORING_FLOOR' });
    expect(remoteStage({ ...base, scored: true, failure: 'AI_UNAVAILABLE' })).toEqual({ state: 'scored', failure: null });
  });
});
