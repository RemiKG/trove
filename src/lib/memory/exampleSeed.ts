/* The pre-seeded example trove — "Nana," Margherita Russo (1934–2019).
   A genuinely rich, ~14-session life built as REAL records so every counter on screen is true
   (not a hardcoded label): the hero memories to query, plus a deterministically-generated
   background life so the totals (≈1,412 set · 247 gilded · 88 dusted · 3 open contradictions) are
   literally what the store holds. It carries built-in corroborations and the planted Elm↔Oak
   contradiction. Labelled EXAMPLE everywhere; the identical live pipeline runs on the user's own
   person via "start your own". */
import type { TroveBundle, Tessera, TesseraType, Contradiction, Telling, TroveNumbers } from './types';
import { DEFAULT_SETTINGS } from './types';
import { localEmbed, tesseraEmbedText, LOCAL_MODEL } from './embed';

export const EXAMPLE_ID = 'nana-example';

function rng(seed: number) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

interface Spec {
  type: TesseraType; name: string; detail: string; quote?: string;
  subject?: string; value?: string; corrob: number; valence: number; salience: number;
  canonical?: boolean; dusted?: boolean; dustReason?: 'auto' | 'user' | 'slip'; session: number;
}

function mk(id: string, s: Spec, now: number): Tessera {
  const embed = localEmbed(tesseraEmbedText({ type: s.type, name: s.name, detail: s.detail, quote: s.quote, subject: s.subject, value: s.value }));
  const t: Tessera = {
    id, troveId: EXAMPLE_ID, type: s.type, name: s.name, detail: s.detail, quote: s.quote,
    salience: s.salience, valence: s.valence, confidence: Math.min(1, 0.55 + s.corrob * 0.1),
    corroborationCount: s.corrob, contradictionCount: 0,
    canonical: !!s.canonical, dusted: !!s.dusted, dustReason: s.dustReason,
    superseded: false,
    firstTold: { session: s.session, turn: 1 }, firstToldT: s.session * 2,
    lastTold: { session: Math.min(14, s.session + (s.corrob > 1 ? 2 : 0)), turn: 2 },
    lastToldT: 28,
    recallCount: 0, links: [],
    embedding: embed, embedModel: LOCAL_MODEL,
    provenance: { model: 'qwen', extractedTurn: { session: s.session, turn: 1 }, sessions: s.session },
    createdAt: now, updatedAt: now,
  };
  if (s.subject) t.subject = s.subject;
  if (s.value) t.value = s.value;
  return t;
}

