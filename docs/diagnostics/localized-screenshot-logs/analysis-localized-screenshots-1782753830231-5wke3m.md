# Localized Screenshot Timing Risk Report: localized-screenshots-1782753830231-5wke3m
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782753830231-5wke3m.json`
Observed state: not supplied
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | completed |
| Mode | clearOnly |
| Elapsed | 26m 41s |
| Workers | 6 |
| Action events | 1061 |
| Attempts | 199 |
| Results | 265 |
| Result outcomes | audit:matched=66, delete:removed=199 |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 1060 count, min 1ms, median 961ms, p90 3191ms, max 68470ms, avg 1477ms |
| Adjacent attempts only | 198 count, min 3348ms, median 5373ms, p90 11702ms, max 72841ms, avg 7417ms |
| Adjacent results only | 264 count, min 122ms, median 4469ms, p90 9986ms, max 73587ms, avg 5724ms |
| Cross-worker adjacent action events | 545 count, min 9ms, median 1296ms, p90 3409ms, max 68470ms, avg 1892ms |
| Same-worker adjacent action events | 515 count, min 1ms, median 17ms, p90 2767ms, max 54306ms, avg 1039ms |

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
| 1 | 1 | yes | 17:37:25.049 worker-1 ca delete:result slot 1 removed 3272ms | 17:37:25.050 worker-1 ca delete:gate-release slot 1 removed 3272ms |
| 2 | 1 | yes | 17:38:36.741 worker-4 ms delete:result slot 2 removed 2491ms | 17:38:36.742 worker-4 ms delete:gate-release slot 2 removed 2491ms |
| 3 | 1 | yes | 17:43:49.872 worker-5 sr delete:result slot 3 removed 2606ms | 17:43:49.873 worker-5 sr delete:gate-release slot 3 removed 2606ms |
| 4 | 1 | yes | 17:46:24.587 worker-6 zh_tw delete:result slot 1 removed 11106ms | 17:46:24.588 worker-6 zh_tw delete:gate-release slot 1 removed 11106ms |
| 5 | 2 | yes | 17:25:59.164 worker-6 sw delete:result slot 2 removed 2553ms | 17:25:59.166 worker-6 sw delete:gate-release slot 2 removed 2553ms |
| 6 | 2 | yes | 17:26:03.505 worker-3 gu delete:result slot 1 removed 3170ms | 17:26:03.507 worker-3 gu delete:gate-release slot 1 removed 3170ms |
| 7 | 2 | yes | 17:26:19.766 worker-1 am delete:result slot 2 removed 2530ms | 17:26:19.768 worker-1 am delete:gate-release slot 2 removed 2530ms |
| 8 | 2 | yes | 17:26:42.935 worker-2 en_au delete:result slot 1 removed 2479ms | 17:26:42.937 worker-2 en_au delete:gate-release slot 1 removed 2479ms |
| 9 | 2 | yes | 17:27:39.428 worker-4 lt delete:result slot 2 removed 2572ms | 17:27:39.430 worker-4 lt delete:gate-release slot 2 removed 2572ms |
| 10 | 2 | yes | 17:27:42.738 worker-6 ta delete:result slot 1 removed 2413ms | 17:27:42.740 worker-6 ta delete:gate-release slot 1 removed 2413ms |
| 11 | 2 | yes | 17:31:01.265 worker-4 lv delete:result slot 1 removed 2810ms | 17:31:01.267 worker-4 lv delete:gate-release slot 1 removed 2810ms |
| 12 | 2 | yes | 17:31:31.839 worker-5 pt_pt delete:result slot 1 removed 2531ms | 17:31:31.841 worker-5 pt_pt delete:gate-release slot 1 removed 2531ms |
| 13 | 2 | yes | 17:32:53.899 worker-4 mk delete:result slot 2 removed 4678ms | 17:32:53.901 worker-4 mk delete:gate-release slot 2 removed 4678ms |
| 14 | 2 | yes | 17:33:34.588 worker-5 ro delete:result slot 1 removed 2539ms | 17:33:34.590 worker-5 ro delete:gate-release slot 1 removed 2539ms |
| 15 | 2 | yes | 17:34:05.509 worker-3 hu delete:result slot 2 removed 2489ms | 17:34:05.511 worker-3 hu delete:gate-release slot 2 removed 2489ms |
| 16 | 2 | yes | 17:35:39.158 worker-2 es_419 delete:result slot 2 removed 2581ms | 17:35:39.160 worker-2 es_419 delete:gate-release slot 2 removed 2581ms |
| 17 | 2 | yes | 17:36:13.169 worker-3 hy delete:result slot 3 removed 6516ms | 17:36:13.171 worker-3 hy delete:gate-release slot 3 removed 6516ms |
| 18 | 2 | yes | 17:36:39.908 worker-1 ca delete:result slot 3 removed 2624ms | 17:36:39.910 worker-1 ca delete:gate-release slot 3 removed 2624ms |
| 19 | 2 | yes | 17:37:36.545 worker-6 ur delete:result slot 2 removed 2466ms | 17:37:36.547 worker-6 ur delete:gate-release slot 2 removed 2466ms |
| 20 | 2 | yes | 17:38:19.262 worker-1 cs delete:result slot 3 removed 2467ms | 17:38:19.264 worker-1 cs delete:gate-release slot 3 removed 2467ms |
| 21 | 2 | yes | 17:40:35.355 worker-1 da delete:result slot 2 removed 2838ms | 17:40:35.357 worker-1 da delete:gate-release slot 2 removed 2838ms |
| 22 | 2 | yes | 17:40:56.524 worker-5 sl delete:result slot 1 removed 2495ms | 17:40:56.526 worker-5 sl delete:gate-release slot 1 removed 2495ms |
| 23 | 2 | yes | 17:41:23.617 worker-2 eu delete:result slot 1 removed 2651ms | 17:41:23.619 worker-2 eu delete:gate-release slot 1 removed 2651ms |
| 24 | 2 | yes | 17:42:04.170 worker-5 sq delete:result slot 3 removed 7590ms | 17:42:04.172 worker-5 sq delete:gate-release slot 3 removed 7590ms |
| 25 | 2 | yes | 17:42:17.225 worker-3 ja delete:result slot 1 removed 3684ms | 17:42:17.227 worker-3 ja delete:gate-release slot 1 removed 3684ms |
| 26 | 2 | yes | 17:42:56.171 worker-4 no delete:result slot 3 removed 2767ms | 17:42:56.173 worker-4 no delete:gate-release slot 3 removed 2767ms |
| 27 | 2 | yes | 17:44:09.071 worker-3 ka delete:result slot 3 removed 6504ms | 17:44:09.073 worker-3 ka delete:gate-release slot 3 removed 6504ms |
| 28 | 2 | yes | 17:44:36.538 worker-3 ka delete:result slot 2 removed 2440ms | 17:44:36.540 worker-3 ka delete:gate-release slot 2 removed 2440ms |
| 29 | 2 | yes | 17:45:36.079 worker-6 zh_tw delete:result slot 3 removed 2437ms | 17:45:36.081 worker-6 zh_tw delete:gate-release slot 3 removed 2437ms |
| 30 | 2 | yes | 17:45:54.060 worker-5 sv delete:result slot 2 removed 2804ms | 17:45:54.062 worker-5 sv delete:gate-release slot 2 removed 2804ms |
| 31 | 2 | yes | 17:45:58.529 worker-6 zh_tw delete:result slot 2 removed 2504ms | 17:45:58.531 worker-6 zh_tw delete:gate-release slot 2 removed 2504ms |
| 32 | 2 | yes | 17:46:55.709 worker-3 kn delete:result slot 1 removed 6548ms | 17:46:55.711 worker-3 kn delete:gate-release slot 1 removed 6548ms |
| 33 | 2 | yes | 17:47:21.456 worker-1 en delete:result slot 1 removed 5109ms | 17:47:21.458 worker-1 en delete:gate-release slot 1 removed 5109ms |
| 34 | 3 | yes | 17:24:21.049 worker-3 gu delete:gate-grant slot 3 | 17:24:21.052 worker-3 gu delete:attempt slot 3 |
| 35 | 3 | yes | 17:25:15.358 worker-3 gu delete:result slot 3 removed 54306ms | 17:25:15.361 worker-3 gu delete:gate-release slot 3 removed 54306ms |
| 36 | 3 | yes | 17:25:44.404 worker-5 pl delete:result slot 3 removed 8460ms | 17:25:44.407 worker-5 pl delete:gate-release slot 3 removed 8460ms |
| 37 | 3 | yes | 17:27:32.415 worker-5 pt_br delete:result slot 3 removed 6367ms | 17:27:32.418 worker-5 pt_br delete:gate-release slot 3 removed 6367ms |
| 38 | 3 | yes | 17:27:46.813 worker-1 ar delete:result slot 3 removed 2713ms | 17:27:46.816 worker-1 ar delete:gate-release slot 3 removed 2713ms |
| 39 | 3 | yes | 17:28:19.758 worker-5 pt_br delete:result slot 1 removed 6473ms | 17:28:19.761 worker-5 pt_br delete:gate-release slot 1 removed 6473ms |
| 40 | 3 | yes | 17:28:32.031 worker-1 ar delete:result slot 1 removed 3353ms | 17:28:32.034 worker-1 ar delete:gate-release slot 1 removed 3353ms |
| 41 | 3 | yes | 17:28:43.176 worker-6 te delete:result slot 3 removed 2627ms | 17:28:43.179 worker-6 te delete:gate-release slot 3 removed 2627ms |
| 42 | 3 | yes | 17:29:10.297 worker-6 te delete:result slot 2 removed 3363ms | 17:29:10.300 worker-6 te delete:gate-release slot 2 removed 3363ms |
| 43 | 3 | yes | 17:30:31.129 worker-5 pt_pt delete:result slot 3 removed 71374ms | 17:30:31.132 worker-5 pt_pt delete:gate-release slot 3 removed 71374ms |
| 44 | 3 | yes | 17:30:38.401 worker-6 te delete:result slot 1 removed 2532ms | 17:30:38.404 worker-6 te delete:gate-release slot 1 removed 2532ms |
| 45 | 3 | yes | 17:31:05.320 worker-5 pt_pt delete:result slot 2 removed 2798ms | 17:31:05.323 worker-5 pt_pt delete:gate-release slot 2 removed 2798ms |
| 46 | 3 | yes | 17:31:44.489 worker-3 hr delete:result slot 3 removed 2619ms | 17:31:44.492 worker-3 hr delete:gate-release slot 3 removed 2619ms |
| 47 | 3 | yes | 17:31:53.896 worker-2 en_us delete:result slot 1 removed 7505ms | 17:31:53.899 worker-2 en_us delete:gate-release slot 1 removed 7505ms |
| 48 | 3 | yes | 17:32:33.976 worker-5 ro delete:result slot 3 removed 6910ms | 17:32:33.979 worker-5 ro delete:gate-release slot 3 removed 6910ms |
| 49 | 3 | yes | 17:32:39.225 worker-1 bg delete:result slot 3 removed 2656ms | 17:32:39.228 worker-1 bg delete:gate-release slot 3 removed 2656ms |
| 50 | 3 | yes | 17:33:23.857 worker-2 es delete:result slot 3 removed 2592ms | 17:33:23.860 worker-2 es delete:gate-release slot 3 removed 2592ms |
| 51 | 3 | yes | 17:33:30.878 worker-6 tr delete:result slot 3 removed 2892ms | 17:33:30.881 worker-6 tr delete:gate-release slot 3 removed 2892ms |
| 52 | 3 | yes | 17:34:00.489 worker-6 tr delete:result slot 2 removed 2868ms | 17:34:00.492 worker-6 tr delete:gate-release slot 2 removed 2868ms |
| 53 | 3 | yes | 17:34:33.231 worker-4 ml delete:result slot 3 removed 2588ms | 17:34:33.234 worker-4 ml delete:gate-release slot 3 removed 2588ms |
| 54 | 3 | yes | 17:35:08.431 worker-2 es_419 delete:result slot 3 removed 8010ms | 17:35:08.434 worker-2 es_419 delete:gate-release slot 3 removed 8010ms |
| 55 | 3 | yes | 17:35:16.576 worker-4 ml delete:result slot 1 removed 6932ms | 17:35:16.579 worker-4 ml delete:gate-release slot 1 removed 6932ms |
| 56 | 3 | yes | 17:35:27.759 worker-1 bn delete:result slot 2 removed 3103ms | 17:35:27.762 worker-1 bn delete:gate-release slot 2 removed 3103ms |
| 57 | 3 | yes | 17:36:20.735 worker-4 mr delete:result slot 3 removed 2485ms | 17:36:20.738 worker-4 mr delete:gate-release slot 3 removed 2485ms |
| 58 | 3 | yes | 17:36:30.134 worker-5 si delete:result slot 3 removed 2552ms | 17:36:30.137 worker-5 si delete:gate-release slot 3 removed 2552ms |
| 59 | 3 | yes | 17:36:51.631 worker-5 si delete:result slot 2 removed 6382ms | 17:36:51.634 worker-5 si delete:gate-release slot 2 removed 6382ms |
| 60 | 3 | yes | 17:36:56.591 worker-3 hy delete:result slot 1 removed 2742ms | 17:36:56.594 worker-3 hy delete:gate-release slot 1 removed 2742ms |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

| Rank | Score | Locale | Slot | Worker | Outcome | Attempt time | Result time | Duration ms | Visible | Min any gap ms | Min other-worker gap ms | Other events during window | Same-worker next attempt gap ms | Observed missing | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 30 | sl |  | worker-5 | matched | 17:48:45.033 | 17:48:45.033 |  | ->0 | 122 | 122 | 0 |  | no | sl: audit matched 0 localized screenshot(s) |
| 2 | 30 | mr |  | worker-4 | matched | 17:47:33.000 | 17:47:33.000 |  | ->0 | 275 | 275 | 0 |  | no | mr: audit matched 0 localized screenshot(s) |
| 3 | 30 | hr |  | worker-3 | matched | 17:47:33.275 | 17:47:33.275 |  | ->0 | 275 | 275 | 0 |  | no | hr: audit matched 0 localized screenshot(s) |
| 4 | 30 | gu |  | worker-3 | matched | 17:47:08.097 | 17:47:08.097 |  | ->0 | 319 | 324 | 0 |  | no | gu: audit matched 0 localized screenshot(s) |
| 5 | 30 | mk |  | worker-4 | matched | 17:46:47.720 | 17:46:47.720 |  | ->0 | 338 | 338 | 0 |  | no | mk: audit matched 0 localized screenshot(s) |
| 6 | 30 | pl |  | worker-5 | matched | 17:46:48.058 | 17:46:48.058 |  | ->0 | 338 | 338 | 0 |  | no | pl: audit matched 0 localized screenshot(s) |
| 7 | 30 | ml |  | worker-4 | matched | 17:46:57.564 | 17:46:57.564 |  | ->0 | 341 | 341 | 0 |  | no | ml: audit matched 0 localized screenshot(s) |
| 8 | 30 | ta |  | worker-6 | matched | 17:46:57.905 | 17:46:57.905 |  | ->0 | 341 | 341 | 0 |  | no | ta: audit matched 0 localized screenshot(s) |
| 9 | 30 | tr |  | worker-6 | matched | 17:47:59.510 | 17:47:59.510 |  | ->0 | 385 | 385 | 0 |  | no | tr: audit matched 0 localized screenshot(s) |
| 10 | 30 | ru |  | worker-5 | matched | 17:47:59.895 | 17:47:59.895 |  | ->0 | 385 | 385 | 0 |  | no | ru: audit matched 0 localized screenshot(s) |
| 11 | 30 | ja |  | worker-3 | matched | 17:48:37.999 | 17:48:37.999 |  | ->0 | 536 | 536 | 0 |  | no | ja: audit matched 0 localized screenshot(s) |
| 12 | 30 | sk |  | worker-5 | matched | 17:48:38.535 | 17:48:38.535 |  | ->0 | 536 | 536 | 0 |  | no | sk: audit matched 0 localized screenshot(s) |
| 13 | 30 | id |  | worker-3 | matched | 17:48:16.828 | 17:48:16.828 |  | ->0 | 585 | 585 | 0 |  | no | id: audit matched 0 localized screenshot(s) |
| 14 | 30 | ur |  | worker-6 | matched | 17:48:17.413 | 17:48:17.413 |  | ->0 | 585 | 585 | 0 |  | no | ur: audit matched 0 localized screenshot(s) |
| 15 | 30 | sr |  | worker-5 | matched | 17:49:35.514 | 17:49:35.514 |  | ->0 | 695 | 695 | 0 |  | no | sr: audit matched 0 localized screenshot(s) |
| 16 | 30 | en_gb |  | worker-2 | matched | 17:49:36.209 | 17:49:36.209 |  | ->0 | 695 | 695 | 0 |  | no | en_GB: audit matched 0 localized screenshot(s) |
| 17 | 30 | de |  | worker-1 | matched | 17:49:29.457 | 17:49:29.457 |  | ->0 | 780 | 780 | 0 |  | no | de: audit matched 0 localized screenshot(s) |
| 18 | 30 | sq |  | worker-5 | matched | 17:49:30.237 | 17:49:30.237 |  | ->0 | 780 | 780 | 0 |  | no | sq: audit matched 0 localized screenshot(s) |
| 19 | 30 | pt_br |  | worker-5 | matched | 17:46:54.913 | 17:46:54.913 |  | ->0 | 796 | 796 | 0 |  | no | pt_BR: audit matched 0 localized screenshot(s) |
| 20 | 30 | hi |  | worker-3 | matched | 17:47:27.437 | 17:47:27.437 |  | ->0 | 850 | 855 | 0 |  | no | hi: audit matched 0 localized screenshot(s) |
| 21 | 30 | ne |  | worker-4 | matched | 17:48:00.768 | 17:48:00.768 |  | ->0 | 873 | 873 | 0 |  | no | ne: audit matched 0 localized screenshot(s) |
| 22 | 30 | ka |  | worker-3 | matched | 17:49:12.501 | 17:49:12.501 |  | ->0 | 885 | 885 | 0 |  | no | ka: audit matched 0 localized screenshot(s) |
| 23 | 30 | zh_cn |  | worker-6 | matched | 17:49:13.386 | 17:49:13.386 |  | ->0 | 885 | 885 | 0 |  | no | zh_CN: audit matched 0 localized screenshot(s) |
| 24 | 30 | uk |  | worker-6 | matched | 17:48:11.236 | 17:48:11.236 |  | ->0 | 964 | 964 | 0 |  | no | uk: audit matched 0 localized screenshot(s) |
| 25 | 30 | no |  | worker-4 | matched | 17:48:12.200 | 17:48:12.200 |  | ->0 | 964 | 964 | 0 |  | no | no: audit matched 0 localized screenshot(s) |
| 26 | 28 | he |  | worker-3 | matched | 17:47:17.760 | 17:47:17.760 |  | ->0 | 146 | 1306 | 0 |  | no | he: audit matched 0 localized screenshot(s) |
| 27 | 28 | ko |  | worker-4 | matched | 17:46:23.218 | 17:46:23.218 |  | ->0 | 702 | 1369 | 0 |  | no | ko: audit matched 0 localized screenshot(s) |
| 28 | 28 | te |  | worker-6 | matched | 17:47:14.796 | 17:47:14.796 |  | ->0 | 812 | 1551 | 0 |  | no | te: audit matched 0 localized screenshot(s) |
| 29 | 26 | es_419 |  | worker-2 | matched | 17:49:50.865 | 17:49:50.865 |  | ->0 | 1098 | 1098 | 0 |  | no | es_419: audit matched 0 localized screenshot(s) |
| 30 | 26 | el |  | worker-1 | matched | 17:49:51.963 | 17:49:51.963 |  | ->0 | 1098 | 1098 | 0 |  | no | el: audit matched 0 localized screenshot(s) |
| 31 | 26 | lt |  | worker-4 | matched | 17:46:28.657 | 17:46:28.657 |  | ->0 | 1099 | 1099 | 0 |  | no | lt: audit matched 0 localized screenshot(s) |
| 32 | 26 | ar |  | worker-1 | matched | 17:47:51.557 | 17:47:51.557 |  | ->0 | 1173 | 1173 | 0 |  | no | ar: audit matched 0 localized screenshot(s) |
| 33 | 26 | th |  | worker-6 | matched | 17:47:52.730 | 17:47:52.730 |  | ->0 | 1173 | 1173 | 0 |  | no | th: audit matched 0 localized screenshot(s) |
| 34 | 26 | hu |  | worker-3 | matched | 17:47:50.289 | 17:47:50.289 |  | ->0 | 1268 | 1268 | 0 |  | no | hu: audit matched 0 localized screenshot(s) |
| 35 | 26 | pt_pt |  | worker-5 | matched | 17:47:19.066 | 17:47:19.066 |  | ->0 | 1306 | 1306 | 0 |  | no | pt_PT: audit matched 0 localized screenshot(s) |
| 36 | 26 | pa |  | worker-4 | matched | 17:48:22.343 | 17:48:22.343 |  | ->0 | 1440 | 1440 | 0 |  | no | pa: audit matched 0 localized screenshot(s) |
| 37 | 26 | it |  | worker-3 | matched | 17:48:23.783 | 17:48:23.783 |  | ->0 | 1440 | 1440 | 0 |  | no | it: audit matched 0 localized screenshot(s) |
| 38 | 26 | ro |  | worker-5 | matched | 17:47:54.174 | 17:47:54.174 |  | ->0 | 1444 | 1444 | 0 |  | no | ro: audit matched 0 localized screenshot(s) |
| 39 | 26 | az |  | worker-1 | matched | 17:48:09.763 | 17:48:09.763 |  | ->0 | 1473 | 1473 | 0 |  | no | az: audit matched 0 localized screenshot(s) |
| 40 | 26 | bn |  | worker-1 | matched | 17:48:52.683 | 17:48:52.683 |  | ->0 | 1637 | 1640 | 0 |  | no | bn: audit matched 0 localized screenshot(s) |
| 41 | 26 | da |  | worker-1 | matched | 17:49:15.214 | 17:49:15.214 |  | ->0 | 1828 | 1828 | 0 |  | no | da: audit matched 0 localized screenshot(s) |
| 42 | 24 | lv |  | worker-4 | matched | 17:46:41.242 | 17:46:41.242 |  | ->0 | 1645 | 2787 | 0 |  | no | lv: audit matched 0 localized screenshot(s) |
| 43 | 22 | vi |  | worker-6 | matched | 17:49:07.079 | 17:49:07.079 |  | ->0 | 2070 | 2070 | 0 |  | no | vi: audit matched 0 localized screenshot(s) |
| 44 | 22 | cs |  | worker-1 | matched | 17:49:09.149 | 17:49:09.149 |  | ->0 | 2070 | 2070 | 0 |  | no | cs: audit matched 0 localized screenshot(s) |
| 45 | 22 | uz |  | worker-6 | matched | 17:48:33.985 | 17:48:33.985 |  | ->0 | 2103 | 2893 | 0 |  | no | uz: audit matched 0 localized screenshot(s) |
| 46 | 22 | sw |  | worker-6 | matched | 17:46:51.276 | 17:46:51.276 |  | ->0 | 2114 | 2114 | 0 |  | no | sw: audit matched 0 localized screenshot(s) |
| 47 | 22 | fa |  | worker-2 | matched | 17:50:10.055 | 17:50:10.055 |  | ->0 | 2276 | 2276 | 0 |  | no | fa: audit matched 0 localized screenshot(s) |
| 48 | 22 | sv |  | worker-5 | matched | 17:50:12.331 | 17:50:12.331 |  | ->0 | 2276 | 2276 | 0 |  | no | sv: audit matched 0 localized screenshot(s) |
| 49 | 22 | bg |  | worker-1 | matched | 17:48:19.774 | 17:48:19.774 |  | ->0 | 2361 | 2361 | 0 |  | no | bg: audit matched 0 localized screenshot(s) |
| 50 | 22 | hy |  | worker-3 | matched | 17:47:56.537 | 17:47:56.537 |  | ->0 | 2363 | 2363 | 0 |  | no | hy: audit matched 0 localized screenshot(s) |
| 51 | 22 | kn |  | worker-3 | matched | 17:49:17.795 | 17:49:17.795 |  | ->0 | 2581 | 2581 | 0 |  | no | kn: audit matched 0 localized screenshot(s) |
| 52 | 22 | fi |  | worker-2 | matched | 17:50:15.247 | 17:50:15.247 |  | ->0 | 2916 | 2916 | 0 |  | no | fi: audit matched 0 localized screenshot(s) |
| 53 | 22 | ca |  | worker-1 | matched | 17:48:58.245 | 17:48:58.245 |  | ->0 | 2949 | 2949 | 0 |  | no | ca: audit matched 0 localized screenshot(s) |
| 54 | 22 | en_au |  | worker-2 | matched | 17:49:01.194 | 17:49:01.194 |  | ->0 | 2949 | 2949 | 0 |  | no | en_AU: audit matched 0 localized screenshot(s) |
| 55 | 18 | fil | 1 | worker-2 | removed | 17:47:24.037 | 17:47:26.582 | 2545 | 1->0 | 8 | 855 | 0 | 70296 | no |  |
| 56 | 18 | en | 2 | worker-1 | removed | 17:46:57.199 | 17:47:07.773 | 10574 | 2->1 | 10 | 324 | 3 | 8574 | no |  |
| 57 | 18 | fr | 2 | worker-2 | removed | 17:48:43.737 | 17:48:45.155 | 1418 | 2->1 | 40 | 122 | 1 | 4390 | no |  |
| 58 | 18 | kn | 1 | worker-3 | removed | 17:46:49.162 | 17:46:55.709 | 6548 | 1->0 | 182 | 796 | 2 |  | no |  |
| 59 | 18 | en |  | worker-1 | matched | 17:49:56.956 | 17:49:56.956 |  | ->0 | 3365 | 3365 | 0 |  | no | en: audit matched 0 localized screenshot(s) |
| 60 | 18 | et |  | worker-2 | matched | 17:50:00.321 | 17:50:00.321 |  | ->0 | 3365 | 3365 | 0 |  | no | et: audit matched 0 localized screenshot(s) |

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
