# Localized Screenshot Timing Risk Report: localized-screenshots-1782893088093-isnqji
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782893088093-isnqji-late.json`
Observed state: not supplied
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | running |
| Mode | clearThenUpload |
| Elapsed | 2m 31s |
| Workers | 6 |
| Action events | 51 |
| Attempts | 9 |
| Results | 9 |
| Result outcomes | delete:removed=9 |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 50 count, min 3ms, median 1273ms, p90 3874ms, max 27894ms, avg 2540ms |
| Adjacent attempts only | 8 count, min 6181ms, median 7469ms, p90 20702ms, max 20702ms, avg 10695ms |
| Adjacent results only | 8 count, min 5621ms, median 7039ms, p90 20384ms, max 20384ms, avg 10883ms |
| Cross-worker adjacent action events | 29 count, min 6ms, median 2290ms, p90 9112ms, max 27894ms, avg 3614ms |
| Same-worker adjacent action events | 21 count, min 3ms, median 156ms, p90 3491ms, max 3597ms, avg 1057ms |

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
| 1 | 3 | yes | 08:05:40.923 worker-3 gu delete:result slot 3 removed 3221ms | 08:05:40.926 worker-3 gu delete:gate-release slot 3 removed 3221ms |
| 2 | 3 | yes | 08:05:47.374 worker-4 ko delete:result slot 2 removed 3491ms | 08:05:47.377 worker-4 ko delete:gate-release slot 2 removed 3491ms |
| 3 | 3 | yes | 08:06:24.915 worker-6 sw delete:result slot 2 removed 3588ms | 08:06:24.918 worker-6 sw delete:gate-release slot 2 removed 3588ms |
| 4 | 6 | no | 08:05:16.833 worker-3 gu delete:gate-request slot 3 | 08:05:16.839 worker-6 sw delete:gate-grant slot 3 |
| 5 | 6 | yes | 08:06:10.895 worker-5 pl delete:result slot 3 removed 10270ms | 08:06:10.901 worker-5 pl delete:gate-release slot 3 removed 10270ms |
| 6 | 9 | yes | 08:06:35.777 worker-2 en_au delete:result slot 3 removed 5068ms | 08:06:35.786 worker-2 en_au delete:gate-release slot 3 removed 5068ms |
| 7 | 9 | yes | 08:06:41.398 worker-4 ko delete:result slot 1 removed 3220ms | 08:06:41.407 worker-4 ko delete:gate-release slot 1 removed 3220ms |
| 8 | 11 | no | 08:05:55.075 worker-1 am delete:gate-release slot 3 removed 4056ms | 08:05:55.086 worker-3 gu delete:gate-request slot 2 |
| 9 | 19 | yes | 08:05:12.600 worker-4 ko delete:gate-grant slot 3 | 08:05:12.619 worker-4 ko delete:attempt slot 3 |
| 10 | 20 | yes | 08:05:14.335 worker-4 ko delete:result slot 3 removed 1716ms | 08:05:14.355 worker-4 ko delete:gate-release slot 3 removed 1716ms |
| 11 | 70 | yes | 08:05:43.813 worker-4 ko delete:gate-grant slot 2 | 08:05:43.883 worker-4 ko delete:attempt slot 2 |
| 12 | 102 | yes | 08:06:38.076 worker-4 ko delete:gate-grant slot 1 | 08:06:38.178 worker-4 ko delete:attempt slot 1 |
| 13 | 156 | yes | 08:05:37.546 worker-3 gu delete:gate-grant slot 3 | 08:05:37.702 worker-3 gu delete:attempt slot 3 |
| 14 | 158 | no | 08:05:50.357 worker-1 am delete:attempt slot 3 | 08:05:50.515 worker-2 en_au delete:gate-request slot 3 |
| 15 | 190 | yes | 08:05:34.719 worker-6 sw delete:result slot 3 removed 3201ms | 08:05:34.909 worker-6 sw delete:gate-release slot 3 removed 3201ms |
| 16 | 239 | no | 08:05:54.174 worker-4 ko delete:gate-request slot 1 | 08:05:54.413 worker-1 am delete:result slot 3 removed 4056ms |
| 17 | 492 | yes | 08:05:49.865 worker-1 am delete:gate-grant slot 3 | 08:05:50.357 worker-1 am delete:attempt slot 3 |
| 18 | 662 | yes | 08:05:54.413 worker-1 am delete:result slot 3 removed 4056ms | 08:05:55.075 worker-1 am delete:gate-release slot 3 removed 4056ms |
| 19 | 848 | no | 08:05:12.619 worker-4 ko delete:attempt slot 3 | 08:05:13.467 worker-6 sw delete:gate-request slot 3 |
| 20 | 868 | no | 08:05:13.467 worker-6 sw delete:gate-request slot 3 | 08:05:14.335 worker-4 ko delete:result slot 3 removed 1716ms |
| 21 | 880 | no | 08:05:20.143 worker-4 ko delete:gate-request slot 2 | 08:05:21.023 worker-1 am delete:gate-request slot 3 |
| 22 | 1077 | no | 08:05:40.926 worker-3 gu delete:gate-release slot 3 removed 3221ms | 08:05:42.003 worker-6 sw delete:gate-request slot 2 |
| 23 | 1083 | no | 08:05:33.636 worker-5 pl delete:gate-request slot 3 | 08:05:34.719 worker-6 sw delete:result slot 3 removed 3201ms |
| 24 | 1174 | yes | 08:05:11.426 worker-4 ko delete:gate-request slot 3 | 08:05:12.600 worker-4 ko delete:gate-grant slot 3 |
| 25 | 1273 | no | 08:06:00.625 worker-5 pl delete:attempt slot 3 | 08:06:01.898 worker-1 am delete:gate-request slot 2 |
| 26 | 1810 | no | 08:05:42.003 worker-6 sw delete:gate-request slot 2 | 08:05:43.813 worker-4 ko delete:gate-grant slot 2 |
| 27 | 2118 | no | 08:05:31.518 worker-6 sw delete:attempt slot 3 | 08:05:33.636 worker-5 pl delete:gate-request slot 3 |
| 28 | 2156 | yes | 08:05:58.469 worker-5 pl delete:gate-grant slot 3 | 08:06:00.625 worker-5 pl delete:attempt slot 3 |
| 29 | 2194 | no | 08:06:24.918 worker-6 sw delete:gate-release slot 2 removed 3588ms | 08:06:27.112 worker-2 en_au delete:gate-grant slot 3 |
| 30 | 2213 | no | 08:06:19.114 worker-5 pl delete:gate-request slot 2 | 08:06:21.327 worker-6 sw delete:attempt slot 2 |
| 31 | 2290 | no | 08:06:35.786 worker-2 en_au delete:gate-release slot 3 removed 5068ms | 08:06:38.076 worker-4 ko delete:gate-grant slot 1 |
| 32 | 2402 | no | 08:06:30.709 worker-2 en_au delete:attempt slot 3 | 08:06:33.111 worker-6 sw delete:gate-request slot 1 |
| 33 | 2478 | no | 08:05:14.355 worker-4 ko delete:gate-release slot 3 removed 1716ms | 08:05:16.833 worker-3 gu delete:gate-request slot 3 |
| 34 | 2488 | no | 08:05:47.377 worker-4 ko delete:gate-release slot 2 removed 3491ms | 08:05:49.865 worker-1 am delete:gate-grant slot 3 |
| 35 | 2637 | no | 08:05:34.909 worker-6 sw delete:gate-release slot 3 removed 3201ms | 08:05:37.546 worker-3 gu delete:gate-grant slot 3 |
| 36 | 2666 | no | 08:06:33.111 worker-6 sw delete:gate-request slot 1 | 08:06:35.777 worker-2 en_au delete:result slot 3 removed 5068ms |
| 37 | 3220 | yes | 08:06:38.178 worker-4 ko delete:attempt slot 1 | 08:06:41.398 worker-4 ko delete:result slot 1 removed 3220ms |
| 38 | 3221 | yes | 08:05:37.702 worker-3 gu delete:attempt slot 3 | 08:05:40.923 worker-3 gu delete:result slot 3 removed 3221ms |
| 39 | 3304 | no | 08:05:16.839 worker-6 sw delete:gate-grant slot 3 | 08:05:20.143 worker-4 ko delete:gate-request slot 2 |
| 40 | 3383 | no | 08:05:55.086 worker-3 gu delete:gate-request slot 2 | 08:05:58.469 worker-5 pl delete:gate-grant slot 3 |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

| Rank | Score | Locale | Slot | Worker | Outcome | Attempt time | Result time | Duration ms | Visible | Min any gap ms | Min other-worker gap ms | Other events during window | Same-worker next attempt gap ms | Observed missing | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | ko | 3 | worker-4 | removed | 08:05:12.619 | 08:05:14.335 | 1716 | 3->2 | 19 | 18899 | 1 | 29548 | no |  |
| 2 | 10 | ko | 2 | worker-4 | removed | 08:05:43.883 | 08:05:47.374 | 3491 | 2->1 | 70 | 6181 | 0 | 50804 | no |  |
| 3 | 10 | ko | 1 | worker-4 | removed | 08:06:38.178 | 08:06:41.398 | 3220 | 1->0 | 102 | 5621 | 0 |  | no |  |
| 4 | 10 | gu | 3 | worker-3 | removed | 08:05:37.702 | 08:05:40.923 | 3221 | 3->2 | 156 | 6181 | 0 |  | no |  |
| 5 | 10 | am | 3 | worker-1 | removed | 08:05:50.357 | 08:05:54.413 | 4056 | 3->2 | 158 | 6474 | 2 |  | no |  |
| 6 | 8 | pl | 3 | worker-5 | removed | 08:06:00.625 | 08:06:10.895 | 10270 | 3->2 | 1273 | 10268 | 1 |  | no |  |
| 7 | 6 | sw | 3 | worker-6 | removed | 08:05:31.518 | 08:05:34.719 | 3201 | 3->2 | 2118 | 6184 | 1 | 46608 | no |  |
| 8 | 6 | sw | 2 | worker-6 | removed | 08:06:21.327 | 08:06:24.915 | 3588 | 2->1 | 2213 | 9382 | 0 |  | no |  |
| 9 | 6 | en_au | 3 | worker-2 | removed | 08:06:30.709 | 08:06:35.777 | 5068 | 3->2 | 2402 | 5621 | 1 |  | no |  |

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
