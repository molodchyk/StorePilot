# Per-Slot Persistence Competition Report

Source log: `storepilot-localized-screenshot-log-localized-screenshots-1782649023474-0wop77.json`

Observed state: `observed-localized-screenshots-1782649023474-0wop77.json`

This report treats a screenshot as successful only when it is present after revisiting/reloading the CWS locale. A CWS UI result of `added` only means the thumbnail count increased during the run.

Column definitions:

- `UI result`: the logged CWS UI result and visible count transition.
- `Previous same-locale result`: time since the previous result event for the same worker and locale.
- `Next same-locale attempt`: time until the same worker tried the next upload in the same locale.
- `Previous/next global action`: immediately adjacent upload action in the raw global log around this result event.
- `Closest other-worker action`: nearest event from another worker around this result event.
- `Other-worker actions during this upload`: events from another worker between this screenshot's attempt and result timestamps.

## Missing After Refresh

| Locale | Slot | Worker | Refreshed | UI result | Result time UTC | Upload duration | Previous same-locale result | Next same-locale attempt | Previous global action | Next global action | Closest other-worker action | Other-worker actions during this upload | Errors |
| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| es_419 | 1 | worker-1 | missing | added 0->1 | 12:33:07.715 | 7094ms | - | 172ms | -1606ms worker-2 pt_pt #3 result/added | +172ms worker-1 es_419 #2 attempt | -1606ms worker-2 pt_pt #3 result/added | 2: worker-2 pt_pt #3 attempt; worker-2 pt_pt #3 result/added | - |
| es_419 | 3 | worker-1 | missing | added 2->3 | 12:33:16.599 | 5134ms | 5326ms | - | -2620ms worker-2 ro #1 attempt | +4407ms worker-2 ro #1 result/added | -2620ms worker-2 ro #1 attempt | 1: worker-2 ro #1 attempt | - |
| hy | 3 | worker-1 | missing | added 2->3 | 12:41:03.359 | 5584ms | 6923ms | - | -1938ms worker-2 th #2 attempt | +3297ms worker-2 th #2 result/added | -1938ms worker-2 th #2 attempt | 2: worker-2 th #1 result/added; worker-2 th #2 attempt | attempt 1: Error: An unknown error occurred. |
| lv | 1 | worker-2 | missing | added 0->1 | 12:20:20.276 | 7120ms | - | 160ms | -1371ms worker-1 az #3 result/added | +160ms worker-2 lv #2 attempt | -1371ms worker-1 az #3 result/added | 3: worker-1 az #2 result/added; worker-1 az #3 attempt; worker-1 az #3 result/added | - |
| mk | 1 | worker-2 | missing | added 0->1 | 12:20:44.982 | 6409ms | - | 163ms | -5630ms worker-1 bg #3 attempt | +163ms worker-2 mk #2 attempt | +1366ms worker-1 bg #3 result/added | 2: worker-1 bg #2 result/added; worker-1 bg #3 attempt | - |
| nl | 1 | worker-2 | missing | added 0->1 | 12:24:06.453 | 37635ms | - | 188ms | -2153ms worker-1 de #2 attempt | +188ms worker-2 nl #2 attempt | -2153ms worker-1 de #2 attempt | 3: worker-1 de #1 attempt; worker-1 de #1 result/added; worker-1 de #2 attempt | - |
| nl | 3 | worker-2 | missing | added 2->3 | 12:24:17.689 | 4211ms | 4412ms | - | -3423ms worker-1 de #3 attempt | +2363ms worker-1 de #3 result/added | +2363ms worker-1 de #3 result/added | 2: worker-1 de #2 result/added; worker-1 de #3 attempt | - |
| pl | 1 | worker-2 | missing | added 0->1 | 12:31:45.212 | 172141ms | - | 175ms | -3384ms worker-1 en_au #3 attempt | +175ms worker-2 pl #2 attempt | +1323ms worker-1 en_au #3 result/added | 5: worker-1 en_au #1 attempt; worker-1 en_au #1 result/added; worker-1 en_au #2 attempt; worker-1 en_au #2 result/added; worker-1 en_au #3 attempt | - |
| sr | 3 | worker-2 | missing | added 2->3 | 12:37:52.039 | 5898ms | 6071ms | - | -2651ms worker-1 he #1 attempt | +4703ms worker-1 he #1 result/added | -2651ms worker-1 he #1 attempt | 1: worker-1 he #1 attempt | - |
| te | 2 | worker-2 | missing | added 1->2 | 12:40:29.601 | 10812ms | 12125ms | 166ms | -6769ms worker-1 hy #1 attempt | +166ms worker-2 te #3 attempt | +3220ms worker-1 hy #1 result/added | 1: worker-1 hy #1 attempt | attempt 1: Error: An unknown error occurred. |
| te | 3 | worker-2 | missing | added 2->3 | 12:40:34.631 | 4864ms | 5030ms | - | -1645ms worker-1 hy #2 attempt | +7341ms worker-2 th #1 attempt | -1645ms worker-1 hy #2 attempt | 2: worker-1 hy #1 result/added; worker-1 hy #2 attempt | - |
| tr | 1 | worker-2 | missing | added 0->1 | 12:41:27.960 | 6344ms | - | 166ms | -6122ms worker-1 id #3 attempt | +166ms worker-2 tr #2 attempt | +1315ms worker-1 id #3 result/added | 2: worker-1 id #2 result/added; worker-1 id #3 attempt | - |
| tr | 3 | worker-2 | missing | added 2->3 | 12:41:40.213 | 6222ms | 6396ms | - | -2716ms worker-1 it #1 attempt | +4371ms worker-1 it #1 result/added | -2716ms worker-1 it #1 attempt | 1: worker-1 it #1 attempt | - |

