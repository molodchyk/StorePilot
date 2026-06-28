# Localized Screenshot Run Analysis: localized-screenshots-1782649023474-0wop77

Raw log: `storepilot-localized-screenshot-log-localized-screenshots-1782649023474-0wop77.json`

Run summary from StorePilot:

- Mode: `replace`
- Workers: 2
- Reported duration: 27m 09s
- Reported result: 66/66 locales completed, 198/198 screenshots uploaded, 0 failed
- Action log events: 404 total, 202 upload attempts and 202 upload results
- Logged upload outcomes: 198 `added`, 4 `unchanged`
- No delete events were logged in this run, so this artifact only supports upload timing analysis.

## Refreshed CWS Mismatches

Manual inspection after the run found locales where the refreshed Chrome Web Store state did not match the logged page-side success state:

| Locale | Refreshed CWS state | Logged state |
| --- | --- | --- |
| `hy` | screenshots 1 and 2 present; screenshot 3 missing | slot 3 eventually logged `added` after one `unchanged` retry |
| `nl` | only screenshot 2 present | slots 1, 2, and 3 all logged `added` |
| `mk` | screenshots 2 and 3 present; screenshot 1 missing | slots 1, 2, and 3 all logged `added` |
| `sr` | screenshots 1 and 2 present; screenshot 3 missing | slots 1, 2, and 3 all logged `added` |

Conclusion: a visible count increase in the same CWS page is not a durable proof that the screenshot persisted. CWS can show an optimistic/local UI state that later disappears after refresh or locale revisit.

## Timing Around Missing Slots

For every manually observed missing slot, another worker performed an upload action during the same upload window:

| Locale | Missing slot | Logged added result | Other worker activity during that upload |
| --- | ---: | --- | --- |
| `hy` | 3 | `12:41:03.359`, duration 5584ms | `th` slot 1 result at `12:41:01.215`; `th` slot 2 attempt at `12:41:01.421` |
| `nl` | 1 | `12:24:06.453`, duration 37635ms | `de` slot 1 attempt at `12:23:30.863`; `de` slot 1 result at `12:24:03.936`; `de` slot 2 attempt at `12:24:04.300` |
| `nl` | 3 | `12:24:17.689`, duration 4211ms | `de` slot 2 result at `12:24:14.066`; `de` slot 3 attempt at `12:24:14.266` |
| `mk` | 1 | `12:20:44.982`, duration 6409ms | `bg` slot 2 result at `12:20:39.173`; `bg` slot 3 attempt at `12:20:39.352` |
| `sr` | 3 | `12:37:52.039`, duration 5898ms | `he` slot 1 attempt at `12:37:49.388` |

Observed missing slots compared with the rest of logged `added` uploads:

- Missing-observed slots had nearest other-worker upload attempts within 779ms-3247ms, median 1215ms.
- The rest of logged `added` uploads had nearest other-worker upload attempts with median 2935ms.
- Missing-observed slots had nearest other-worker upload results within 1366ms-4703ms, median 2363ms.
- The rest of logged `added` uploads had nearest other-worker upload results with median 3730ms.

This supports the timing/race hypothesis, but does not prove it by itself because many unverified logged successes also had nearby other-worker activity.

## Additional Timing Signal

The same worker often starts the next screenshot upload almost immediately after an `added` result, typically around 160-200ms later. Examples:

- `mk` slot 1 result at `12:20:44.982`; slot 2 attempt at `12:20:45.145`.
- `nl` slot 1 result at `12:24:06.453`; slot 2 attempt at `12:24:06.641`.
- `sr` slot 1 result at `12:37:40.268`; slot 2 attempt at `12:37:40.429`.
- `hy` slot 2 result at `12:40:42.526`; slot 3 attempt at `12:40:42.702`.

So the likely risky surface is broader than cross-worker concurrency: CWS may need a quiet period after each mutating media action before the next delete/upload action, even in the same tab.

## Recommended Next Changes

1. Add durable verification:
   - After a locale appears complete, wait for CWS processing to settle, switch away and back or reload/reselect the locale, then recount localized screenshots.
   - Mark the locale failed if the refreshed count differs from the expected count.

2. Add a coordinator-controlled mutating action gate:
   - Workers may navigate and select locales independently.
   - Before any delete or upload attempt, a worker asks the background coordinator for an upload/delete token.
   - The coordinator allows only one CWS media mutation at a time for the listing.
   - Start conservatively with a cooldown after each mutation result, e.g. 5 seconds, then reduce based on evidence.

3. Improve repair workflow:
   - Store failed or verification-mismatched locales in the parent run.
   - Retry failed locales with the same delete-then-upload semantics.
   - Keep the downloadable log so timing can be compared against refreshed CWS state again.
