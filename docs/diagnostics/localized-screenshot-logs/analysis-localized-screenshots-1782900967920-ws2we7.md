# Localized Screenshot Timing Risk Report: localized-screenshots-1782900967920-ws2we7
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782900967920-ws2we7.json`
Observed state: not supplied
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | running |
| Mode | clearThenUpload |
| Elapsed | 45s |
| Workers | 6 |
| Action events | 4 |
| Attempts | 1 |
| Results | 0 |
| Result outcomes |  |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 3 count, min 7ms, median 1636ms, p90 3771ms, max 3771ms, avg 1805ms |
| Adjacent attempts only | 0 count |
| Adjacent results only | 0 count |
| Cross-worker adjacent action events | 1 count, min 3771ms, median 3771ms, p90 3771ms, max 3771ms, avg 3771ms |
| Same-worker adjacent action events | 2 count, min 7ms, median 7ms, p90 1636ms, max 1636ms, avg 822ms |

## Algorithm

1. Parse `actionLog` and keep events that have `epochMs`, `action`, and `stage`.
2. Sort events by `epochMs`, then `sequence`, then original index.
3. Build adjacent action pairs and calculate `gapMs = current.epochMs - previous.epochMs`.
4. For every result event, locate the matching attempt by worker, locale, action, attempt number, and screenshot/target slot.
5. For that attempt-result window, calculate:
   - closest previous/next action gap around the attempt;
   - closest previous/next other-worker attempt gap;
   - closest previous/next other-worker result gap;
   - count of other-worker events that occurred between attempt and result;
   - gap from this result to the same worker's next attempt.
6. If observed refreshed-state data is supplied, build a per-slot persistence table with global previous/next attempts, global previous/next results, immediate previous/next action events, and other-worker actions inside each upload window.
7. Mark logged added slots missing when the refreshed CWS state does not contain that slot.
8. Rank result events with a risk score. The biggest weights are observed missing slots, sub-second or sub-three-second gaps, other-worker overlap, immediate same-worker next attempts, and explicit CWS errors.

## Closest Adjacent Action Events

These are the tightest gaps between consecutive logged CWS media action events. They are the primary candidates for server-side timing pressure.

| Rank | Gap ms | Same worker | Previous | Current |
| --- | --- | --- | --- | --- |
| 1 | 7 | yes | 10:16:44.248 worker-1 ar delete:gate-grant slot 3 | 10:16:44.255 worker-1 ar delete:attempt slot 3 |
| 2 | 1636 | yes | 10:16:42.612 worker-1 ar delete:gate-request slot 3 | 10:16:44.248 worker-1 ar delete:gate-grant slot 3 |
| 3 | 3771 | no | 10:16:44.255 worker-1 ar delete:attempt slot 3 | 10:16:48.026 worker-3 hi delete:gate-request slot 2 |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

_No rows._

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
