// Where content.js puts its download buttons, proven with gdp-wired, and the
// shipped content.js held to the same rule on random runs. `npm run prove`.
//
// The model: one post O with a quoted post Q inside it (X renders one level of
// quote) and two unrelated posts. The page sends pointer, focus and play
// events; X also mounts videos, renders a post's button group and redraws it.
// That group is the real reply/repost/like row or, where findActionBar finds
// none, its fallback group. prev, entries and plays only count what the user
// did, so the work law can compare content.js's checks against it.
import { bool, max, nat, oneOf, proveSteps, rule, when } from 'gdp-wired';
import { FakeElement, loadContentScript } from './fake-dom.mts';

const EVENTS = [
  'pointer',
  'focus',
  'play',
  'mountO',
  'mountQ',
  'barO',
  'barQ',
  'rerenderO',
  'rerenderQ',
];
// Posts: 0 none, 1 O, 2 Q (inside O), 3 and 4 others. Bars: 0 none, 1 fallback group, 2 real row.
const [NO_BAR, FALLBACK, REAL] = [0, 1, 2];

// Every option off is content.js as shipped; each one on is a bug kept as a test.
type Variant = {
  noDupCheck?: boolean; // addButton without its "bar already has our button" check
  noDedupe?: boolean; // onActivity without its `post === lastPost` check
  playMovesLast?: boolean; // a play event updates lastPost too
  noOuterPosts?: boolean; // only the post itself gets a button, not the post quoting it
  barCanSwitch?: boolean; // X shows a fallback group first and the real row later
};

function placement(name: string, v: Variant = {}) {
  return (
    rule(name)
      .inputs({ ev: oneOf(...EVENTS), t: nat, real: bool })
      .state({
        last: 0,
        oVid: bool.from(false),
        qVid: bool.from(false),
        oBar: 0,
        qBar: 0,
        oF: 0,
        oR: 0,
        qF: 0,
        qR: 0,
        scans: 0,
        prev: 0,
        entries: 0,
        plays: 0,
      })
      // A play comes from a mounted video.
      .assume(({ ev, t, oVid, qVid }) =>
        t.atMost(4).and(ev.is('play').implies(t.eq(1).implies(oVid).and(t.eq(2).implies(qVid))))
      )
      .flags(({ ev, t, last, oVid, qVid, oBar, qBar, oF, oR, qF, qR }) => {
        const isNP = ev.is('pointer').or(ev.is('focus'));
        const isPlay = ev.is('play');
        const moved = v.noDedupe ? isNP : isNP.and(t.eq(last).not());
        const scanning = moved.or(isPlay).and(t.atLeast(1));
        const scanO = scanning.and(v.noOuterPosts ? t.eq(1) : t.eq(1).or(t.eq(2)));
        const scanQ = scanning.and(t.eq(2));
        const freeO = v.noDupCheck ? oBar.atLeast(0) : when(oBar.eq(REAL), oR, oF).eq(0);
        const freeQ = v.noDupCheck ? qBar.atLeast(0) : when(qBar.eq(REAL), qR, qF).eq(0);
        const addO = scanO.and(oVid.or(qVid), oBar.atLeast(FALLBACK), freeO);
        const addQ = scanQ.and(qVid, qBar.atLeast(FALLBACK), freeQ);
        return {
          isNP,
          isPlay,
          scanning,
          addOF: addO.and(oBar.eq(FALLBACK)),
          addOR: addO.and(oBar.eq(REAL)),
          addQF: addQ.and(qBar.eq(FALLBACK)),
          addQR: addQ.and(qBar.eq(REAL)),
        };
      })
      .step((s) => {
        const { ev, t, real, isNP, isPlay, scanning } = s;
        const bar = (b: typeof s.oBar, event: string) =>
          v.barCanSwitch
            ? when(ev.is(event), when(real, REAL, max(b, FALLBACK)), b)
            : when(ev.is(event).and(b.eq(NO_BAR)), when(real, REAL, FALLBACK), b);
        const count = (n: typeof s.oF, add: typeof isNP, redraw: string) =>
          when(ev.is(redraw), 0, n.plus(when(add, 1, 0)));
        return {
          last: when(v.playMovesLast ? isNP.or(isPlay) : isNP, t, s.last),
          oVid: s.oVid.or(ev.is('mountO')),
          qVid: s.qVid.or(ev.is('mountQ')),
          oBar: bar(s.oBar, 'barO'),
          qBar: bar(s.qBar, 'barQ'),
          oF: count(s.oF, s.addOF, 'rerenderO'),
          oR: count(s.oR, s.addOR, 'rerenderO'),
          qF: count(s.qF, s.addQF, 'rerenderQ'),
          qR: count(s.qR, s.addQR, 'rerenderQ'),
          scans: s.scans.plus(when(scanning, 1, 0)),
          prev: when(isNP, t, s.prev),
          entries: s.entries.plus(when(isNP.and(t.eq(s.prev).not(), t.atLeast(1)), 1, 0)),
          plays: s.plays.plus(when(isPlay.and(t.atLeast(1)), 1, 0)),
        };
      })
  );
}