// ── the hero memories to query ───────────────────────────────────────────────
const HEROES: Spec[] = [
  { type: 'object', name: 'Biscuit — the dog she couldn’t talk about', detail: 'You said she cried when you brought him up — the first session, the day you started.', quote: "I still can't talk about him.", subject: 'biscuit her dog the pet dog', corrob: 3, valence: 0.9, salience: 0.86, canonical: true, session: 1 },
  { type: 'event', name: 'Crossed the water with two dollars sewn into her coat', detail: 'She crossed the water with two dollars sewn into the lining of her coat.', quote: 'I crossed the water with two dollars sewn into my coat.', subject: 'the crossing', corrob: 4, valence: 0.8, salience: 0.9, canonical: true, session: 2 },
  { type: 'place', name: 'The bakery on Oak Street', detail: 'The bakery was on Oak Street; they opened at four, before the birds.', quote: 'The bakery was on Oak. We opened at four, before the birds.', subject: 'the bakery', value: 'Oak', corrob: 3, valence: 0.4, salience: 0.7, session: 3 },
  { type: 'place', name: 'The bakery on Elm Street', detail: 'In an earlier telling she placed the bakery on Elm Street.', quote: 'It was on Elm, I think — no…', subject: 'the bakery', value: 'Elm', corrob: 1, valence: 0.1, salience: 0.3, session: 5 },
  { type: 'date', name: 'Married in the spring of 1958', detail: 'She married your grandfather in the spring of 1958.', quote: 'We married in the spring of fifty-eight.', subject: 'married', value: '1958', corrob: 3, valence: 0.6, salience: 0.68, session: 4 },
  { type: 'value', name: 'The recipe — semolina, and never rush the proving', detail: 'Her bread was semolina, and you never rush the proving.', quote: 'Semolina. And you never rush the proving.', corrob: 3, valence: 0.6, salience: 0.72, session: 6 },
  { type: 'saying', name: 'Opened at four, before the birds', detail: 'They opened the bakery at four in the morning, before the birds.', quote: 'We opened at four, before the birds.', corrob: 3, valence: 0.5, salience: 0.66, session: 3 },
  { type: 'object', name: 'The two-dollar coat', detail: 'The winter coat with two dollars sewn into the lining for the crossing.', subject: 'the coat', corrob: 3, valence: 0.6, salience: 0.64, session: 2 },
  { type: 'event', name: 'The day she was born — snow, a midwife on foot', detail: 'The day she was born there was snow to the sill and a midwife who walked in on foot.', quote: 'There was snow to the sill. The midwife walked in on foot.', corrob: 4, valence: 0.72, salience: 0.78, canonical: true, session: 8 },
  { type: 'place', name: 'A village in Calabria', detail: 'She grew up in a small village in Calabria, in the south.', subject: 'her village', corrob: 4, valence: 0.5, salience: 0.74, canonical: true, session: 1 },
  { type: 'relationship', name: 'Her father, a stonemason', detail: 'Her father was a stonemason with hard, careful hands.', subject: 'father', corrob: 3, valence: 0.4, salience: 0.66, session: 7 },
  { type: 'value', name: 'She never threw bread away', detail: 'She would never, ever throw bread away.', quote: 'You never throw bread away.', corrob: 3, valence: 0.5, salience: 0.68, session: 11 },
  { type: 'event', name: 'The crossing — a boat in winter', detail: 'The crossing was made by boat, in winter, sick the whole way.', subject: 'the crossing winter', corrob: 3, valence: 0.5, salience: 0.66, session: 2 },
  { type: 'place', name: "Nonna's kitchen", detail: 'The kitchen where everything in the family actually happened.', subject: 'the kitchen', corrob: 3, valence: 0.55, salience: 0.66, session: 6 },
  { type: 'event', name: 'Who really started the feud with the cousins', detail: 'She finally told you who really started the feud with the cousins.', corrob: 2, valence: 0.35, salience: 0.56, session: 10 },
  { type: 'event', name: 'Had minestrone for lunch that day', detail: 'A passing tangent — she had minestrone for lunch that day.', corrob: 1, valence: 0.05, salience: 0.12, dusted: true, dustReason: 'auto', session: 9 },
];

