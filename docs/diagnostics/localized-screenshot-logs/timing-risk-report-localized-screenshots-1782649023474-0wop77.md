# Localized Screenshot Timing Risk Report: localized-screenshots-1782649023474-0wop77
Generated from: `docs\diagnostics\localized-screenshot-logs\storepilot-localized-screenshot-log-localized-screenshots-1782649023474-0wop77.json`
Observed state: `docs\diagnostics\localized-screenshot-logs\observed-localized-screenshots-1782649023474-0wop77.json`
## Run Summary
| Metric | Value |
| --- | --- |
| Run status | completed |
| Mode | replace |
| Elapsed | 27m 09s |
| Workers | 2 |
| Action events | 404 |
| Attempts | 202 |
| Results | 202 |
| Result outcomes | upload:added=198, upload:unchanged=4 |

## Gap Summary
| Gap set | Stats |
| --- | --- |
| All adjacent action events | 403 count, min 41ms, median 2620ms, p90 5387ms, max 218080ms, avg 3991ms |
| Adjacent attempts only | 201 count, min 101ms, median 4168ms, p90 10791ms, max 218555ms, avg 7978ms |
| Adjacent results only | 201 count, min 789ms, median 4407ms, p90 10241ms, max 225977ms, avg 7947ms |
| Cross-worker adjacent action events | 231 count, min 41ms, median 3030ms, p90 5170ms, max 218080ms, avg 4942ms |
| Same-worker adjacent action events | 172 count, min 155ms, median 178ms, p90 5465ms, max 164058ms, avg 2715ms |

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

## Observed Refreshed-State Comparison

This section is produced only when an observed-state JSON file is supplied. `Missing logged slots` means StorePilot logged the slot as added, but manual refreshed CWS inspection did not find it.

| Locale | Observed present slots | Logged added slots | Missing logged slots | Unexpected observed slots |
| --- | --- | --- | --- | --- |
| es_419 | 2 | 1, 2, 3 | 1, 3 |  |
| hy | 1, 2 | 1, 2, 3 | 3 |  |
| lv | 2, 3 | 1, 2, 3 | 1 |  |
| mk | 2, 3 | 1, 2, 3 | 1 |  |
| nl | 2 | 1, 2, 3 | 1, 3 |  |
| pl | 2, 3 | 1, 2, 3 | 1 |  |
| pt_pt | 1, 2, 3 | 1, 2, 3 |  |  |
| sr | 1, 2 | 1, 2, 3 | 3 |  |
| te | 1 | 1, 2, 3 | 2, 3 |  |
| tr | 2 | 1, 2, 3 | 1, 3 |  |
| zh_cn | 1, 2, 3 | 1, 2, 3 |  |  |

## Per-Slot Persistence Competition

This section is produced only when observed refreshed-state data is supplied. It treats `present` as the screenshot slot being present after revisiting/reloading CWS, not merely after StorePilot saw the thumbnail count increase.

The timing columns are global across all workers and all locales. They are intended to test server-side throttling or race behavior where CWS would not care whether the nearby action belongs to the same locale.

### Missing After Refresh