const NAMES = {
  onePerPost: 'a post shows at most one download button',
  work: 'checks never exceed posts entered plus videos played',
  entry: 'entering a post or playing its video leaves a button on it and on the post quoting it',
  gap: 'any pointer or focus move in a video post leaves it a button',
};

function lawsOf(r: ReturnType<typeof placement>) {
  // A post with a video and a bar has a button in the bar findActionBar returns.
  const shows = (vid: any, bar: any, fallback: any, realRow: any) =>
    vid.and(bar.atLeast(FALLBACK)).implies(when(bar.eq(REAL), realRow, fallback).atLeast(1));
  const showsO = (a: any) => shows(a.oVid.or(a.qVid), a.oBar, a.oF, a.oR);
  const showsQ = (a: any) => shows(a.qVid, a.qBar, a.qF, a.qR);
  return {
    // Helpers the main laws need, stated so the prover runs alone.
    barKinds: r.law('a bar is none, the fallback group or the real row', ({ oBar, qBar }) =>
      oBar.atMost(REAL).and(qBar.atMost(REAL))
    ),
    barsAgree: r.law(
      'buttons sit only in the bar findActionBar returns now',
      ({ oBar, qBar, oF, oR, qF, qR }) =>
        oBar
          .eq(REAL)
          .implies(oF.eq(0))
          .and(
            oBar.atMost(FALLBACK).implies(oR.eq(0)),
            oBar.eq(NO_BAR).implies(oF.eq(0)),
            qBar.eq(REAL).implies(qF.eq(0)),
            qBar.atMost(FALLBACK).implies(qR.eq(0)),
            qBar.eq(NO_BAR).implies(qF.eq(0))
          )
    ),
    lastIsPrev: r.law('lastPost is the post of the last pointer or focus event', ({ last, prev }) =>
      last.eq(prev)
    ),
    // The laws that matter.
    onePerPost: r.law(NAMES.onePerPost, ({ oF, oR, qF, qR }) =>
      oF.plus(oR).atMost(1).and(qF.plus(qR).atMost(1))
    ),
    work: r.law(NAMES.work, ({ scans, entries, plays }) => scans.atMost(entries.plus(plays))),
    entry: r.stepLaw(
      NAMES.entry,
      ({ t }, a) => showsO(a).and(t.eq(2).implies(showsQ(a))),
      ({ scanning, t }) => scanning.and(t.eq(1).or(t.eq(2)))
    ),
    // A known gap, kept refuted on purpose.
    gap: r.stepLaw(
      NAMES.gap,
      (_e, a) => showsO(a),
      ({ isNP, t }) => isNP.and(t.eq(1))
    ),
  };
}