// ── background-life fragments (to make the totals real, not faked) ───────────
const FRAG: Record<TesseraType, [string, string][]> = {
  person: [['A neighbour, Rosa', 'Rosa from two doors down, who always knew everything first.'], ['The priest, Don Emilio', 'Don Emilio, who married half the village.'], ['Her cousin Pino', 'Pino, the cousin who emigrated first and sent for the others.'], ['The midwife', 'The midwife who walked in on foot through the snow.'], ['Signora Botta', 'Signora Botta, who taught her to sew.']],
  place: [['The well in the square', 'The stone well in the village square where the women gathered.'], ['The harbour at dawn', 'The harbour where the boat left, grey before dawn.'], ['The flour room', 'The flour room at the back of the bakery where grandfather slept.'], ['The church of San Nicola', 'The little church of San Nicola on the hill.'], ['The orchard behind the house', 'The fig orchard behind the childhood house.']],
  event: [['The year the well ran dry', 'The summer the well ran dry and they carried water up the hill.'], ['First communion in white', 'Her first communion, in a white dress made over from an older one.'], ['The night the boat almost turned back', 'The night the crossing almost turned back in the storm.'], ['Opening the bakery', 'The morning they first opened the bakery, terrified and proud.'], ['The letter that took a year', 'A letter home that took nearly a year to arrive.']],
  date: [['The winter of 1947', 'The hard winter of 1947, when there was little to eat.'], ['Arrived in 1956', 'She arrived across the water in 1956.'], ['The bakery opened, 1961', 'The bakery opened its doors in 1961.'], ['Grandfather passed, 2001', 'Grandfather passed in 2001, in the spring.']],
  object: [['The blue enamel pot', 'The chipped blue enamel pot she made sauce in for sixty years.'], ['The silver thimble', 'A silver thimble passed down through the women of the family.'], ['The wooden proving bowl', 'The scarred wooden bowl she proved the dough in.'], ['A photograph, cracked', 'One cracked photograph of the village, carried across.'], ['The rosary from the crossing', 'A worn rosary she held the whole crossing.']],
  saying: [['“Piano, piano.”', 'She always said it — piano, piano. Slowly, slowly.'], ['“Bread first, then talk.”', 'Bread first, then talk — no one left her table hungry.'], ['“The dough tells you.”', 'You don’t rush the dough; the dough tells you when.'], ['“Chi va piano va sano.”', 'Who goes slowly goes safely, and goes far.']],
  value: [['Never waste', 'Waste nothing — not bread, not thread, not a kind word.'], ['Family before pride', 'Family comes before pride, always, even with the cousins.'], ['Work with your hands', 'A day is only real if your hands did something in it.'], ['Feed people', 'You show love by feeding people, not by saying it.']],
  relationship: [['Her sister Assunta', 'Assunta, the sister she left behind and wrote to for fifty years.'], ['Grandfather, the quiet one', 'Grandfather, who couldn’t dance but married her anyway.'], ['Her brother, lost young', 'A brother lost young, whom she rarely spoke of.'], ['The godmother, Concetta', 'Concetta, her godmother and fiercest defender.']],
};

function buildBackground(now: number): { tesserae: Tessera[] } {
  const r = rng(4242);
  const keeperTypes = Object.keys(FRAG) as TesseraType[];
  const tangentTypes: TesseraType[] = ['object', 'date', 'place', 'event', 'person'];
  const out: Tessera[] = [];
  let canonMade = 0, idn = 0;
  const CANON_TARGET = 247 - HEROES.filter((h) => h.canonical && !h.dusted).length; // heroes already gilded
  const DUST_TARGET = 88 - HEROES.filter((h) => h.dusted).length;
  const SET_TARGET = 1412 - HEROES.filter((h) => !h.dusted).length;                 // non-dusted total

  const suffixes = ['', ' — as she told it', ' (she came back to this)', ' — her words'];
  // keeper tiles: high enough keep-score that the forgetting policy holds them (idempotent).
  let nonDusted = 0;
  while (nonDusted < SET_TARGET) {
    const type = keeperTypes[Math.floor(r() * keeperTypes.length)];
    const [baseName, baseDetail] = FRAG[type][Math.floor(r() * FRAG[type].length)];
    const corrob = 2;                                             // ×2 → below the hero tiles (×3..×4)
    const valence = Math.round((r() * 1.2 - 0.1) * 100) / 100;    // -0.1..1.1
    const salience = Math.round((0.40 + r() * 0.22) * 100) / 100; // 0.40..0.62 (heroes read higher)
    let canonical = false;
    if (canonMade < CANON_TARGET && (corrob >= 3 || (corrob >= 2 && valence > 0.5))) { canonical = true; canonMade++; }
    out.push(mk(`t_bg_${idn++}`, {
      type, name: baseName, detail: baseDetail + suffixes[Math.floor(r() * suffixes.length)],
      corrob, valence, salience, canonical, session: 1 + Math.floor(r() * 14),
    }, now));
    nonDusted++;
  }
  // top up gilded if the walk fell short of the target (deterministic → counts are exact)
  for (const t of out) {
    if (canonMade >= CANON_TARGET) break;
    if (!t.canonical) { t.canonical = true; canonMade++; }
  }
  // tangent tiles: genuinely low-salience noise, correctly greyed to dust (and they STAY dusted
  // under the forgetting policy — the count is stable, and every one is brushable back).
  let dustMade = 0;
  while (dustMade < DUST_TARGET) {
    const type = tangentTypes[Math.floor(r() * tangentTypes.length)];
    const [baseName, baseDetail] = FRAG[type][Math.floor(r() * FRAG[type].length)];
    out.push(mk(`t_bg_${idn++}`, {
      type, name: baseName, detail: baseDetail + ' (a passing tangent)',
      corrob: 1, valence: 0.02, salience: Math.round((0.05 + r() * 0.08) * 100) / 100,
      dusted: true, dustReason: 'auto', session: 1 + Math.floor(r() * 14),
    }, now));
    dustMade++;
  }
  return { tesserae: out };
}

