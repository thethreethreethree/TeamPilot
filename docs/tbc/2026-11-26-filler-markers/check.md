# CHECK - Filler-word markers on the call page

## Commands

```
production probe (counts only): 2,818 current transcript lines, 1,373 with um/uh/uhm/erm/hmm; 168 of 186 calls
npx vitest run stats RemoteCallPanel.simple.render [id]/stats route → passed
noFailedReadAsEmpty, americanSpelling → passed; invariant-audit 0; theme clean; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - no filler-word markers
class: missing point of interest (F9.6).
sweep: the call page's points of interest.
severity: low