// The shipped content.js on a fake page, read back as the model's state.
function shippedPage() {
  const script = loadContentScript();
  const body = new FakeElement('body');
  const outside = body.appendChild(new FakeElement('div'));
  const makePost = (parent: FakeElement) => {
    const post = parent.appendChild(new FakeElement('article', { 'data-testid': 'tweet' }));
    post.appendChild(new FakeElement('div')); // its text: where the pointer lands
    return post;
  };
  const o = makePost(body);
  const q = makePost(o.appendChild(new FakeElement('div'))); // the quote card
  const posts = [null, o, q, makePost(body), makePost(body)];
  const videos = new Map<FakeElement | null, FakeElement>(); // a post's own video
  const bars = new Map<FakeElement, { el: FakeElement; level: number }>();
  let scans = 0;

  const makeBar = (level: number) => {
    const group = new FakeElement('div', { role: 'group' });
    if (level === REAL) for (let i = 0; i < 4; i++) group.appendChild(new FakeElement('button'));
    else group.appendChild(new FakeElement('div'));
    return group;
  };
  const mount = (post: FakeElement | null) => {
    if (!videos.has(post))
      videos.set(post, (post ?? outside).appendChild(new FakeElement('video')));
  };

  return {
    apply({ ev, t, real }: { ev: string; t: number; real: boolean }) {
      const post = posts[t];
      if (ev === 'pointer' || ev === 'focus') {
        const type = ev === 'pointer' ? 'pointerover' : 'focusin';
        if (script.fire(type, post?.children[0] ?? outside)) scans++;
      } else if (ev === 'play') {
        mount(post); // the rule assumes O and Q already have theirs
        if (script.fire('play', videos.get(post)!)) scans++;
      } else if (ev === 'mountO' || ev === 'mountQ') {
        mount(ev === 'mountO' ? o : q);
      } else if (ev === 'barO' || ev === 'barQ') {
        const owner = ev === 'barO' ? o : q;
        const level = real ? REAL : FALLBACK;
        if (!bars.has(owner)) bars.set(owner, { el: owner.appendChild(makeBar(level)), level });
      } else {
        const bar = bars.get(ev === 'rerenderO' ? o : q);
        if (bar) {
          const fresh = makeBar(bar.level);
          bar.el.replaceWith(fresh);
          bar.el = fresh;
        }
      }
    },
    state() {
      const ours = (owner: FakeElement) => {
        const bar = bars.get(owner);
        const n = bar ? bar.el.children.filter((el) => script.isOurs(el)).length : 0;
        const level = bar?.level ?? NO_BAR;
        return { level, fallback: level === FALLBACK ? n : 0, realRow: level === REAL ? n : 0 };
      };
      const [os, qs] = [ours(o), ours(q)];
      const all = body.querySelectorAll('button').filter((el) => script.isOurs(el)).length;
      if (all !== os.fallback + os.realRow + qs.fallback + qs.realRow) {
        throw new Error('content.js put a button outside a post bar');
      }
      return {
        last: posts.indexOf(script.lastPost()),
        oVid: videos.has(o),
        qVid: videos.has(q),
        oBar: os.level,
        qBar: qs.level,
        oF: os.fallback,
        oR: os.realRow,
        qF: qs.fallback,
        qR: qs.realRow,
        scans,
      };
    },
  };
}

