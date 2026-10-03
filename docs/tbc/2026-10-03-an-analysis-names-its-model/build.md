# BUILD - an analysis names its model

### A pitch analysis records its model

- **write-path:** `src/lib/coach/doorlog/analyze.ts` returns `model`; `worker.ts` stores `analysis.model`.
- **read-path:** `analyze.model.test.ts`; `worker.test.ts` "an analysis records the model that wrote it".

### A rep summary records its model

- **write-path:** `src/lib/coach/doorlog/rollup.ts` returns `model`; `rollupWorker.ts` stores `rollup.model`.
- **read-path:** `rollupWorker.test.ts` "a summary records the model that wrote it".