| Locale | Slot | Worker | Refreshed | UI result | Attempt time | Result time | Duration ms | Previous global attempt before this attempt | Next global attempt after this attempt | Previous global result before this result | Next global result after this result | Immediate previous global action before this result | Immediate next global action after this result | Other-worker actions during this upload window | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| es_419 | 1 | worker-1 | missing | added 0->1 | 12:33:00.621 | 12:33:07.715 | 7094 | -3132ms worker-2 pt_pt #2 upload:attempt | +101ms worker-2 pt_pt #3 upload:attempt | -1606ms worker-2 pt_pt #3 upload:result/added | +3558ms worker-1 es_419 #2 upload:result/added | -1606ms worker-2 pt_pt #3 upload:result/added | +172ms worker-1 es_419 #2 upload:attempt | +101ms worker-2 pt_pt #3 upload:attempt; +5488ms worker-2 pt_pt #3 upload:result/added |  |
| es_419 | 3 | worker-1 | missing | added 2->3 | 12:33:11.465 | 12:33:16.599 | 5134 | -3578ms worker-1 es_419 #2 upload:attempt | +2514ms worker-2 ro #1 upload:attempt | -5326ms worker-1 es_419 #2 upload:result/added | +4407ms worker-2 ro #1 upload:result/added | -2620ms worker-2 ro #1 upload:attempt | +4407ms worker-2 ro #1 upload:result/added | +2514ms worker-2 ro #1 upload:attempt |  |
| hy | 3 | worker-1 | missing | added 2->3 | 12:40:57.775 | 12:41:03.359 | 5584 | -1215ms worker-2 th #1 upload:attempt | +3646ms worker-2 th #2 upload:attempt | -2144ms worker-2 th #1 upload:result/added | +3297ms worker-2 th #2 upload:result/added | -1938ms worker-2 th #2 upload:attempt | +3297ms worker-2 th #2 upload:result/added | +3440ms worker-2 th #1 upload:result/added; +3646ms worker-2 th #2 upload:attempt | attempt 1: Error: An unknown error occurred. |
| lv | 1 | worker-2 | missing | added 0->1 | 12:20:13.156 | 12:20:20.276 | 7120 | -4618ms worker-1 az #2 upload:attempt | +246ms worker-1 az #3 upload:attempt | -1371ms worker-1 az #3 upload:result/added | +4154ms worker-2 lv #2 upload:result/added | -1371ms worker-1 az #3 upload:result/added | +160ms worker-2 lv #2 upload:attempt | +64ms worker-1 az #2 upload:result/added; +246ms worker-1 az #3 upload:attempt; +5749ms worker-1 az #3 upload:result/added |  |
| mk | 1 | worker-2 | missing | added 0->1 | 12:20:38.573 | 12:20:44.982 | 6409 | -3473ms worker-1 bg #2 upload:attempt | +779ms worker-1 bg #3 upload:attempt | -5809ms worker-1 bg #2 upload:result/added | +1366ms worker-1 bg #3 upload:result/added | -5630ms worker-1 bg #3 upload:attempt | +163ms worker-2 mk #2 upload:attempt | +600ms worker-1 bg #2 upload:result/added; +779ms worker-1 bg #3 upload:attempt |  |
| nl | 1 | worker-2 | missing | added 0->1 | 12:23:28.818 | 12:24:06.453 | 37635 | -15267ms worker-2 ne #3 upload:attempt | +2045ms worker-1 de #1 upload:attempt | -2517ms worker-1 de #1 upload:result/added | +6824ms worker-2 nl #2 upload:result/added | -2153ms worker-1 de #2 upload:attempt | +188ms worker-2 nl #2 upload:attempt | +2045ms worker-1 de #1 upload:attempt; +35118ms worker-1 de #1 upload:result/added; +35482ms worker-1 de #2 upload:attempt |  |
| nl | 3 | worker-2 | missing | added 2->3 | 12:24:13.478 | 12:24:17.689 | 4211 | -6837ms worker-2 nl #2 upload:attempt | +788ms worker-1 de #3 upload:attempt | -3623ms worker-1 de #2 upload:result/added | +2363ms worker-1 de #3 upload:result/added | -3423ms worker-1 de #3 upload:attempt | +2363ms worker-1 de #3 upload:result/added | +588ms worker-1 de #2 upload:result/added; +788ms worker-1 de #3 upload:attempt |  |
| pl | 1 | worker-2 | missing | added 0->1 | 12:28:53.071 | 12:31:45.212 | 172141 | -13751ms worker-1 en #3 upload:attempt | +361ms worker-1 en_au #1 upload:attempt | -3602ms worker-1 en_au #2 upload:result/added | +1323ms worker-1 en_au #3 upload:result/added | -3384ms worker-1 en_au #3 upload:attempt | +175ms worker-2 pl #2 upload:attempt | +361ms worker-1 en_au #1 upload:attempt; +4298ms worker-1 en_au #1 upload:result/added; +4481ms worker-1 en_au #2 upload:attempt; +168539ms worker-1 en_au #2 upload:result/added; +168757ms worker-1 en_au #3 upload:attempt |  |
| sr | 3 | worker-2 | missing | added 2->3 | 12:37:46.141 | 12:37:52.039 | 5898 | -5712ms worker-2 sr #2 upload:attempt | +3247ms worker-1 he #1 upload:attempt | -6071ms worker-2 sr #2 upload:result/added | +4703ms worker-1 he #1 upload:result/added | -2651ms worker-1 he #1 upload:attempt | +4703ms worker-1 he #1 upload:result/added | +3247ms worker-1 he #1 upload:attempt |  |
| te | 2 | worker-2 | missing | added 1->2 | 12:40:18.789 | 12:40:29.601 | 10812 | -15448ms worker-1 hy #1 upload:attempt | +4043ms worker-1 hy #1 upload:attempt | -12125ms worker-2 te #2 upload:result/unchanged | +3220ms worker-1 hy #1 upload:result/added | -6769ms worker-1 hy #1 upload:attempt | +166ms worker-2 te #3 upload:attempt | +4043ms worker-1 hy #1 upload:attempt | attempt 1: Error: An unknown error occurred. |
| te | 3 | worker-2 | missing | added 2->3 | 12:40:29.767 | 12:40:34.631 | 4864 | -6935ms worker-1 hy #1 upload:attempt | +3219ms worker-1 hy #2 upload:attempt | -1810ms worker-1 hy #1 upload:result/added | +7895ms worker-1 hy #2 upload:result/added | -1645ms worker-1 hy #2 upload:attempt | +7341ms worker-2 th #1 upload:attempt | +3054ms worker-1 hy #1 upload:result/added; +3219ms worker-1 hy #2 upload:attempt |  |
| tr | 1 | worker-2 | missing | added 0->1 | 12:41:21.616 | 12:41:27.960 | 6344 | -3648ms worker-1 id #2 upload:attempt | +222ms worker-1 id #3 upload:attempt | -6303ms worker-1 id #2 upload:result/added | +1315ms worker-1 id #3 upload:result/added | -6122ms worker-1 id #3 upload:attempt | +166ms worker-2 tr #2 upload:attempt | +41ms worker-1 id #2 upload:result/added; +222ms worker-1 id #3 upload:attempt |  |
| tr | 3 | worker-2 | missing | added 2->3 | 12:41:33.991 | 12:41:40.213 | 6222 | -5865ms worker-2 tr #2 upload:attempt | +3506ms worker-1 it #1 upload:attempt | -6396ms worker-2 tr #2 upload:result/added | +4371ms worker-1 it #1 upload:result/added | -2716ms worker-1 it #1 upload:attempt | +4371ms worker-1 it #1 upload:result/added | +3506ms worker-1 it #1 upload:attempt |  |

