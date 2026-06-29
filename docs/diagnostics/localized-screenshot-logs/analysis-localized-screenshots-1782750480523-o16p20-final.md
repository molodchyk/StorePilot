# Localized Screenshot Timing Risk Report: localized-screenshots-1782750480523-o16p20
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782750480523-o16p20-final.json`
Observed state: not supplied
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | completed |
| Mode | replace |
| Elapsed | 49m 44s |
| Workers | 2 |
| Action events | 2068 |
| Attempts | 400 |
| Results | 466 |
| Result outcomes | audit:matched=66, delete:removed=197, delete:unchanged=4, upload:added=198, upload:unchanged=1 |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 2067 count, min 0ms, median 376ms, p90 3065ms, max 256402ms, avg 1434ms |
| Adjacent attempts only | 399 count, min 1817ms, median 4368ms, p90 6891ms, max 383458ms, avg 6470ms |
| Adjacent results only | 465 count, min 445ms, median 4243ms, p90 7093ms, max 501280ms, avg 6369ms |
| Cross-worker adjacent action events | 767 count, min 0ms, median 806ms, p90 3479ms, max 256402ms, avg 2377ms |
| Same-worker adjacent action events | 1300 count, min 1ms, median 6ms, p90 2554ms, max 120049ms, avg 878ms |

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
| 1 | 0 | no | 16:48:57.285 worker-1 fi upload:gate-request slot 3 | 16:48:57.285 worker-2 sr upload:gate-grant slot 2 |
| 2 | 1 | yes | 16:29:36.281 worker-2 ko delete:result slot 1 removed 2628ms | 16:29:36.282 worker-2 ko delete:gate-release slot 1 removed 2628ms |
| 3 | 1 | yes | 16:30:31.583 worker-1 ar delete:result slot 3 removed 2525ms | 16:30:31.584 worker-1 ar delete:gate-release slot 3 removed 2525ms |
| 4 | 1 | yes | 16:35:34.520 worker-1 cs delete:result slot 3 removed 2515ms | 16:35:34.521 worker-1 cs delete:gate-release slot 3 removed 2515ms |
| 5 | 1 | yes | 16:35:42.426 worker-1 cs delete:result slot 2 removed 2500ms | 16:35:42.427 worker-1 cs delete:gate-release slot 2 removed 2500ms |
| 6 | 1 | yes | 16:38:10.052 worker-2 no delete:result slot 3 removed 2448ms | 16:38:10.053 worker-2 no delete:gate-release slot 3 removed 2448ms |
| 7 | 1 | yes | 16:38:26.315 worker-2 no delete:result slot 1 removed 2406ms | 16:38:26.316 worker-2 no delete:gate-release slot 1 removed 2406ms |
| 8 | 1 | yes | 16:40:09.250 worker-2 pl delete:result slot 2 removed 2411ms | 16:40:09.251 worker-2 pl delete:gate-release slot 2 removed 2411ms |
| 9 | 1 | yes | 16:42:05.580 worker-1 en_gb delete:result slot 3 removed 2505ms | 16:42:05.581 worker-1 en_gb delete:gate-release slot 3 removed 2505ms |
| 10 | 1 | no | 17:08:45.927 worker-2 vi upload:gate-request slot 3 | 17:08:45.928 worker-1 it upload:gate-grant slot 3 |
| 11 | 2 | yes | 16:29:32.892 worker-1 am delete:result slot 3 removed 3058ms | 16:29:32.894 worker-1 am delete:gate-release slot 3 removed 3058ms |
| 12 | 2 | yes | 16:29:37.042 worker-1 am delete:gate-grant slot 2 | 16:29:37.044 worker-1 am delete:attempt slot 2 |
| 13 | 2 | yes | 16:29:42.259 worker-1 am delete:result slot 2 removed 5215ms | 16:29:42.261 worker-1 am delete:gate-release slot 2 removed 5215ms |
| 14 | 2 | yes | 16:29:50.486 worker-2 ko upload:result slot 1 added 11248ms | 16:29:50.488 worker-2 ko upload:gate-release slot 1 added 11248ms |
| 15 | 2 | yes | 16:30:34.854 worker-2 lt delete:result slot 1 removed 2514ms | 16:30:34.856 worker-2 lt delete:gate-release slot 1 removed 2514ms |
| 16 | 2 | yes | 16:30:57.529 worker-2 lt upload:gate-grant slot 3 | 16:30:57.531 worker-2 lt upload:attempt slot 3 |
| 17 | 2 | yes | 16:31:07.737 worker-1 ar upload:gate-grant slot 3 | 16:31:07.739 worker-1 ar upload:attempt slot 3 |
| 18 | 2 | yes | 16:31:21.766 worker-1 az delete:result slot 3 removed 2414ms | 16:31:21.768 worker-1 az delete:gate-release slot 3 removed 2414ms |
| 19 | 2 | yes | 16:31:25.552 worker-2 lv delete:result slot 1 removed 3015ms | 16:31:25.554 worker-2 lv delete:gate-release slot 1 removed 3015ms |
| 20 | 2 | yes | 16:31:28.832 worker-1 az delete:result slot 2 removed 2518ms | 16:31:28.834 worker-1 az delete:gate-release slot 2 removed 2518ms |
| 21 | 2 | yes | 16:31:37.114 worker-1 az delete:result slot 1 removed 2494ms | 16:31:37.116 worker-1 az delete:gate-release slot 1 removed 2494ms |
| 22 | 2 | yes | 16:32:29.428 worker-2 mk delete:result slot 3 removed 4425ms | 16:32:29.430 worker-2 mk delete:gate-release slot 3 removed 4425ms |
| 23 | 2 | yes | 16:32:40.717 worker-2 mk delete:result slot 2 unchanged 10058ms | 16:32:40.719 worker-2 mk delete:gate-release slot 2 unchanged 10058ms |
| 24 | 2 | yes | 16:32:47.257 worker-1 bg delete:result slot 3 removed 2531ms | 16:32:47.259 worker-1 bg delete:gate-release slot 3 removed 2531ms |
| 25 | 2 | yes | 16:32:49.153 worker-2 mk delete:result slot 2 removed 1051ms | 16:32:49.155 worker-2 mk delete:gate-release slot 2 removed 1051ms |
| 26 | 2 | yes | 16:33:04.646 worker-1 bg delete:result slot 1 removed 7129ms | 16:33:04.648 worker-1 bg delete:gate-release slot 1 removed 7129ms |
| 27 | 2 | yes | 16:33:44.253 worker-2 ml delete:gate-grant slot 3 | 16:33:44.255 worker-2 ml delete:attempt slot 3 |
| 28 | 2 | yes | 16:33:52.780 worker-1 bn delete:result slot 3 removed 2632ms | 16:33:52.782 worker-1 bn delete:gate-release slot 3 removed 2632ms |
| 29 | 2 | yes | 16:34:06.581 worker-1 bn delete:result slot 1 removed 2420ms | 16:34:06.583 worker-1 bn delete:gate-release slot 1 removed 2420ms |
| 30 | 2 | yes | 16:34:34.859 worker-2 mr delete:result slot 3 removed 2444ms | 16:34:34.861 worker-2 mr delete:gate-release slot 3 removed 2444ms |
| 31 | 2 | yes | 16:34:37.677 worker-2 mr delete:result slot 2 removed 1526ms | 16:34:37.679 worker-2 mr delete:gate-release slot 2 removed 1526ms |
| 32 | 2 | yes | 16:34:43.539 worker-1 ca delete:result slot 3 removed 2458ms | 16:34:43.541 worker-1 ca delete:gate-release slot 3 removed 2458ms |
| 33 | 2 | yes | 16:34:59.619 worker-1 ca delete:result slot 1 removed 2511ms | 16:34:59.621 worker-1 ca delete:gate-release slot 1 removed 2511ms |
| 34 | 2 | yes | 16:35:19.341 worker-2 ms delete:result slot 3 removed 2412ms | 16:35:19.343 worker-2 ms delete:gate-release slot 3 removed 2412ms |
| 35 | 2 | yes | 16:36:31.414 worker-1 da delete:result slot 2 removed 2434ms | 16:36:31.416 worker-1 da delete:gate-release slot 2 removed 2434ms |
| 36 | 2 | yes | 16:36:38.446 worker-1 da delete:result slot 1 removed 2503ms | 16:36:38.448 worker-1 da delete:gate-release slot 1 removed 2503ms |
| 37 | 2 | yes | 16:37:09.445 worker-2 nl delete:result slot 1 removed 1509ms | 16:37:09.447 worker-2 nl delete:gate-release slot 1 removed 1509ms |
| 38 | 2 | yes | 16:38:17.265 worker-2 no delete:result slot 2 removed 2415ms | 16:38:17.267 worker-2 no delete:gate-release slot 2 removed 2415ms |
| 39 | 2 | yes | 16:38:38.707 worker-1 el delete:result slot 3 removed 2427ms | 16:38:38.709 worker-1 el delete:gate-release slot 3 removed 2427ms |
| 40 | 2 | yes | 16:38:46.261 worker-1 el delete:result slot 2 removed 2410ms | 16:38:46.263 worker-1 el delete:gate-release slot 2 removed 2410ms |
| 41 | 2 | yes | 16:39:09.119 worker-2 pa delete:result slot 3 removed 2539ms | 16:39:09.121 worker-2 pa delete:gate-release slot 3 removed 2539ms |
| 42 | 2 | yes | 16:39:25.799 worker-2 pa delete:result slot 1 removed 2425ms | 16:39:25.801 worker-2 pa delete:gate-release slot 1 removed 2425ms |
| 43 | 2 | yes | 16:39:35.698 worker-1 en delete:result slot 3 removed 2432ms | 16:39:35.700 worker-1 en delete:gate-release slot 3 removed 2432ms |
| 44 | 2 | yes | 16:39:42.868 worker-1 en delete:result slot 2 removed 2510ms | 16:39:42.870 worker-1 en delete:gate-release slot 2 removed 2510ms |
| 45 | 2 | yes | 16:40:46.199 worker-1 en_au delete:result slot 1 removed 2618ms | 16:40:46.201 worker-1 en_au delete:gate-release slot 1 removed 2618ms |
| 46 | 2 | yes | 16:40:49.200 worker-1 en_au upload:gate-grant slot 1 | 16:40:49.202 worker-1 en_au upload:attempt slot 1 |
| 47 | 2 | yes | 16:41:47.004 worker-2 pt_br delete:result slot 1 removed 2522ms | 16:41:47.006 worker-2 pt_br delete:gate-release slot 1 removed 2522ms |
| 48 | 2 | yes | 16:42:14.800 worker-1 en_gb delete:result slot 2 removed 2408ms | 16:42:14.802 worker-1 en_gb delete:gate-release slot 2 removed 2408ms |
| 49 | 2 | yes | 16:42:21.096 worker-2 pt_pt delete:result slot 3 removed 2417ms | 16:42:21.098 worker-2 pt_pt delete:gate-release slot 3 removed 2417ms |
| 50 | 2 | yes | 16:43:02.451 worker-1 en_us delete:result slot 2 removed 2448ms | 16:43:02.453 worker-1 en_us delete:gate-release slot 2 removed 2448ms |
| 51 | 2 | yes | 16:43:09.545 worker-2 ro delete:result slot 3 removed 2797ms | 16:43:09.547 worker-2 ro delete:gate-release slot 3 removed 2797ms |
| 52 | 2 | yes | 16:44:16.071 worker-1 es delete:result slot 1 removed 1069ms | 16:44:16.073 worker-1 es delete:gate-release slot 1 removed 1069ms |
| 53 | 2 | yes | 16:44:19.810 worker-2 ru delete:result slot 2 removed 2983ms | 16:44:19.812 worker-2 ru delete:gate-release slot 2 removed 2983ms |
| 54 | 2 | yes | 16:44:28.207 worker-2 ru delete:result slot 1 removed 2532ms | 16:44:28.209 worker-2 ru delete:gate-release slot 1 removed 2532ms |
| 55 | 2 | yes | 16:45:02.231 worker-1 es_419 delete:result slot 1 removed 1489ms | 16:45:02.233 worker-1 es_419 delete:gate-release slot 1 removed 1489ms |
| 56 | 2 | yes | 16:45:20.678 worker-2 si delete:result slot 1 removed 2543ms | 16:45:20.680 worker-2 si delete:gate-release slot 1 removed 2543ms |
| 57 | 2 | yes | 16:46:29.181 worker-1 eu delete:result slot 3 removed 2437ms | 16:46:29.183 worker-1 eu delete:gate-release slot 3 removed 2437ms |
| 58 | 2 | yes | 16:47:37.862 worker-2 sq delete:result slot 3 removed 2516ms | 16:47:37.864 worker-2 sq delete:gate-release slot 3 removed 2516ms |
| 59 | 2 | yes | 16:47:53.316 worker-2 sq delete:result slot 1 removed 2445ms | 16:47:53.318 worker-2 sq delete:gate-release slot 1 removed 2445ms |
| 60 | 2 | yes | 16:48:33.209 worker-1 fi delete:result slot 2 removed 3100ms | 16:48:33.211 worker-1 fi delete:gate-release slot 2 removed 3100ms |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

| Rank | Score | Locale | Slot | Worker | Outcome | Attempt time | Result time | Duration ms | Visible | Min any gap ms | Min other-worker gap ms | Other events during window | Same-worker next attempt gap ms | Observed missing | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 30 | lv |  | worker-2 | matched | 17:11:10.298 | 17:11:10.298 |  | ->3 | 82 | 82 | 0 |  | no | lv: audit matched 3 localized screenshot(s) |
| 2 | 30 | ko |  | worker-2 | matched | 17:10:52.635 | 17:10:52.635 |  | ->3 | 445 | 445 | 0 |  | no | ko: audit matched 3 localized screenshot(s) |
| 3 | 30 | sq |  | worker-2 | matched | 17:13:32.702 | 17:13:32.702 |  | ->3 | 583 | 583 | 0 |  | no | sq: audit matched 3 localized screenshot(s) |
| 4 | 30 | fa |  | worker-1 | matched | 17:13:33.285 | 17:13:33.285 |  | ->3 | 583 | 583 | 0 |  | no | fa: audit matched 3 localized screenshot(s) |
| 5 | 30 | pa |  | worker-2 | matched | 17:12:33.371 | 17:12:33.371 |  | ->3 | 625 | 625 | 0 |  | no | pa: audit matched 3 localized screenshot(s) |
| 6 | 30 | en |  | worker-1 | matched | 17:12:33.996 | 17:12:33.996 |  | ->3 | 625 | 625 | 0 |  | no | en: audit matched 3 localized screenshot(s) |
| 7 | 30 | fil |  | worker-1 | matched | 17:13:43.754 | 17:13:43.754 |  | ->3 | 773 | 773 | 0 |  | no | fil: audit matched 3 localized screenshot(s) |
| 8 | 30 | sr |  | worker-2 | matched | 17:13:44.527 | 17:13:44.527 |  | ->3 | 773 | 773 | 0 |  | no | sr: audit matched 3 localized screenshot(s) |
| 9 | 30 | mk |  | worker-2 | matched | 17:11:22.576 | 17:11:22.576 |  | ->3 | 880 | 886 | 0 |  | no | mk: audit matched 3 localized screenshot(s) |
| 10 | 30 | de |  | worker-1 | matched | 17:12:21.969 | 17:12:21.969 |  | ->3 | 900 | 900 | 0 |  | no | de: audit matched 3 localized screenshot(s) |
| 11 | 30 | no |  | worker-2 | matched | 17:12:22.869 | 17:12:22.869 |  | ->3 | 900 | 900 | 0 |  | no | no: audit matched 3 localized screenshot(s) |
| 12 | 30 | en_au |  | worker-1 | matched | 17:12:44.014 | 17:12:44.014 |  | ->3 | 985 | 985 | 0 |  | no | en_AU: audit matched 3 localized screenshot(s) |
| 13 | 30 | pt_br |  | worker-2 | matched | 17:12:44.999 | 17:12:44.999 |  | ->3 | 985 | 985 | 0 |  | no | pt_BR: audit matched 3 localized screenshot(s) |
| 14 | 26 | ms |  | worker-2 | matched | 17:12:00.524 | 17:12:00.524 |  | ->3 | 1090 | 1090 | 0 |  | no | ms: audit matched 3 localized screenshot(s) |
| 15 | 26 | ca |  | worker-1 | matched | 17:12:01.614 | 17:12:01.614 |  | ->3 | 1090 | 1090 | 0 |  | no | ca: audit matched 3 localized screenshot(s) |
| 16 | 26 | lt |  | worker-2 | matched | 17:11:03.033 | 17:11:03.033 |  | ->3 | 1240 | 1671 | 0 |  | no | lt: audit matched 3 localized screenshot(s) |
| 17 | 26 | pt_pt |  | worker-2 | matched | 17:12:53.935 | 17:12:53.935 |  | ->3 | 1283 | 1283 | 0 |  | no | pt_PT: audit matched 3 localized screenshot(s) |
| 18 | 26 | en_us |  | worker-1 | matched | 17:12:55.218 | 17:12:55.218 |  | ->3 | 1283 | 1283 | 0 |  | no | en_US: audit matched 3 localized screenshot(s) |
| 19 | 26 | hi |  | worker-1 | matched | 17:14:13.445 | 17:14:13.445 |  | ->3 | 1363 | 1363 | 0 |  | no | hi: audit matched 3 localized screenshot(s) |
| 20 | 26 | te |  | worker-2 | matched | 17:14:14.808 | 17:14:14.808 |  | ->3 | 1363 | 1363 | 0 |  | no | te: audit matched 3 localized screenshot(s) |
| 21 | 26 | it |  | worker-1 | matched | 17:15:06.384 | 17:15:06.384 |  | ->3 | 1462 | 1462 | 0 |  | no | it: audit matched 3 localized screenshot(s) |
| 22 | 26 | zh_cn |  | worker-2 | matched | 17:15:07.846 | 17:15:07.846 |  | ->3 | 1462 | 1462 | 0 |  | no | zh_CN: audit matched 3 localized screenshot(s) |
| 23 | 26 | ne |  | worker-2 | matched | 17:12:11.222 | 17:12:11.222 |  | ->3 | 1465 | 1465 | 0 |  | no | ne: audit matched 3 localized screenshot(s) |
| 24 | 26 | da |  | worker-1 | matched | 17:12:12.687 | 17:12:12.687 |  | ->3 | 1465 | 1465 | 0 |  | no | da: audit matched 3 localized screenshot(s) |
| 25 | 26 | si |  | worker-2 | matched | 17:13:11.221 | 17:13:11.221 |  | ->3 | 1658 | 1658 | 0 |  | no | si: audit matched 3 localized screenshot(s) |
| 26 | 26 | es_419 |  | worker-1 | matched | 17:13:12.879 | 17:13:12.879 |  | ->3 | 1658 | 1658 | 0 |  | no | es_419: audit matched 3 localized screenshot(s) |
| 27 | 22 | en_au | 3 | worker-1 | unchanged | 16:41:24.968 | 16:41:40.472 | 21247 | 2->2 | 4 | 5397 | 1 | 7302 | no | Error: An unknown error occurred. |
| 28 | 22 | ru |  | worker-2 | matched | 17:13:04.909 | 17:13:04.909 |  | ->3 | 2059 | 2059 | 0 |  | no | ru: audit matched 3 localized screenshot(s) |
| 29 | 22 | es |  | worker-1 | matched | 17:13:06.968 | 17:13:06.968 |  | ->3 | 2059 | 2059 | 0 |  | no | es: audit matched 3 localized screenshot(s) |
| 30 | 22 | id |  | worker-1 | matched | 17:14:42.390 | 17:14:42.390 |  | ->3 | 2064 | 2064 | 0 |  | no | id: audit matched 3 localized screenshot(s) |
| 31 | 22 | ur |  | worker-2 | matched | 17:14:44.454 | 17:14:44.454 |  | ->3 | 2064 | 2064 | 0 |  | no | ur: audit matched 3 localized screenshot(s) |
| 32 | 22 | tr |  | worker-2 | matched | 17:14:28.651 | 17:14:28.651 |  | ->3 | 2237 | 2237 | 0 |  | no | tr: audit matched 3 localized screenshot(s) |
| 33 | 22 | hu |  | worker-1 | matched | 17:14:30.888 | 17:14:30.888 |  | ->3 | 2237 | 2237 | 0 |  | no | hu: audit matched 3 localized screenshot(s) |
| 34 | 22 | he |  | worker-1 | matched | 17:14:05.846 | 17:14:05.846 |  | ->3 | 2408 | 2408 | 0 |  | no | he: audit matched 3 localized screenshot(s) |
| 35 | 22 | ta |  | worker-2 | matched | 17:14:08.254 | 17:14:08.254 |  | ->3 | 2408 | 2408 | 0 |  | no | ta: audit matched 3 localized screenshot(s) |
| 36 | 22 | hy |  | worker-1 | matched | 17:14:36.193 | 17:14:36.193 |  | ->3 | 2483 | 2483 | 0 |  | no | hy: audit matched 3 localized screenshot(s) |
| 37 | 22 | uk |  | worker-2 | matched | 17:14:38.676 | 17:14:38.676 |  | ->3 | 2483 | 2483 | 0 |  | no | uk: audit matched 3 localized screenshot(s) |
| 38 | 22 | fr |  | worker-1 | matched | 17:13:53.686 | 17:13:53.686 |  | ->3 | 2701 | 2701 | 0 |  | no | fr: audit matched 3 localized screenshot(s) |
| 39 | 22 | sw |  | worker-2 | matched | 17:13:56.387 | 17:13:56.387 |  | ->3 | 2701 | 2701 | 0 |  | no | sw: audit matched 3 localized screenshot(s) |
| 40 | 22 | ml |  | worker-2 | matched | 17:11:49.059 | 17:11:49.059 |  | ->3 | 2726 | 2726 | 0 |  | no | ml: audit matched 3 localized screenshot(s) |
| 41 | 22 | bn |  | worker-1 | matched | 17:11:51.785 | 17:11:51.785 |  | ->3 | 2726 | 2726 | 0 |  | no | bn: audit matched 3 localized screenshot(s) |
| 42 | 22 | sk |  | worker-2 | matched | 17:13:21.350 | 17:13:21.350 |  | ->3 | 2733 | 2733 | 0 |  | no | sk: audit matched 3 localized screenshot(s) |
| 43 | 22 | eu |  | worker-1 | matched | 17:13:24.083 | 17:13:24.083 |  | ->3 | 2733 | 2733 | 0 |  | no | eu: audit matched 3 localized screenshot(s) |
| 44 | 22 | gu |  | worker-1 | matched | 17:13:59.150 | 17:13:59.150 |  | ->3 | 2763 | 2763 | 0 |  | no | gu: audit matched 3 localized screenshot(s) |
| 45 | 22 | sl |  | worker-2 | matched | 17:13:26.904 | 17:13:26.904 |  | ->3 | 2821 | 2821 | 0 |  | no | sl: audit matched 3 localized screenshot(s) |
| 46 | 22 | et |  | worker-1 | matched | 17:13:18.524 | 17:13:18.524 |  | ->3 | 2826 | 2826 | 0 |  | no | et: audit matched 3 localized screenshot(s) |
| 47 | 20 | de | 3 | worker-1 | unchanged | 16:37:10.202 | 16:37:21.266 | 11064 | 3->3 | 4 | 2266 | 1 | 16421 | no |  |
| 48 | 20 | kn | 3 | worker-1 | removed | 17:10:51.535 | 17:10:53.080 | 1545 | 3->2 | 4 | 445 | 1 | 2240 | no |  |
| 49 | 18 | bg | 3 | worker-1 | removed | 16:32:44.726 | 16:32:47.257 | 2531 | 3->2 | 3 | 1896 | 0 | 2662 | no |  |
| 50 | 18 | kn | 1 | worker-1 | added | 17:11:04.704 | 17:11:08.921 | 4654 | 0->1 | 3 | 1377 | 0 | 1295 | no |  |
| 51 | 18 | nl | 1 | worker-2 | added | 16:37:25.289 | 16:37:36.920 | 24608 | 0->1 | 5 | 1825 | 0 | 2590 | no |  |
| 52 | 18 | ru | 3 | worker-2 | removed | 16:44:06.949 | 16:44:14.238 | 7289 | 3->2 | 6 | 1833 | 0 | 2589 | no |  |
| 53 | 18 | pt_br | 3 | worker-2 | unchanged | 16:40:54.100 | 16:41:05.204 | 11104 | 3->3 | 7 | 4898 | 0 | 14367 | no |  |
| 54 | 18 | kn | 3 | worker-1 | added | 17:11:14.542 | 17:11:21.690 | 7529 | 2->3 | 10 | 886 | 0 |  | no |  |
| 55 | 18 | th |  | worker-2 | matched | 17:14:21.625 | 17:14:21.625 |  | ->3 | 3044 | 3044 | 0 |  | no | th: audit matched 3 localized screenshot(s) |
| 56 | 18 | hr |  | worker-1 | matched | 17:14:24.669 | 17:14:24.669 |  | ->3 | 3044 | 3044 | 0 |  | no | hr: audit matched 3 localized screenshot(s) |
| 57 | 18 | mr |  | worker-2 | matched | 17:11:54.898 | 17:11:54.898 |  | ->3 | 3113 | 3113 | 0 |  | no | mr: audit matched 3 localized screenshot(s) |
| 58 | 18 | sv |  | worker-2 | matched | 17:13:50.392 | 17:13:50.392 |  | ->3 | 3294 | 3294 | 0 |  | no | sv: audit matched 3 localized screenshot(s) |
| 59 | 18 | bg |  | worker-1 | matched | 17:11:45.568 | 17:11:45.568 |  | ->3 | 3491 | 3491 | 0 |  | no | bg: audit matched 3 localized screenshot(s) |
| 60 | 18 | cs |  | worker-1 | matched | 17:12:07.199 | 17:12:07.199 |  | ->3 | 4023 | 4023 | 0 |  | no | cs: audit matched 3 localized screenshot(s) |

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
