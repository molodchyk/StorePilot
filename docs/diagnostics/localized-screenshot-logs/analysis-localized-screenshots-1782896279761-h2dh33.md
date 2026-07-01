# Localized Screenshot Timing Risk Report: localized-screenshots-1782896279761-h2dh33
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782896279761-h2dh33.json`
Observed state: not supplied
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | aborting |
| Mode | clearThenUpload |
| Elapsed | 1m 14s |
| Workers | 6 |
| Action events | 30 |
| Attempts | 5 |
| Results | 5 |
| Result outcomes | delete:removed=5 |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 29 count, min 2ms, median 1756ms, p90 3816ms, max 10259ms, avg 1815ms |
| Adjacent attempts only | 4 count, min 4841ms, median 4947ms, p90 18355ms, max 18355ms, avg 9514ms |
| Adjacent results only | 4 count, min 4541ms, median 6455ms, p90 17837ms, max 17837ms, avg 9173ms |
| Cross-worker adjacent action events | 17 count, min 112ms, median 1840ms, p90 6155ms, max 10259ms, avg 2386ms |
| Same-worker adjacent action events | 12 count, min 2ms, median 14ms, p90 3132ms, max 3816ms, avg 1006ms |

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
| 1 | 2 | yes | 08:58:56.167 worker-6 sw delete:result slot 1 removed 4340ms | 08:58:56.169 worker-6 sw delete:gate-release slot 1 removed 4340ms |
| 2 | 3 | yes | 08:58:49.712 worker-4 lt delete:result slot 3 removed 2726ms | 08:58:49.715 worker-4 lt delete:gate-release slot 3 removed 2726ms |
| 3 | 3 | yes | 08:59:14.004 worker-2 en_au delete:result slot 2 removed 12263ms | 08:59:14.007 worker-2 en_au delete:gate-release slot 2 removed 12263ms |
| 4 | 4 | yes | 08:58:23.680 worker-3 gu delete:gate-grant slot 2 | 08:58:23.684 worker-3 gu delete:attempt slot 2 |
| 5 | 4 | yes | 08:58:45.171 worker-5 pl delete:result slot 2 removed 3132ms | 08:58:45.175 worker-5 pl delete:gate-release slot 2 removed 3132ms |
| 6 | 14 | yes | 08:58:46.972 worker-4 lt delete:gate-grant slot 3 | 08:58:46.986 worker-4 lt delete:attempt slot 3 |
| 7 | 23 | yes | 08:58:51.804 worker-6 sw delete:gate-grant slot 1 | 08:58:51.827 worker-6 sw delete:attempt slot 1 |
| 8 | 31 | yes | 08:58:37.314 worker-3 gu delete:result slot 2 removed 13630ms | 08:58:37.345 worker-3 gu delete:gate-release slot 2 removed 13630ms |
| 9 | 112 | no | 08:58:35.362 worker-6 sw delete:gate-request slot 1 | 08:58:35.474 worker-2 en_au delete:gate-request slot 2 |
| 10 | 167 | no | 08:58:49.715 worker-4 lt delete:gate-release slot 3 removed 2726ms | 08:58:49.882 worker-5 pl delete:gate-request slot 1 |
| 11 | 660 | no | 08:58:40.374 worker-1 am delete:gate-request slot 2 | 08:58:41.034 worker-3 gu delete:gate-request slot 1 |
| 12 | 923 | no | 08:58:39.451 worker-5 pl delete:gate-grant slot 2 | 08:58:40.374 worker-1 am delete:gate-request slot 2 |
| 13 | 1005 | no | 08:58:41.034 worker-3 gu delete:gate-request slot 1 | 08:58:42.039 worker-5 pl delete:attempt slot 2 |
| 14 | 1378 | no | 08:58:54.789 worker-4 lt delete:gate-request slot 2 | 08:58:56.167 worker-6 sw delete:result slot 1 removed 4340ms |
| 15 | 1756 | no | 08:58:56.169 worker-6 sw delete:gate-release slot 1 removed 4340ms | 08:58:57.925 worker-2 en_au delete:gate-grant slot 2 |
| 16 | 1797 | no | 08:58:45.175 worker-5 pl delete:gate-release slot 2 removed 3132ms | 08:58:46.972 worker-4 lt delete:gate-grant slot 3 |
| 17 | 1840 | no | 08:58:35.474 worker-2 en_au delete:gate-request slot 2 | 08:58:37.314 worker-3 gu delete:result slot 2 removed 13630ms |
| 18 | 1922 | no | 08:58:49.882 worker-5 pl delete:gate-request slot 1 | 08:58:51.804 worker-6 sw delete:gate-grant slot 1 |
| 19 | 2004 | no | 08:59:12.000 worker-6 ta delete:gate-request slot 3 | 08:59:14.004 worker-2 en_au delete:result slot 2 removed 12263ms |
| 20 | 2106 | no | 08:58:37.345 worker-3 gu delete:gate-release slot 2 removed 13630ms | 08:58:39.451 worker-5 pl delete:gate-grant slot 2 |
| 21 | 2314 | yes | 08:58:21.366 worker-3 gu delete:gate-request slot 2 | 08:58:23.680 worker-3 gu delete:gate-grant slot 2 |
| 22 | 2641 | no | 08:58:29.839 worker-5 pl delete:gate-request slot 2 | 08:58:32.480 worker-4 lt delete:gate-request slot 3 |
| 23 | 2726 | yes | 08:58:46.986 worker-4 lt delete:attempt slot 3 | 08:58:49.712 worker-4 lt delete:result slot 3 removed 2726ms |
| 24 | 2882 | no | 08:58:32.480 worker-4 lt delete:gate-request slot 3 | 08:58:35.362 worker-6 sw delete:gate-request slot 1 |
| 25 | 2962 | no | 08:58:51.827 worker-6 sw delete:attempt slot 1 | 08:58:54.789 worker-4 lt delete:gate-request slot 2 |
| 26 | 3132 | yes | 08:58:42.039 worker-5 pl delete:attempt slot 2 | 08:58:45.171 worker-5 pl delete:result slot 2 removed 3132ms |
| 27 | 3816 | yes | 08:58:57.925 worker-2 en_au delete:gate-grant slot 2 | 08:59:01.741 worker-2 en_au delete:attempt slot 2 |
| 28 | 6155 | no | 08:58:23.684 worker-3 gu delete:attempt slot 2 | 08:58:29.839 worker-5 pl delete:gate-request slot 2 |
| 29 | 10259 | no | 08:59:01.741 worker-2 en_au delete:attempt slot 2 | 08:59:12.000 worker-6 ta delete:gate-request slot 3 |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

| Rank | Score | Locale | Slot | Worker | Outcome | Attempt time | Result time | Duration ms | Visible | Min any gap ms | Min other-worker gap ms | Other events during window | Same-worker next attempt gap ms | Observed missing | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 12 | lt | 3 | worker-4 | removed | 08:58:46.986 | 08:58:49.712 | 2726 | 3->2 | 14 | 4541 | 0 |  | no |  |
| 2 | 12 | sw | 1 | worker-6 | removed | 08:58:51.827 | 08:58:56.167 | 4340 | 1->0 | 23 | 4841 | 1 |  | no |  |
| 3 | 10 | gu | 2 | worker-3 | removed | 08:58:23.684 | 08:58:37.314 | 13630 | 2->1 | 4 | 7857 | 4 |  | no |  |
| 4 | 10 | pl | 2 | worker-5 | removed | 08:58:42.039 | 08:58:45.171 | 3132 | 2->1 | 1005 | 4541 | 0 |  | no |  |
| 5 | 4 | en_au | 2 | worker-2 | removed | 08:59:01.741 | 08:59:14.004 | 12263 | 2->1 | 3816 | 9914 | 1 |  | no |  |

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