### Present After Refresh

| Locale | Slot | Worker | Refreshed | UI result | Attempt time | Result time | Duration ms | Previous global attempt before this attempt | Next global attempt after this attempt | Previous global result before this result | Next global result after this result | Immediate previous global action before this result | Immediate next global action after this result | Other-worker actions during this upload window | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| es_419 | 2 | worker-1 | present | added 1->2 | 12:33:07.887 | 12:33:11.273 | 3386 | -7165ms worker-2 pt_pt #3 upload:attempt | +3578ms worker-1 es_419 #3 upload:attempt | -3558ms worker-1 es_419 #1 upload:result/added | +5326ms worker-1 es_419 #3 upload:result/added | -3386ms worker-1 es_419 #2 upload:attempt | +192ms worker-1 es_419 #3 upload:attempt |  |  |
| hy | 1 | worker-1 | present | added 0->1 | 12:40:22.832 | 12:40:32.821 | 9989 | -4043ms worker-2 te #2 upload:attempt | +6935ms worker-2 te #3 upload:attempt | -3220ms worker-2 te #2 upload:result/added | +1810ms worker-2 te #3 upload:result/added | -3054ms worker-2 te #3 upload:attempt | +165ms worker-1 hy #2 upload:attempt | +6769ms worker-2 te #2 upload:result/added; +6935ms worker-2 te #3 upload:attempt | attempt 1: Error: An unknown error occurred. |
| hy | 2 | worker-1 | present | added 1->2 | 12:40:32.986 | 12:40:42.526 | 9540 | -3219ms worker-2 te #3 upload:attempt | +8986ms worker-2 th #1 upload:attempt | -7895ms worker-2 te #3 upload:result/added | +12578ms worker-2 th #1 upload:result/unchanged | -554ms worker-2 th #1 upload:attempt | +176ms worker-1 hy #3 upload:attempt | +1645ms worker-2 te #3 upload:result/added; +8986ms worker-2 th #1 upload:attempt |  |
| lv | 2 | worker-2 | present | added 1->2 | 12:20:20.436 | 12:20:24.430 | 3994 | -7034ms worker-1 az #3 upload:attempt | +4168ms worker-2 lv #3 upload:attempt | -4154ms worker-2 lv #1 upload:result/added | +6082ms worker-2 lv #3 upload:result/added | -3994ms worker-2 lv #2 upload:attempt | +174ms worker-2 lv #3 upload:attempt |  |  |
| lv | 3 | worker-2 | present | added 2->3 | 12:20:24.604 | 12:20:30.512 | 5908 | -4168ms worker-2 lv #2 upload:attempt | +4548ms worker-1 bg #1 upload:attempt | -6082ms worker-2 lv #2 upload:result/added | +4420ms worker-1 bg #1 upload:result/added | -1360ms worker-1 bg #1 upload:attempt | +4420ms worker-1 bg #1 upload:result/added | +4548ms worker-1 bg #1 upload:attempt |  |
| mk | 2 | worker-2 | present | added 1->2 | 12:20:45.145 | 12:20:51.050 | 5904 | -5793ms worker-1 bg #3 upload:attempt | +6077ms worker-2 mk #3 upload:attempt | -4702ms worker-1 bg #3 upload:result/added | +5629ms worker-2 mk #3 upload:result/added | -4702ms worker-1 bg #3 upload:result/added | +172ms worker-2 mk #3 upload:attempt | +1203ms worker-1 bg #3 upload:result/added |  |
| mk | 3 | worker-2 | present | added 2->3 | 12:20:51.222 | 12:20:56.679 | 5457 | -6077ms worker-2 mk #2 upload:attempt | +2824ms worker-1 bn #1 upload:attempt | -5629ms worker-2 mk #2 upload:result/added | +4465ms worker-1 bn #1 upload:result/added | -2633ms worker-1 bn #1 upload:attempt | +4465ms worker-1 bn #1 upload:result/added | +2824ms worker-1 bn #1 upload:attempt |  |
| nl | 2 | worker-2 | present | added 1->2 | 12:24:06.641 | 12:24:13.277 | 6636 | -2341ms worker-1 de #2 upload:attempt | +6837ms worker-2 nl #3 upload:attempt | -6824ms worker-2 nl #1 upload:result/added | +789ms worker-1 de #2 upload:result/added | -6636ms worker-2 nl #2 upload:attempt | +201ms worker-2 nl #3 upload:attempt |  |  |
| pl | 2 | worker-2 | present | added 1->2 | 12:31:45.387 | 12:31:50.878 | 5491 | -3559ms worker-1 en_au #3 upload:attempt | +5700ms worker-2 pl #3 upload:attempt | -4343ms worker-1 en_au #3 upload:result/added | +4346ms worker-2 pl #3 upload:result/added | -4343ms worker-1 en_au #3 upload:result/added | +209ms worker-2 pl #3 upload:attempt | +1148ms worker-1 en_au #3 upload:result/added |  |
| pl | 3 | worker-2 | present | added 2->3 | 12:31:51.087 | 12:31:55.224 | 4137 | -5700ms worker-2 pl #2 upload:attempt | +3643ms worker-1 en_gb #1 upload:attempt | -4346ms worker-2 pl #2 upload:result/added | +3030ms worker-1 en_gb #1 upload:result/added | -494ms worker-1 en_gb #1 upload:attempt | +3030ms worker-1 en_gb #1 upload:result/added | +3643ms worker-1 en_gb #1 upload:attempt |  |
| pt_pt | 1 | worker-2 | present | added 0->1 | 12:32:50.255 | 12:32:57.328 | 7073 | -2700ms worker-1 es #3 upload:attempt | +7234ms worker-2 pt_pt #2 upload:attempt | -4364ms worker-1 es #3 upload:result/added | +3224ms worker-2 pt_pt #2 upload:result/added | -4364ms worker-1 es #3 upload:result/added | +161ms worker-2 pt_pt #2 upload:attempt | +2709ms worker-1 es #3 upload:result/added |  |
| pt_pt | 2 | worker-2 | present | added 1->2 | 12:32:57.489 | 12:33:00.552 | 3063 | -7234ms worker-2 pt_pt #1 upload:attempt | +3132ms worker-1 es_419 #1 upload:attempt | -3224ms worker-2 pt_pt #1 upload:result/added | +5557ms worker-2 pt_pt #3 upload:result/added | -3063ms worker-2 pt_pt #2 upload:attempt | +69ms worker-1 es_419 #1 upload:attempt |  |  |
| pt_pt | 3 | worker-2 | present | added 2->3 | 12:33:00.722 | 12:33:06.109 | 5387 | -101ms worker-1 es_419 #1 upload:attempt | +7165ms worker-1 es_419 #2 upload:attempt | -5557ms worker-2 pt_pt #2 upload:result/added | +1606ms worker-1 es_419 #1 upload:result/added | -5387ms worker-2 pt_pt #3 upload:attempt | +1606ms worker-1 es_419 #1 upload:result/added |  |  |
| sr | 1 | worker-2 | present | added 0->1 | 12:37:33.082 | 12:37:40.268 | 7186 | -3133ms worker-1 gu #2 upload:attempt | +2841ms worker-1 gu #3 upload:attempt | -4526ms worker-1 gu #2 upload:result/added | +1332ms worker-1 gu #3 upload:result/added | -4345ms worker-1 gu #3 upload:attempt | +161ms worker-2 sr #2 upload:attempt | +2660ms worker-1 gu #2 upload:result/added; +2841ms worker-1 gu #3 upload:attempt |  |
| sr | 2 | worker-2 | present | added 1->2 | 12:37:40.429 | 12:37:45.968 | 5539 | -4506ms worker-1 gu #3 upload:attempt | +5712ms worker-2 sr #3 upload:attempt | -4368ms worker-1 gu #3 upload:result/added | +6071ms worker-2 sr #3 upload:result/added | -4368ms worker-1 gu #3 upload:result/added | +173ms worker-2 sr #3 upload:attempt | +1171ms worker-1 gu #3 upload:result/added |  |
| te | 1 | worker-2 | present | added 0->1 | 12:39:51.587 | 12:39:58.692 | 7105 | -5371ms worker-1 hu #3 upload:attempt | +7273ms worker-2 te #2 upload:attempt | -3407ms worker-1 hu #3 upload:result/added | +17785ms worker-1 hy #1 upload:result/unchanged | -3407ms worker-1 hu #3 upload:result/added | +168ms worker-2 te #2 upload:attempt | +3698ms worker-1 hu #3 upload:result/added |  |
| tr | 2 | worker-2 | present | added 1->2 | 12:41:28.126 | 12:41:33.817 | 5691 | -6288ms worker-1 id #3 upload:attempt | +5865ms worker-2 tr #3 upload:attempt | -4542ms worker-1 id #3 upload:result/added | +6396ms worker-2 tr #3 upload:result/added | -4542ms worker-1 id #3 upload:result/added | +174ms worker-2 tr #3 upload:attempt | +1149ms worker-1 id #3 upload:result/added |  |
| zh_cn | 1 | worker-2 | present | added 0->1 | 12:43:35.293 | 12:43:39.163 | 3870 | -12778ms worker-2 vi #3 upload:attempt | +4025ms worker-2 zh_cn #2 upload:attempt | -10971ms worker-2 vi #3 upload:result/added | +3559ms worker-2 zh_cn #2 upload:result/added | -3870ms worker-2 zh_cn #1 upload:attempt | +155ms worker-2 zh_cn #2 upload:attempt |  |  |
| zh_cn | 2 | worker-2 | present | added 1->2 | 12:43:39.318 | 12:43:42.722 | 3404 | -4025ms worker-2 zh_cn #1 upload:attempt | +3563ms worker-2 zh_cn #3 upload:attempt | -3559ms worker-2 zh_cn #1 upload:result/added | +5380ms worker-2 zh_cn #3 upload:result/added | -3404ms worker-2 zh_cn #2 upload:attempt | +159ms worker-2 zh_cn #3 upload:attempt |  |  |
| zh_cn | 3 | worker-2 | present | added 2->3 | 12:43:42.881 | 12:43:48.102 | 5221 | -3563ms worker-2 zh_cn #2 upload:attempt | +12230ms worker-2 zh_tw #1 upload:attempt | -5380ms worker-2 zh_cn #2 upload:result/added | +11026ms worker-2 zh_tw #1 upload:result/added | -5221ms worker-2 zh_cn #3 upload:attempt | +7009ms worker-2 zh_tw #1 upload:attempt |  |  |