## Present After Refresh

| Locale | Slot | Worker | Refreshed | UI result | Result time UTC | Upload duration | Previous same-locale result | Next same-locale attempt | Previous global action | Next global action | Closest other-worker action | Other-worker actions during this upload | Errors |
| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| es_419 | 2 | worker-1 | present | added 1->2 | 12:33:11.273 | 3386ms | 3558ms | 192ms | -3386ms worker-1 es_419 #2 attempt | +192ms worker-1 es_419 #3 attempt | +2706ms worker-2 ro #1 attempt | - | - |
| hy | 1 | worker-1 | present | added 0->1 | 12:40:32.821 | 9989ms | 16344ms | 165ms | -3054ms worker-2 te #3 attempt | +165ms worker-1 hy #2 attempt | +1810ms worker-2 te #3 result/added | 2: worker-2 te #2 result/added; worker-2 te #3 attempt | attempt 1: Error: An unknown error occurred. |
| hy | 2 | worker-1 | present | added 1->2 | 12:40:42.526 | 9540ms | 9705ms | 176ms | -554ms worker-2 th #1 attempt | +176ms worker-1 hy #3 attempt | -554ms worker-2 th #1 attempt | 2: worker-2 te #3 result/added; worker-2 th #1 attempt | - |
| lv | 2 | worker-2 | present | added 1->2 | 12:20:24.430 | 3994ms | 4154ms | 174ms | -3994ms worker-2 lv #2 attempt | +174ms worker-2 lv #3 attempt | +4722ms worker-1 bg #1 attempt | - | - |
| lv | 3 | worker-2 | present | added 2->3 | 12:20:30.512 | 5908ms | 6082ms | - | -1360ms worker-1 bg #1 attempt | +4420ms worker-1 bg #1 result/added | -1360ms worker-1 bg #1 attempt | 1: worker-1 bg #1 attempt | - |
| mk | 2 | worker-2 | present | added 1->2 | 12:20:51.050 | 5904ms | 6068ms | 172ms | -4702ms worker-1 bg #3 result/added | +172ms worker-2 mk #3 attempt | +2996ms worker-1 bn #1 attempt | 1: worker-1 bg #3 result/added | - |
| mk | 3 | worker-2 | present | added 2->3 | 12:20:56.679 | 5457ms | 5629ms | - | -2633ms worker-1 bn #1 attempt | +4465ms worker-1 bn #1 result/added | -2633ms worker-1 bn #1 attempt | 1: worker-1 bn #1 attempt | - |
| nl | 2 | worker-2 | present | added 1->2 | 12:24:13.277 | 6636ms | 6824ms | 201ms | -6636ms worker-2 nl #2 attempt | +201ms worker-2 nl #3 attempt | +789ms worker-1 de #2 result/added | - | - |
| pl | 2 | worker-2 | present | added 1->2 | 12:31:50.878 | 5491ms | 5666ms | 209ms | -4343ms worker-1 en_au #3 result/added | +209ms worker-2 pl #3 attempt | +3852ms worker-1 en_gb #1 attempt | 1: worker-1 en_au #3 result/added | - |
| pl | 3 | worker-2 | present | added 2->3 | 12:31:55.224 | 4137ms | 4346ms | - | -494ms worker-1 en_gb #1 attempt | +3030ms worker-1 en_gb #1 result/added | -494ms worker-1 en_gb #1 attempt | 1: worker-1 en_gb #1 attempt | - |
| pt_PT | 1 | worker-2 | present | added 0->1 | 12:32:57.328 | 7073ms | - | 161ms | -4364ms worker-1 es #3 result/added | +161ms worker-2 pt_pt #2 attempt | +3293ms worker-1 es_419 #1 attempt | 1: worker-1 es #3 result/added | - |
| pt_PT | 2 | worker-2 | present | added 1->2 | 12:33:00.552 | 3063ms | 3224ms | 170ms | -3063ms worker-2 pt_pt #2 attempt | +69ms worker-1 es_419 #1 attempt | +69ms worker-1 es_419 #1 attempt | - | - |
| pt_PT | 3 | worker-2 | present | added 2->3 | 12:33:06.109 | 5387ms | 5557ms | - | -5387ms worker-2 pt_pt #3 attempt | +1606ms worker-1 es_419 #1 result/added | +1606ms worker-1 es_419 #1 result/added | - | - |
| sr | 1 | worker-2 | present | added 0->1 | 12:37:40.268 | 7186ms | - | 161ms | -4345ms worker-1 gu #3 attempt | +161ms worker-2 sr #2 attempt | +1332ms worker-1 gu #3 result/added | 2: worker-1 gu #2 result/added; worker-1 gu #3 attempt | - |
| sr | 2 | worker-2 | present | added 1->2 | 12:37:45.968 | 5539ms | 5700ms | 173ms | -4368ms worker-1 gu #3 result/added | +173ms worker-2 sr #3 attempt | +3420ms worker-1 he #1 attempt | 1: worker-1 gu #3 result/added | - |
| te | 1 | worker-2 | present | added 0->1 | 12:39:58.692 | 7105ms | - | 168ms | -3407ms worker-1 hu #3 result/added | +168ms worker-2 te #2 attempt | -3407ms worker-1 hu #3 result/added | 1: worker-1 hu #3 result/added | - |
| tr | 2 | worker-2 | present | added 1->2 | 12:41:33.817 | 5691ms | 5857ms | 174ms | -4542ms worker-1 id #3 result/added | +174ms worker-2 tr #3 attempt | +3680ms worker-1 it #1 attempt | 1: worker-1 id #3 result/added | - |
| zh_CN | 1 | worker-2 | present | added 0->1 | 12:43:39.163 | 3870ms | - | 155ms | -3870ms worker-2 zh_cn #1 attempt | +155ms worker-2 zh_cn #2 attempt | -24162ms worker-1 kn #3 result/added | - | - |
| zh_CN | 2 | worker-2 | present | added 1->2 | 12:43:42.722 | 3404ms | 3559ms | 159ms | -3404ms worker-2 zh_cn #2 attempt | +159ms worker-2 zh_cn #3 attempt | -27721ms worker-1 kn #3 result/added | - | - |
| zh_CN | 3 | worker-2 | present | added 2->3 | 12:43:48.102 | 5221ms | 5380ms | - | -5221ms worker-2 zh_cn #3 attempt | +7009ms worker-2 zh_tw #1 attempt | -33101ms worker-1 kn #3 result/added | - | - |

## Readout

- The strongest repeatable failure shape is not just "fast next upload." Several present rows also have next attempts inside 155-209ms.
- Missing slot 1 rows frequently have the next same-locale upload attempt within 160-188ms after the slot 1 visible-count result, plus another worker either inside the upload window or within a few seconds.
- Missing final-slot rows have no next same-locale upload, but usually have another worker mutation during the upload window or close to the result.
- `zh_CN` is the cleanest successful control: every slot persisted and the nearest other-worker action was at least 24 seconds away.
- `pt_PT` is a useful mixed control: it survived despite a close `es_419` action, so close timing is not a deterministic failure by itself. It still supports a probabilistic CWS race/cooldown model rather than a simple local bug.
