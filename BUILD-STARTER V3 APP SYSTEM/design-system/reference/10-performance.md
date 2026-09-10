# Performance

Performance is a design constraint. A beautiful screen that janks when you scroll
it, or an app that shows four seconds of splash before anything is usable, is a
badly designed app — the delay is part of the experience, not separate from it.

## The metrics that matter

There is no single cross-platform p75 regime like the web's Core Web Vitals.
Native performance is a handful of concrete numbers, measured per platform:

| Metric | Target | Why |
|---|---|---|
| **Cold start** — launch to first interactive screen | keep it short; every extra second loses people at the door | The app's first impression; measured by Android Vitals / iOS launch metrics |
| **Frame rate** — sustained 60fps (**16.7ms/frame**; 120fps ≈ **8.3ms** on ProMotion) | never drop frames during scroll or animation | A dropped frame is visible jank |
| **Input latency** — response within 100ms | acknowledge every tap immediately | See the budgets below |
| **Scroll performance** | no blank cells, no stutter in long lists | The most common real-world jank source |

**Two threads decide most of this.** RN runs your logic on the **JS thread** and
draws on the **UI (native) thread**. Anything heavy on the JS thread — a big
re-render, JSON parsing, an un-virtualized list — starves it, and animations or
gestures driven from JS stutter. Keep animation on the UI thread (Reanimated
worklets / `useNativeDriver`), and move heavy work off the render path.

**Ship with Hermes.** The Hermes engine precompiles to bytecode, which cuts
startup time and memory versus JSC — it is the default in current Expo/RN (verify
current). Do not disable it without a measured reason.

## Response-time budgets

Platform-agnostic and still the best mental model:

| Budget | Meaning | Source |
|---|---|---|
| **100ms** | Feels instantaneous. Acknowledge every input within this. | Miller 1968 / RAIL |
| **1s** | Flow preserved. No spinner needed below this. | Miller 1968 |
| **10s** | Attention lost. Show progress and allow cancellation. | Miller 1968 |

Do **not** cite the "Doherty Threshold, 400ms" — a 1982 unreviewed internal IBM
report on mainframe terminals, promoted to a "law" by blogs. Miller's thresholds
are better sourced and more useful.

## The design decisions that cost performance

Most performance problems are design decisions, not engineering ones.

| Decision | Cost |
|---|---|
| Un-virtualized long list (`.map()` in a `ScrollView`) | Renders and holds every row — the single biggest cause of jank and memory bloat. |
| Oversized source images | A 4000px photo drawn into a 200dp thumbnail wastes decode time and memory. Size the asset to the target. |
| Full-screen background video / WebGL | Heavy on memory and the GPU; drains battery and can stutter on low-end devices. |
| `backdrop`/`BlurView` on large surfaces | A real per-frame cost. Permitted small (nav, a sheet), not full-screen. |
| Frequent re-renders | Unstable props/callbacks re-render whole subtrees each frame and starve the JS thread. |
| Animating on the JS thread | Any spring/gesture not on the UI thread drops frames under load. |
| Large JS bundle / heavy dependencies | Slower cold start and bigger updates. Import cost is real; prefer lean libraries. |
| Late-loading content with no reserved space | Layout jumps as data arrives — the app equivalent of CLS. |

## Non-negotiables

- **Virtualize every long list.** `FlatList` / `SectionList`, or **FlashList** for
  large or heavy lists. Give rows a stable `keyExtractor`, and — where you can —
  a known item size (`getItemLayout` / `estimatedItemSize`) so the list can skip
  measuring.
- **Cache and size every image.** Use **`expo-image`** (memory + disk cache,
  `placeholder`/blurhash, `contentFit`, `priority`, `recyclingKey` for list
  cells). Serve assets at the size they render, not the size they were shot.
- **Avoid needless re-renders.** `React.memo` on list rows, stable callbacks
  (`useCallback`), memoised values, and narrow state selectors so a change updates
  only what changed.
- **Keep animation on the UI thread.** Reanimated worklets or `useNativeDriver:
  true`; animate `transform`/`opacity`, never layout props.
- **Reserve space for anything that loads late.** Skeletons or fixed-size
  placeholders so the layout does not jump when data, images or ads arrive.
- **Enable Hermes** and ship it.

## Cold start

The launch path is design-critical — it is the first thing every user
experiences, every time.

- Do the **minimum** before the first screen. Defer non-critical init (analytics,
  feature flags, prefetch) until after first paint.
- **Lazy-load heavy screens and libraries** — route-based code splitting
  (expo-router lazy screens, `React.lazy`/dynamic import) so a rarely-used screen
  is not parsed at launch.
- Hold the splash (`expo-splash-screen`) only until the first meaningful screen is
  ready — never as a fixed-length animation or to cover busywork. A blocking
  splash or a full-screen spinner as the default first experience is a banned
  pattern.

## Images and assets

- `expo-image` over the core `Image` for anything non-trivial — caching,
  transitions and blurhash placeholders are built in.
- Provide a `placeholder` (blurhash/thumbhash) so a cell is never blank while the
  full image decodes.
- In lists, set `recyclingKey` and appropriate `priority` so off-screen images do
  not compete with visible ones.

## Over-the-air updates

If you ship JS updates with **expo-updates / EAS Update**, the update download is
your JS bundle plus changed assets — keep it small:

- Big, static media belongs **in the binary**, not re-downloaded on every update.
- Watch bundle growth; a heavy dependency added for one screen inflates both cold
  start and every OTA.
- Large binary/native changes require a new store build anyway — OTA is for JS and
  small assets, not a way around a real release (verify current policy).

## Measuring

- **Perf Monitor** (dev menu) shows JS **and** UI frame rates live — watch both;
  a healthy UI FPS with a starved JS FPS still janks.
- **Hermes sampling profiler** / **React DevTools Profiler** for JS-thread hot
  spots and wasted re-renders.
- **Xcode Instruments** and **Android Studio Profiler** for native CPU, memory and
  startup; **EAS Build** reports app size.
- Field data: **Android Vitals**, **Firebase Performance**, or an APM
  (Sentry/Datadog) — a fast dev device says little about a mid-range phone in the
  field. (verify current tooling)

Lab numbers are a proxy. The metric that counts is a real, mid-range device on a
real network.