const failures: string[] = [];
const report = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `\n       ${detail}` : ''}`);
  if (!ok) failures.push(label);
};
const runOf = (verdict: any) =>
  (verdict.run?.trace ?? [])
    .map((s: any) => {
      const ev = typeof s.ev === 'number' ? EVENTS[s.ev] : s.ev;
      if (ev.startsWith('bar')) return `${ev}(${s.real ? 'real' : 'fallback'})`;
      return ['pointer', 'focus', 'play'].includes(ev) ? `${ev}@${s.t}` : ev;
    })
    .join(' → ');
const proven = (label: string, verdict: any) =>
  report(label, verdict.proven && verdict.checked, verdict.proven ? '' : verdict.goal);
// Refuted by a real run from the start, at the named law (not merely unproven).
const refuted = (label: string, verdict: any, law: string) =>
  report(
    label,
    !verdict.proven && Boolean(verdict.run) && String(verdict.goal).startsWith(law),
    verdict.run ? `run: ${runOf(verdict)}` : `not refuted by a run: ${verdict.goal}`
  );

const shipped = placement('button placement');
const L = lawsOf(shipped);
const laws = [L.barKinds, L.barsAgree, L.lastIsPrev, L.onePerPost, L.work];

proven(
  `proven: ${NAMES.onePerPost}; ${NAMES.work}; ${NAMES.entry}`,
  proveSteps(shipped, laws, [L.entry], { search: false })
);
const cross = shipped.crossCheck(laws, [L.entry]);
report(`laws replay as stated (${cross.checked} checks)`, !cross.failure, cross.failure);

// content.js itself, on random runs and on the runs that matter.
const page = { current: shippedPage() };
const conform = shipped.compare(
  {
    init: () => {
      page.current = shippedPage();
      return page.current.state();
    },
    step: (_params, _state, request) => {
      page.current.apply(request as { ev: string; t: number; real: boolean });
      return page.current.state();
    },
  },
  {
    trials: 400,
    depth: 30,
    draw: (rand: (k: number) => number) => ({
      ev: EVENTS[rand(EVENTS.length)],
      t: rand(5),
      real: rand(2) === 1,
    }),
    edges: [
      { ev: 'barO', t: 0, real: true },
      { ev: 'pointer', t: 1, real: false },
      { ev: 'mountO', t: 0, real: false },
      { ev: 'pointer', t: 1, real: false },
      { ev: 'barQ', t: 0, real: false },
      { ev: 'mountQ', t: 0, real: false },
      { ev: 'pointer', t: 2, real: false },
      { ev: 'play', t: 2, real: false },
      { ev: 'rerenderO', t: 0, real: false },
      { ev: 'focus', t: 1, real: false },
      { ev: 'pointer', t: 3, real: false },
      { ev: 'play', t: 0, real: false },
      { ev: 'pointer', t: 3, real: false },
    ],
  } as any
);
report(
  `shipped content.js matches the rule (${conform.checked} fields compared)`,
  !conform.failure,
  conform.failure
);

// The known gap: a video mounted, or a bar redrawn, after the pointer entered.
// The next play or re-entry adds the button.
refuted(`known gap: ${NAMES.gap}`, proveSteps(shipped, [], [L.gap]), NAMES.gap);

// The assumption onePerPost rests on: findActionBar never moves from a fallback
// group to the real row for the same post.
const switching = placement('bar can switch', { barCanSwitch: true });
refuted(
  'assumption: if the bar can switch, a post can show two buttons',
  proveSteps(switching, [lawsOf(switching).onePerPost], []),
  NAMES.onePerPost
);

// Broken variants, each refused by the law that rules it out.
const broken: [string, Variant, (l: ReturnType<typeof lawsOf>) => [any[], any[]], string][] = [
  [
    'without the duplicate check',
    { noDupCheck: true },
    (l) => [[l.onePerPost], []],
    NAMES.onePerPost,
  ],
  ['without the lastPost check', { noDedupe: true }, (l) => [[l.work], []], NAMES.work],
  ['with play moving lastPost', { playMovesLast: true }, (l) => [[l.work], []], NAMES.work],
  ['without buttons on quoting posts', { noOuterPosts: true }, (l) => [[], [l.entry]], NAMES.entry],
];
for (const [label, variant, pick, law] of broken) {
  const r = placement(label, variant);
  const [ls, steps] = pick(lawsOf(r));
  refuted(`broken ${label}: refused`, proveSteps(r, ls, steps), law);
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
}