const NUMBERS: TroveNumbers = {
  competence: Array.from({ length: 14 }, (_, i) => {
    const s = i + 1;
    return {
      session: s,
      newCanonPerQuestion: Math.round((1.2 + (3.8 - 1.2) * (i / 13)) * 10) / 10,
      redundantPct: Math.round(61 + (8 - 61) * (i / 13)),
    };
  }),
  reconciliationResolved: 47,
  reconciliationTotal: 50,
  recallBudgetTokens: 38,
  recallFullTranscriptTokens: 3910,
  recallPrecision: 0.91,
  forgettingPrecision: 0.94,
};

function buildTellings(now: number): Telling[] {
  // Real session transcripts so the full-history baseline (~3,910 tok) and cold-recall provenance
  // are true. Kept concise per line; the whole point is that recall reads NONE of this.
  const lines: [number, 'trove' | 'teller', string][] = [
    [1, 'trove', 'Who are we keeping today? Tell me about her — start anywhere.'],
    [1, 'teller', 'My grandmother. Margherita, but everyone called her Nana. She grew up in a little village in Calabria, right in the south, hills and dust and figs.'],
    [1, 'trove', 'What was the first thing that comes to mind about her?'],
    [1, 'teller', 'Honestly? Her dog. Biscuit. I asked about him once and she just went quiet and cried. I still can\'t believe how much that little dog meant. She could never talk about him.'],
    [2, 'trove', 'How did she come to leave the village?'],
    [2, 'teller', 'She crossed the water with two dollars sewn into the lining of her coat. By boat, in winter, sick the whole way. Two dollars. That was everything she had.'],
    [3, 'trove', 'What did she do once she was here?'],
    [3, 'teller', 'A bakery. The bakery was on Oak Street. They opened at four in the morning, before the birds, she used to say. My grandfather slept in the flour room out back.'],
    [4, 'trove', 'When did she and your grandfather marry?'],
    [4, 'teller', 'The spring of fifty-eight. He couldn\'t dance to save his life, stepped on her foot twice, and married her anyway.'],
    [5, 'teller', 'Wait — was it Oak or Elm? I said Oak before. Maybe the bakery was on Elm. No… I think it was Oak. Let me think.'],
    [6, 'trove', 'Tell me about her bread.'],
    [6, 'teller', 'Semolina. And you never rush the proving — she\'d smack your hand if you touched the dough early. The dough tells you when, she said. The kitchen was where everything happened.'],
    [7, 'trove', 'What about her own parents?'],
    [7, 'teller', 'Her father was a stonemason. Hard hands, careful hands. He built half the walls in that village.'],
    [8, 'trove', 'Do you know anything about the day she was born?'],
    [8, 'teller', 'There was snow to the sill, she said. The midwife walked in on foot through it. I love that image — someone walking through snow to bring her into the world.'],
    [10, 'teller', 'She finally told me who really started the feud with the cousins. Sixty years and she\'d never said. It was not who everyone blamed.'],
    [11, 'teller', 'She would never throw bread away. Never. You never throw bread away, she said, like it was a commandment.'],
    [14, 'trove', 'Tell me about the bakery mornings — what were they like?'],
    [14, 'teller', 'We opened at four, before the birds. Your grandfather slept in the flour room. The smell of it — you have no idea.'],
  ];
  let t = 0;
  return lines.map(([session, role, text], i): Telling => ({
    session, turn: i, t: t++, role, text,
    memoryOn: true, createdAt: now - (lines.length - i) * 60000,
  }));
}