## Closest Adjacent Action Events

These are the tightest gaps between consecutive logged CWS media action events. They are the primary candidates for server-side timing pressure.

| Rank | Gap ms | Same worker | Previous | Current |
| --- | --- | --- | --- | --- |
| 1 | 41 | no | 12:41:21.616 worker-2 tr upload:attempt slot 1 | 12:41:21.657 worker-1 id upload:result slot 2 added 3689ms |
| 2 | 64 | no | 12:20:13.156 worker-2 lv upload:attempt slot 1 | 12:20:13.220 worker-1 az upload:result slot 2 added 4682ms |
| 3 | 69 | no | 12:33:00.552 worker-2 pt_pt upload:result slot 2 added 3063ms | 12:33:00.621 worker-1 es_419 upload:attempt slot 1 |
| 4 | 101 | no | 12:33:00.621 worker-1 es_419 upload:attempt slot 1 | 12:33:00.722 worker-2 pt_pt upload:attempt slot 3 |
| 5 | 124 | no | 12:40:56.436 worker-1 hy upload:result slot 3 unchanged 13734ms | 12:40:56.560 worker-2 th upload:attempt slot 1 |
| 6 | 155 | yes | 12:43:39.163 worker-2 zh_cn upload:result slot 1 added 3870ms | 12:43:39.318 worker-2 zh_cn upload:attempt slot 2 |
| 7 | 156 | yes | 12:42:47.169 worker-2 uz upload:result slot 1 added 7042ms | 12:42:47.325 worker-2 uz upload:attempt slot 2 |
| 8 | 157 | yes | 12:31:58.254 worker-1 en_gb upload:result slot 1 added 3523ms | 12:31:58.411 worker-1 en_gb upload:attempt slot 2 |
| 9 | 158 | yes | 12:43:03.243 worker-1 kn upload:result slot 1 added 7058ms | 12:43:03.401 worker-1 kn upload:attempt slot 2 |
| 10 | 159 | yes | 12:21:37.333 worker-2 mr upload:result slot 1 added 7026ms | 12:21:37.492 worker-2 mr upload:attempt slot 2 |
| 11 | 159 | yes | 12:32:21.830 worker-1 en_us upload:result slot 2 added 4793ms | 12:32:21.989 worker-1 en_us upload:attempt slot 3 |
| 12 | 159 | yes | 12:33:21.006 worker-2 ro upload:result slot 1 added 7027ms | 12:33:21.165 worker-2 ro upload:attempt slot 2 |
| 13 | 159 | yes | 12:43:42.722 worker-2 zh_cn upload:result slot 2 added 3404ms | 12:43:42.881 worker-2 zh_cn upload:attempt slot 3 |
| 14 | 160 | yes | 12:20:20.276 worker-2 lv upload:result slot 1 added 7120ms | 12:20:20.436 worker-2 lv upload:attempt slot 2 |
| 15 | 160 | yes | 12:21:53.159 worker-1 cs upload:result slot 1 added 7025ms | 12:21:53.319 worker-1 cs upload:attempt slot 2 |
| 16 | 161 | yes | 12:21:32.934 worker-1 ca upload:result slot 2 added 5519ms | 12:21:33.095 worker-1 ca upload:attempt slot 3 |
| 17 | 161 | yes | 12:32:57.328 worker-2 pt_pt upload:result slot 1 added 7073ms | 12:32:57.489 worker-2 pt_pt upload:attempt slot 2 |
| 18 | 161 | yes | 12:37:40.268 worker-2 sr upload:result slot 1 added 7186ms | 12:37:40.429 worker-2 sr upload:attempt slot 2 |
| 19 | 162 | yes | 12:32:31.974 worker-2 pt_br upload:result slot 1 added 5717ms | 12:32:32.136 worker-2 pt_br upload:attempt slot 2 |
| 20 | 163 | yes | 12:20:44.982 worker-2 mk upload:result slot 1 added 6409ms | 12:20:45.145 worker-2 mk upload:attempt slot 2 |
| 21 | 163 | yes | 12:21:27.252 worker-1 ca upload:result slot 1 added 7104ms | 12:21:27.415 worker-1 ca upload:attempt slot 2 |
| 22 | 163 | yes | 12:32:01.934 worker-1 en_gb upload:result slot 2 added 3523ms | 12:32:02.097 worker-1 en_gb upload:attempt slot 3 |
| 23 | 164 | yes | 12:21:01.144 worker-1 bn upload:result slot 1 added 7098ms | 12:21:01.308 worker-1 bn upload:attempt slot 2 |
| 24 | 164 | yes | 12:33:57.478 worker-1 eu upload:result slot 1 added 7008ms | 12:33:57.642 worker-1 eu upload:attempt slot 2 |
| 25 | 164 | yes | 12:42:42.756 worker-1 ka upload:result slot 2 added 5350ms | 12:42:42.920 worker-1 ka upload:attempt slot 3 |
| 26 | 165 | yes | 12:21:11.251 worker-2 ml upload:result slot 1 added 7022ms | 12:21:11.416 worker-2 ml upload:attempt slot 2 |
| 27 | 165 | yes | 12:33:47.112 worker-2 ru upload:result slot 1 added 7014ms | 12:33:47.277 worker-2 ru upload:attempt slot 2 |
| 28 | 165 | yes | 12:35:46.608 worker-1 fa upload:result slot 2 added 5583ms | 12:35:46.773 worker-1 fa upload:attempt slot 3 |
| 29 | 165 | yes | 12:38:02.411 worker-1 he upload:result slot 2 added 5498ms | 12:38:02.576 worker-1 he upload:attempt slot 3 |
| 30 | 165 | yes | 12:40:32.821 worker-1 hy upload:result slot 1 added 9989ms | 12:40:32.986 worker-1 hy upload:attempt slot 2 |
| 31 | 165 | yes | 12:42:16.434 worker-1 ja upload:result slot 2 added 5089ms | 12:42:16.599 worker-1 ja upload:attempt slot 3 |
| 32 | 165 | yes | 12:43:59.128 worker-2 zh_tw upload:result slot 1 added 4017ms | 12:43:59.293 worker-2 zh_tw upload:attempt slot 2 |
| 33 | 166 | yes | 12:17:34.214 worker-2 ko upload:result slot 1 added 12046ms | 12:17:34.380 worker-2 ko upload:attempt slot 2 |
| 34 | 166 | yes | 12:20:08.372 worker-1 az upload:result slot 1 added 11490ms | 12:20:08.538 worker-1 az upload:attempt slot 2 |
| 35 | 166 | yes | 12:21:43.017 worker-2 mr upload:result slot 2 added 5525ms | 12:21:43.183 worker-2 mr upload:attempt slot 3 |
| 36 | 166 | yes | 12:33:26.914 worker-2 ro upload:result slot 2 added 5749ms | 12:33:27.080 worker-2 ro upload:attempt slot 3 |
| 37 | 166 | yes | 12:40:29.601 worker-2 te upload:result slot 2 added 10812ms | 12:40:29.767 worker-2 te upload:attempt slot 3 |
| 38 | 166 | yes | 12:41:17.802 worker-1 id upload:result slot 1 added 6429ms | 12:41:17.968 worker-1 id upload:attempt slot 2 |
| 39 | 166 | yes | 12:41:27.960 worker-2 tr upload:result slot 1 added 6344ms | 12:41:28.126 worker-2 tr upload:attempt slot 2 |
| 40 | 166 | yes | 12:44:03.186 worker-2 zh_tw upload:result slot 2 added 3893ms | 12:44:03.352 worker-2 zh_tw upload:attempt slot 3 |
| 41 | 167 | yes | 12:19:52.460 worker-2 lt upload:result slot 1 added 7915ms | 12:19:52.627 worker-2 lt upload:attempt slot 2 |
| 42 | 167 | yes | 12:33:31.255 worker-1 et upload:result slot 1 added 7110ms | 12:33:31.422 worker-1 et upload:attempt slot 2 |
| 43 | 167 | yes | 12:33:37.183 worker-1 et upload:result slot 2 added 5761ms | 12:33:37.350 worker-1 et upload:attempt slot 3 |
| 44 | 167 | yes | 12:36:05.649 worker-1 fi upload:result slot 1 added 6652ms | 12:36:05.816 worker-1 fi upload:attempt slot 2 |
| 45 | 167 | yes | 12:38:34.284 worker-2 sw upload:result slot 1 added 6594ms | 12:38:34.451 worker-2 sw upload:attempt slot 2 |
| 46 | 167 | yes | 12:42:11.178 worker-1 ja upload:result slot 1 added 7327ms | 12:42:11.345 worker-1 ja upload:attempt slot 2 |
| 47 | 167 | yes | 12:43:18.628 worker-2 vi upload:result slot 1 added 6558ms | 12:43:18.795 worker-2 vi upload:attempt slot 2 |
| 48 | 168 | yes | 12:20:34.932 worker-1 bg upload:result slot 1 added 5780ms | 12:20:35.100 worker-1 bg upload:attempt slot 2 |
| 49 | 168 | yes | 12:28:31.151 worker-2 pa upload:result slot 1 added 6754ms | 12:28:31.319 worker-2 pa upload:attempt slot 2 |
| 50 | 168 | yes | 12:32:47.387 worker-1 es upload:result slot 2 added 5724ms | 12:32:47.555 worker-1 es upload:attempt slot 3 |

