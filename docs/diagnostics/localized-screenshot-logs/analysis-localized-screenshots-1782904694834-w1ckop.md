# Localized Screenshot Timing Risk Report: localized-screenshots-1782904694834-w1ckop
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782904694834-w1ckop.json`
Observed state: not supplied
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | aborting |
| Mode | clearThenUpload |
| Elapsed | 6m 48s |
| Workers | 6 |
| Action events | 110 |
| Attempts | 21 |
| Results | 21 |
| Result outcomes | delete:removed=20, delete:unchanged=1 |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 109 count, min 3ms, median 750ms, p90 4152ms, max 120047ms, avg 3555ms |
| Adjacent attempts only | 20 count, min 3259ms, median 7145ms, p90 71446ms, max 124165ms, avg 19055ms |
| Adjacent results only | 20 count, min 888ms, median 4453ms, p90 18692ms, max 180426ms, avg 19029ms |
| Cross-worker adjacent action events | 59 count, min 40ms, median 765ms, p90 4582ms, max 51887ms, avg 2516ms |
| Same-worker adjacent action events | 50 count, min 3ms, median 13ms, p90 3615ms, max 120047ms, avg 4781ms |

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
| 1 | 3 | yes | 11:18:59.625 worker-1 es delete:result slot 2 removed 15108ms | 11:18:59.628 worker-1 es delete:gate-release slot 2 removed 15108ms |
| 2 | 3 | yes | 11:19:07.929 worker-4 ro delete:result slot 3 removed 6814ms | 11:19:07.932 worker-4 ro delete:gate-release slot 3 removed 6814ms |
| 3 | 3 | yes | 11:19:11.823 worker-3 id delete:result slot 3 removed 3121ms | 11:19:11.826 worker-3 id delete:gate-release slot 3 removed 3121ms |
| 4 | 3 | yes | 11:19:15.600 worker-6 ur delete:result slot 3 removed 3014ms | 11:19:15.603 worker-6 ur delete:gate-release slot 3 removed 3014ms |
| 5 | 3 | yes | 11:19:26.334 worker-4 ro delete:result slot 2 removed 2825ms | 11:19:26.337 worker-4 ro delete:gate-release slot 2 removed 2825ms |
| 6 | 3 | yes | 11:19:36.407 worker-4 ro delete:result slot 1 removed 2471ms | 11:19:36.410 worker-4 ro delete:gate-release slot 1 removed 2471ms |
| 7 | 3 | yes | 11:21:02.160 worker-5 th delete:result slot 2 removed 75317ms | 11:21:02.163 worker-5 th delete:gate-release slot 2 removed 75317ms |
| 8 | 3 | yes | 11:21:09.766 worker-3 id delete:result slot 1 removed 6835ms | 11:21:09.769 worker-3 id delete:gate-release slot 1 removed 6835ms |
| 9 | 3 | yes | 11:21:28.515 worker-1 es_419 delete:result slot 3 removed 2548ms | 11:21:28.518 worker-1 es_419 delete:gate-release slot 3 removed 2548ms |
| 10 | 4 | yes | 11:19:19.229 worker-1 es delete:result slot 1 removed 2865ms | 11:19:19.233 worker-1 es delete:gate-release slot 1 removed 2865ms |
| 11 | 4 | yes | 11:19:33.164 worker-6 ur delete:result slot 2 removed 2723ms | 11:19:33.168 worker-6 ur delete:gate-release slot 2 removed 2723ms |
| 12 | 4 | yes | 11:21:24.062 worker-4 sk delete:result slot 3 removed 2584ms | 11:21:24.066 worker-4 sk delete:gate-release slot 3 removed 2584ms |
| 13 | 5 | yes | 11:18:41.092 worker-1 es delete:result slot 3 removed 4152ms | 11:18:41.097 worker-1 es delete:gate-release slot 3 removed 4152ms |
| 14 | 5 | yes | 11:19:08.697 worker-3 id delete:gate-grant slot 3 | 11:19:08.702 worker-3 id delete:attempt slot 3 |
| 15 | 5 | yes | 11:19:27.086 worker-3 id delete:gate-grant slot 2 | 11:19:27.091 worker-3 id delete:attempt slot 2 |
| 16 | 5 | yes | 11:25:01.664 worker-3 it delete:result slot 3 unchanged 3615ms | 11:25:01.669 worker-3 it delete:gate-release slot 3 unchanged 3615ms |
| 17 | 6 | yes | 11:19:16.358 worker-1 es delete:gate-grant slot 1 | 11:19:16.364 worker-1 es delete:attempt slot 1 |
| 18 | 6 | yes | 11:21:20.693 worker-5 th delete:result slot 1 removed 2474ms | 11:21:20.699 worker-5 th delete:gate-release slot 1 removed 2474ms |
| 19 | 6 | yes | 11:21:33.509 worker-4 sk delete:result slot 2 removed 2726ms | 11:21:33.515 worker-4 sk delete:gate-release slot 2 removed 2726ms |
| 20 | 8 | yes | 11:19:33.928 worker-4 ro delete:gate-grant slot 1 | 11:19:33.936 worker-4 ro delete:attempt slot 1 |
| 21 | 8 | yes | 11:21:02.923 worker-3 id delete:gate-grant slot 1 | 11:21:02.931 worker-3 id delete:attempt slot 1 |
| 22 | 9 | yes | 11:21:41.658 worker-1 es_419 delete:result slot 2 removed 6412ms | 11:21:41.667 worker-1 es_419 delete:gate-release slot 2 removed 6412ms |
| 23 | 9 | yes | 11:21:42.429 worker-4 sk delete:gate-grant slot 1 | 11:21:42.438 worker-4 sk delete:attempt slot 1 |
| 24 | 10 | yes | 11:19:12.576 worker-6 ur delete:gate-grant slot 3 | 11:19:12.586 worker-6 ur delete:attempt slot 3 |
| 25 | 13 | yes | 11:19:30.428 worker-6 ur delete:gate-grant slot 2 | 11:19:30.441 worker-6 ur delete:attempt slot 2 |
| 26 | 13 | yes | 11:21:13.152 worker-6 ur delete:result slot 1 removed 2617ms | 11:21:13.165 worker-6 ur delete:gate-release slot 1 removed 2617ms |
| 27 | 14 | yes | 11:21:21.464 worker-4 sk delete:gate-grant slot 3 | 11:21:21.478 worker-4 sk delete:attempt slot 3 |
| 28 | 15 | yes | 11:21:10.520 worker-6 ur delete:gate-grant slot 1 | 11:21:10.535 worker-6 ur delete:attempt slot 1 |
| 29 | 36 | yes | 11:18:36.904 worker-1 es delete:gate-grant slot 3 | 11:18:36.940 worker-1 es delete:attempt slot 3 |
| 30 | 40 | no | 11:24:43.282 worker-3 it delete:gate-grant slot 3 | 11:24:43.322 worker-4 sk delete:gate-release-stale slot 1 removed 180534ms |
| 31 | 42 | yes | 11:18:44.475 worker-1 es delete:gate-grant slot 2 | 11:18:44.517 worker-1 es delete:attempt slot 2 |
| 32 | 42 | no | 11:19:29.500 worker-4 ro delete:gate-request slot 1 | 11:19:29.542 worker-3 id delete:result slot 2 removed 2451ms |
| 33 | 115 | yes | 11:23:46.488 worker-2 hr delete:gate-grant slot 3 | 11:23:46.603 worker-2 hr delete:attempt slot 3 |
| 34 | 121 | yes | 11:19:29.542 worker-3 id delete:result slot 2 removed 2451ms | 11:19:29.663 worker-3 id delete:gate-release slot 2 removed 2451ms |
| 35 | 163 | yes | 11:24:42.084 worker-2 hr delete:result slot 3 removed 55484ms | 11:24:42.247 worker-2 hr delete:gate-release slot 3 removed 55484ms |
| 36 | 181 | no | 11:21:18.219 worker-5 th delete:attempt slot 1 | 11:21:18.400 worker-1 es_419 delete:gate-request slot 3 |
| 37 | 187 | no | 11:19:30.441 worker-6 ur delete:attempt slot 2 | 11:19:30.628 worker-5 th delete:gate-request slot 2 |
| 38 | 196 | yes | 11:19:00.919 worker-4 ro delete:gate-grant slot 3 | 11:19:01.115 worker-4 ro delete:attempt slot 3 |
| 39 | 200 | no | 11:21:25.967 worker-1 es_419 delete:attempt slot 3 | 11:21:26.167 worker-4 sk delete:gate-request slot 2 |
| 40 | 211 | no | 11:21:35.246 worker-1 es_419 delete:attempt slot 2 | 11:21:35.457 worker-4 sk delete:gate-request slot 1 |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

| Rank | Score | Locale | Slot | Worker | Outcome | Attempt time | Result time | Duration ms | Visible | Min any gap ms | Min other-worker gap ms | Other events during window | Same-worker next attempt gap ms | Observed missing | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 18 | sk | 1 | worker-4 | removed | 11:21:42.438 | 11:24:42.972 | 180534 | 1->0 | 9 | 888 | 7 |  | no |  |
| 2 | 18 | hr | 3 | worker-2 | removed | 11:23:46.603 | 11:24:42.084 | 55484 | 3->2 | 115 | 888 | 2 |  | no |  |
| 3 | 12 | id | 3 | worker-3 | removed | 11:19:08.702 | 11:19:11.823 | 3121 | 3->2 | 5 | 3777 | 1 | 15268 | no |  |
| 4 | 12 | id | 2 | worker-3 | removed | 11:19:27.091 | 11:19:29.542 | 2451 | 2->1 | 5 | 3208 | 1 | 93389 | no |  |
| 5 | 12 | es | 1 | worker-1 | removed | 11:19:16.364 | 11:19:19.229 | 2865 | 1->0 | 6 | 3629 | 1 | 126738 | no |  |
| 6 | 12 | ro | 1 | worker-4 | removed | 11:19:33.936 | 11:19:36.407 | 2471 | 1->0 | 8 | 3243 | 0 | 105071 | no |  |
| 7 | 12 | id | 1 | worker-3 | removed | 11:21:02.931 | 11:21:09.766 | 6835 | 1->0 | 8 | 3386 | 1 | 228283 | no |  |
| 8 | 12 | ur | 3 | worker-6 | removed | 11:19:12.586 | 11:19:15.600 | 3014 | 3->2 | 10 | 3629 | 1 | 14841 | no |  |
| 9 | 12 | ur | 2 | worker-6 | removed | 11:19:30.441 | 11:19:33.164 | 2723 | 2->1 | 13 | 3243 | 2 | 97371 | no |  |
| 10 | 12 | sk | 3 | worker-4 | removed | 11:21:21.478 | 11:21:24.062 | 2584 | 3->2 | 14 | 3259 | 0 | 6721 | no |  |
| 11 | 12 | ur | 1 | worker-6 | removed | 11:21:10.535 | 11:21:13.152 | 2617 | 1->0 | 15 | 3386 | 1 |  | no |  |
| 12 | 12 | th | 1 | worker-5 | removed | 11:21:18.219 | 11:21:20.693 | 2474 | 1->0 | 181 | 3259 | 1 |  | no |  |
| 13 | 12 | ro | 3 | worker-4 | removed | 11:19:01.115 | 11:19:07.929 | 6814 | 3->2 | 196 | 3894 | 3 | 15580 | no |  |
| 14 | 12 | es_419 | 3 | worker-1 | removed | 11:21:25.967 | 11:21:28.515 | 2548 | 3->2 | 200 | 4453 | 1 | 6731 | no |  |
| 15 | 12 | es_419 | 2 | worker-1 | removed | 11:21:35.246 | 11:21:41.658 | 6412 | 2->1 | 211 | 4463 | 2 |  | no |  |
| 16 | 12 | sk | 2 | worker-4 | removed | 11:21:30.783 | 11:21:33.509 | 2726 | 2->1 | 486 | 4463 | 1 | 8929 | no |  |
| 17 | 10 | es | 3 | worker-1 | removed | 11:18:36.940 | 11:18:41.092 | 4152 | 3->2 | 36 | 24175 | 0 | 3425 | no |  |
| 18 | 10 | es | 2 | worker-1 | removed | 11:18:44.517 | 11:18:59.625 | 15108 | 2->1 | 42 | 8304 | 1 | 16739 | no |  |
| 19 | 10 | it | 3 | worker-3 | unchanged | 11:24:58.049 | 11:25:01.664 | 3615 | 3->3 | 3615 | 18692 | 0 |  | no |  |
| 20 | 8 | ro | 2 | worker-4 | removed | 11:19:23.509 | 11:19:26.334 | 2825 | 2->1 | 2825 | 3208 | 0 | 7602 | no |  |
| 21 | 0 | th | 2 | worker-5 | removed | 11:19:46.843 | 11:21:02.160 | 75317 | 2->1 | 9683 | 7606 | 0 | 16059 | no |  |

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