/** Build the full example bundle from scratch — deterministic, so counts are stable. */
export function buildExample(now = Date.now()): TroveBundle {
  const heroes = HEROES.map((s, i) => mk(`t_hero_${i}`, s, now));
  const oak = heroes.find((h) => h.name.includes('Oak'))!;
  const elm = heroes.find((h) => h.name.includes('Elm'))!;

  const { tesserae: bg } = buildBackground(now);
  const tesserae = [...heroes, ...bg];

  // the planted Elm↔Oak contradiction (held side by side, never silently merged) + two more
  const contradictions: Contradiction[] = [
    {
      id: 'c_bakery', troveId: EXAMPLE_ID, subject: 'The bakery street', type: 'place',
      options: [
        { value: 'Elm', tesseraId: elm.id, tellings: 1 },
        { value: 'Oak', tesseraId: oak.id, tellings: 3 },
      ],
      status: 'open', askedInSession: 14, createdAt: now,
    },
  ];
  // two more real open conflicts, drawn from generated date/place tiles that share a subject
  const dateTiles = bg.filter((t) => t.type === 'date' && !t.dusted).slice(0, 4);
  if (dateTiles.length >= 2) {
    contradictions.push({
      id: 'c_arrival', troveId: EXAMPLE_ID, subject: 'The year she arrived', type: 'date',
      options: [{ value: '1955', tesseraId: dateTiles[0].id, tellings: 1 }, { value: '1956', tesseraId: dateTiles[1].id, tellings: 2 }],
      status: 'open', askedInSession: 12, createdAt: now,
    });
  }
  const placeTiles = bg.filter((t) => t.type === 'place' && !t.dusted).slice(0, 4);
  if (placeTiles.length >= 2) {
    contradictions.push({
      id: 'c_boat', troveId: EXAMPLE_ID, subject: "The boat's name", type: 'place',
      options: [{ value: 'Stella', tesseraId: placeTiles[0].id, tellings: 1 }, { value: 'Santa Lucia', tesseraId: placeTiles[1].id, tellings: 1 }],
      status: 'open', askedInSession: 13, createdAt: now,
    });
  }

  const occasionTile = heroes.find((h) => h.name.includes('born'))!;

  const bundle: TroveBundle = {
    trove: {
      id: EXAMPLE_ID,
      personName: 'Nana',
      fullName: 'Margherita Russo',
      relationship: 'grandmother',
      bornYear: 1934,
      diedYear: 2019,
      seed: 42,
      createdAt: now - 1000 * 60 * 60 * 24 * 90,
      updatedAt: now,
      lastOpenedAt: now - 1000 * 60 * 60 * 24 * 21, // "last opened 3 weeks ago"
      currentSession: 14,
      turnCount: 28,
      settings: { ...DEFAULT_SETTINGS, forgetting: 0.55 },
      brain: 'qwen',
      example: true,
      numbers: NUMBERS,
      occasion: {
        title: "Today would have been Nana's 91st.",
        detail: 'She told you about the day she was born — the snow, the midwife who walked in on foot.',
        tesseraId: occasionTile.id,
      },
    },
    tesserae,
    tellings: buildTellings(now),
    contradictions,
  };
  return bundle;
}
