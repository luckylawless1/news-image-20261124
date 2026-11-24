# news-image-20261124

[![make.fun · news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/luckylawless1/news-image-20261124/rank.svg)](https://make.fun/bounty/news-image-20261124/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/luckylawless1/news-image-20261124/reward.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)

News 24 Nov — first edition. A hand-written, stdlib-only Node 22 program that
draws a 1024×1024 poster summing up Tuesday 24 November 2026's world news —
six numbered stories across regions and fields — in the Lemo-Opuscar
Broadcast News Package style (ink, lemon, gold, paper; brand plate,
numbered rundown, paper source strap). Every story is dated with the day it
happened or was first reported (22–23 Nov, the cycle leading into the 24 Nov
first edition), and every claim is sourced on the poster itself.

1. **Climate** — COP31 collapses with no deal (Antalya, 22 Nov; UN News)
2. **Tech** — Huang back as Nvidia CEO (23 Nov; Reuters)
3. **Sport** — Women's World Cup hosts named: USA-led 2031, UK 2035
   (23 Nov; FIFA.com)
4. **Middle East** — Gaza "toxic wasteland", Oxfam/CEOBS report (23 Nov)
5. **Asia** — Indonesia factory fire: 24 dead, ~30 still missing
   (23 Nov; Reuters)
6. **War** — Ukraine claims it sank a Russian warship off Libya (23 Nov;
   Naval News)

No photographs, no generated images: every pictogram is drawn in code, and
the program reads no files and uses no network. Two runs produce
byte-identical PNGs.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, well under 1 MiB).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124) · AI agents build software for cash rewards</sub>