## Highest Risk Result Events

Risk score weights observed refreshed-state misses, tight adjacent action gaps, tight other-worker gaps, other-worker activity during the upload/delete window, immediate same-worker next attempts, and explicit CWS errors.

| Rank | Score | Locale | Slot | Worker | Outcome | Attempt time | Result time | Duration ms | Visible | Min any gap ms | Min other-worker gap ms | Other events during window | Same-worker next attempt gap ms | Observed missing | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 44 | tr | 1 | worker-2 | added | 12:41:21.616 | 12:41:27.960 | 6344 | 0->1 | 41 | 222 | 2 | 166 | yes |  |
| 2 | 44 | lv | 1 | worker-2 | added | 12:20:13.156 | 12:20:20.276 | 7120 | 0->1 | 64 | 246 | 3 | 160 | yes |  |
| 3 | 44 | es_419 | 1 | worker-1 | added | 12:33:00.621 | 12:33:07.715 | 7094 | 0->1 | 69 | 101 | 2 | 172 | yes |  |
| 4 | 44 | pl | 1 | worker-2 | added | 12:28:53.071 | 12:31:45.212 | 172141 | 0->1 | 361 | 361 | 5 | 175 | yes |  |
| 5 | 44 | mk | 1 | worker-2 | added | 12:20:38.573 | 12:20:44.982 | 6409 | 0->1 | 600 | 779 | 2 | 163 | yes |  |
| 6 | 38 | nl | 3 | worker-2 | added | 12:24:13.478 | 12:24:17.689 | 4211 | 2->3 | 201 | 788 | 2 | 8785 | yes |  |
| 7 | 36 | te | 3 | worker-2 | added | 12:40:29.767 | 12:40:34.631 | 4864 | 2->3 | 166 | 1810 | 2 | 7341 | yes |  |
| 8 | 36 | te | 2 | worker-2 | added | 12:40:18.789 | 12:40:29.601 | 10812 | 1->2 | 1313 | 3220 | 1 | 166 | yes |  |
| 9 | 36 | nl | 1 | worker-2 | added | 12:23:28.818 | 12:24:06.453 | 37635 | 0->1 | 2045 | 2045 | 3 | 188 | yes |  |
| 10 | 34 | es_419 | 3 | worker-1 | added | 12:33:11.465 | 12:33:16.599 | 5134 | 2->3 | 192 | 2514 | 1 | 7546 | yes |  |
| 11 | 34 | hy | 3 | worker-1 | added | 12:40:57.775 | 12:41:03.359 | 5584 | 2->3 | 1215 | 1215 | 2 | 8014 | yes |  |
| 12 | 32 | te | 2 | worker-2 | unchanged | 12:39:58.860 | 12:40:17.476 | 18616 | 1->1 | 168 | 999 | 2 | 1313 | no | Error: An unknown error occurred. |
| 13 | 32 | sr | 3 | worker-2 | added | 12:37:46.141 | 12:37:52.039 | 5898 | 2->3 | 173 | 3247 | 1 | 7751 | yes |  |
| 14 | 32 | tr | 3 | worker-2 | added | 12:41:33.991 | 12:41:40.213 | 6222 | 2->3 | 174 | 3506 | 1 | 7471 | yes |  |
| 15 | 32 | hy | 3 | worker-1 | unchanged | 12:40:42.702 | 12:40:56.436 | 13734 | 2->2 | 176 | 730 | 1 | 1339 | no | Error: An unknown error occurred. |
| 16 | 32 | th | 1 | worker-2 | unchanged | 12:40:41.972 | 12:40:55.104 | 13132 | 0->0 | 554 | 730 | 2 | 1456 | no | Error: An unknown error occurred. |
| 17 | 24 | eu | 1 | worker-1 | added | 12:33:50.470 | 12:33:57.478 | 7008 | 0->1 | 168 | 376 | 3 | 164 | no |  |
| 18 | 24 | nl | 2 | worker-2 | added | 12:24:06.641 | 12:24:13.277 | 6636 | 1->2 | 188 | 789 | 0 | 201 | no |  |
| 19 | 24 | fr | 2 | worker-1 | added | 12:37:06.754 | 12:37:10.708 | 3954 | 1->2 | 241 | 500 | 0 | 176 | no |  |
| 20 | 24 | sq | 1 | worker-2 | added | 12:37:06.254 | 12:37:13.420 | 7166 | 0->1 | 259 | 500 | 4 | 168 | no |  |
| 21 | 24 | es | 1 | worker-1 | added | 12:32:35.039 | 12:32:41.489 | 6450 | 0->1 | 349 | 542 | 2 | 174 | no |  |
| 22 | 24 | en_au | 1 | worker-1 | added | 12:28:53.432 | 12:28:57.369 | 3937 | 0->1 | 361 | 361 | 0 | 183 | no |  |
| 23 | 24 | de | 2 | worker-1 | added | 12:24:04.300 | 12:24:14.066 | 9766 | 1->2 | 364 | 789 | 4 | 200 | no |  |
| 24 | 24 | az | 1 | worker-1 | added | 12:19:56.882 | 12:20:08.372 | 11490 | 0->1 | 422 | 614 | 3 | 166 | no |  |
| 25 | 24 | ta | 1 | worker-2 | added | 12:38:54.094 | 12:39:00.545 | 6452 | 0->1 | 460 | 669 | 2 | 189 | no |  |
| 26 | 24 | lt | 1 | worker-2 | added | 12:19:44.545 | 12:19:52.460 | 7915 | 0->1 | 598 | 786 | 3 | 167 | no |  |
| 27 | 24 | hy | 1 | worker-1 | unchanged | 12:40:03.341 | 12:40:16.477 | 13136 | 0->0 | 4481 | 999 | 0 | 6355 | no | Error: An unknown error occurred. |
| 28 | 22 | th | 1 | worker-2 | added | 12:40:56.560 | 12:41:01.215 | 4655 | 0->1 | 124 | 1215 | 1 | 206 | no |  |
| 29 | 22 | ko | 2 | worker-2 | added | 12:17:34.380 | 12:17:40.123 | 5743 | 1->2 | 166 | 1309 | 2 | 171 | no |  |
| 30 | 22 | sq | 2 | worker-2 | added | 12:37:13.588 | 12:37:19.183 | 5595 | 1->2 | 168 | 1991 | 1 | 192 | no |  |
| 31 | 22 | am | 2 | worker-1 | added | 12:17:31.048 | 12:17:35.519 | 4471 | 1->2 | 169 | 1305 | 2 | 170 | no |  |
| 32 | 22 | fa | 2 | worker-1 | added | 12:35:41.025 | 12:35:46.608 | 5583 | 1->2 | 170 | 1328 | 1 | 165 | no |  |
| 33 | 22 | ne | 2 | worker-2 | added | 12:23:07.623 | 12:23:13.310 | 5687 | 1->2 | 200 | 1056 | 2 | 241 | no |  |
| 34 | 22 | da | 2 | worker-1 | added | 12:23:06.567 | 12:23:10.832 | 4265 | 1->2 | 293 | 1056 | 2 | 203 | no |  |
| 35 | 22 | el | 2 | worker-1 | added | 12:28:07.816 | 12:28:12.399 | 4584 | 1->2 | 303 | 1312 | 2 | 375 | no |  |
| 36 | 22 | no | 2 | worker-2 | added | 12:28:06.504 | 12:28:10.891 | 4391 | 1->2 | 475 | 1312 | 2 | 412 | no |  |
| 37 | 20 | ro | 2 | worker-2 | added | 12:33:21.165 | 12:33:26.914 | 5749 | 1->2 | 159 | 2980 | 1 | 166 | no |  |
| 38 | 20 | pt_br | 2 | worker-2 | added | 12:32:32.136 | 12:32:35.388 | 3252 | 1->2 | 162 | 2903 | 1 | 193 | no |  |
| 39 | 20 | ca | 2 | worker-1 | added | 12:21:27.415 | 12:21:32.934 | 5519 | 1->2 | 163 | 2892 | 1 | 161 | no |  |
| 40 | 20 | bn | 2 | worker-1 | added | 12:21:01.308 | 12:21:06.881 | 5573 | 1->2 | 164 | 2921 | 1 | 169 | no |  |
| 41 | 20 | fi | 2 | worker-1 | added | 12:36:05.816 | 12:36:11.507 | 5691 | 1->2 | 167 | 2437 | 2 | 204 | no |  |
| 42 | 20 | ja | 2 | worker-1 | added | 12:42:11.345 | 12:42:16.434 | 5089 | 1->2 | 167 | 2441 | 1 | 165 | no |  |
| 43 | 20 | pa | 2 | worker-2 | added | 12:28:31.319 | 12:28:36.751 | 5432 | 1->2 | 168 | 2375 | 2 | 176 | no |  |
| 44 | 20 | it | 2 | worker-1 | added | 12:41:44.754 | 12:41:50.354 | 5600 | 1->2 | 170 | 2930 | 1 | 178 | no |  |
| 45 | 20 | he | 2 | worker-1 | added | 12:37:56.913 | 12:38:02.411 | 5498 | 1->2 | 171 | 2877 | 1 | 165 | no |  |
| 46 | 20 | sk | 2 | worker-2 | added | 12:36:02.876 | 12:36:08.080 | 5204 | 1->2 | 172 | 2431 | 2 | 173 | no |  |
| 47 | 20 | en | 2 | worker-1 | added | 12:28:34.018 | 12:28:39.126 | 5108 | 1->2 | 174 | 2375 | 2 | 194 | no |  |
| 48 | 20 | hu | 2 | worker-1 | added | 12:39:40.106 | 12:39:46.043 | 5937 | 1->2 | 176 | 2707 | 1 | 173 | no |  |
| 49 | 20 | ka | 2 | worker-1 | added | 12:42:37.406 | 12:42:42.756 | 5350 | 1->2 | 178 | 2721 | 1 | 164 | no |  |
| 50 | 20 | si | 2 | worker-2 | added | 12:34:11.818 | 12:34:17.204 | 5386 | 1->2 | 183 | 2723 | 1 | 196 | no |  |

## Recommendation
Use this report to choose a conservative mutation gate. If missing refreshed-state slots cluster near small cross-worker or same-worker gaps, enforce one background-issued media mutation token at a time and add a cooldown after every delete/upload result before another worker can mutate CWS media.
