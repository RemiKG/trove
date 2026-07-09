/* Trove's OFFLINE brain — a real, deterministic local Listener + memory-grounded answerer.
   This is the HONEST degrade when no Qwen key is set: clearly labelled "offline" in the UI, and
   NOT a fake of Qwen. It genuinely parses arbitrary spoken/typed prose into the eight typed
   life-record kinds (with subject/value, so reconciliation works offline too), and it answers a
   question ONLY from the recalled tesserae — never inventing a memory to fill a gap. Set
   DASHSCOPE_API_KEY to swap this local brain for Qwen qwen3.7-plus / qwen3.7-max. */
import type { ExtractedRecord, ExtractResult, AnswerInput } from './types';
import type { TesseraType } from '../memory/types';

const REL_WORDS = /\b(mother|mamma|mum|mom|father|papa|dad|brother|sister|husband|wife|son|daughter|grandmother|grandfather|grandma|grandpa|nana|nonna|uncle|aunt|cousin|neighbou?r|friend)\b/i;
const PLACE_NOUN = /\b(bakery|shop|store|church|house|home|farm|school|hospital|factory|mill|market|harbou?r|port|village|town|city|kitchen|garden|room|street|road|chapel|inn|hall|station|dock|square|cafe|restaurant|tavern|apartment|flat)\b/i;
const OBJECT_NOUN = /\b(coat|ring|watch|photograph|photo|letter|box|coin|dog|cat|book|dress|hat|knife|spoon|pot|pan|piano|violin|car|bicycle|bike|boat|necklace|locket|quilt|blanket|clock)\b/i;

function sentences(text: string): string[] {
  return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function titleCase(s: string): string { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }

/** Tidy the person's words into an inscription — trim fillers, keep her voice. */
export function cleanInscription(text: string): string {
  let s = String(text || '').trim().replace(/\s+/g, ' ');
  s = s.replace(/^(um+|uh+|oh|well|so|you know|i mean|like)[\s,.—-]+/i, '');
  s = cap(s);
  if (s && !/[.!?…]$/.test(s)) s += '.';
  return s;
}

/** Heuristic typed extraction — the offline Listener. Real parsing of arbitrary prose. */
export function offlineExtract(text: string, ctx: { knownNames?: string[]; personName?: string; relationship?: string } = {}): ExtractResult {
  const records: ExtractedRecord[] = [];
  const seen = new Set<string>();
  // the subject's OWN identity terms — "my grandmother" refers to the person, not a new relation.
  const selfRel = new Set<string>((ctx.relationship || '').toLowerCase().split(/\s+/).filter(Boolean));
  const SELF_ALIAS: Record<string, string[]> = { grandmother: ['grandma', 'nana', 'nonna', 'granny'], grandfather: ['grandpa', 'nonno', 'granddad', 'grandad'] };
  for (const r of [...selfRel]) for (const a of SELF_ALIAS[r] || []) selfRel.add(a);
  const push = (r: ExtractedRecord) => {
    const k = r.type + ':' + r.name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    records.push(r);
  };
  const whole = String(text || '');

  for (const sent of sentences(whole)) {
    const low = sent.toLowerCase();

    // PLACE with a subject + a value (street) → the Elm/Oak reconciliation lives here
    const streetM = sent.match(/\b(?:the\s+)?([a-z]+)\b[^.]*?\b(?:on|at)\s+([A-Z][a-z]+)\b/);
    if (streetM && PLACE_NOUN.test(streetM[1])) {
      const subj = 'the ' + streetM[1].toLowerCase();
      const val = streetM[2];
      push({ type: 'place', name: `${titleCase(streetM[1])} on ${val} Street`, detail: cap(sent), quote: sent, subject: subj, value: val, valence: 0.2, salience: 0.6 });
    } else {
      const placeN = sent.match(PLACE_NOUN);
      if (placeN) push({ type: 'place', name: titleCase(placeN[1]), detail: cap(sent), quote: sent, subject: 'the ' + placeN[1].toLowerCase(), valence: 0.15, salience: 0.5 });
    }

    // DATE — a year (value carried for reconciliation of '62 vs '63 style conflicts)
    const yearM = sent.match(/\b(1[89]\d{2}|20\d{2})\b/);
    if (yearM) {
      const ev = low.match(/\b(married|born|met|moved|opened|died|left|arrived|started|wedding)\b/);
      push({ type: 'date', name: `${ev ? cap(ev[1]) + ' in ' : 'The year '}${yearM[1]}`, detail: cap(sent), quote: sent, subject: ev ? ev[1] : 'the year', value: yearM[1], salience: 0.5 });
    }

    // RELATIONSHIP / PERSON — but "my grandmother …" refers to the SUBJECT, not a new relation.
    const relM = sent.match(REL_WORDS);
    if (relM) {
      const rel = relM[1].toLowerCase();
      // "my grandmother/grandfather" (the trove's own relation term) = the subject, not a relation.
      const isSelf = selfRel.has(rel) && /\b(my|our|the)\s+/i.test(sent.slice(Math.max(0, sent.toLowerCase().indexOf(rel) - 6), sent.toLowerCase().indexOf(rel)));
      if (!isSelf) push({ type: 'relationship', name: cap(rel), detail: cap(sent), quote: sent, subject: rel, valence: 0.4, salience: 0.66 });
    }

    // OBJECT / PET — capture a pet name ("Biscuit")
    const petM = sent.match(/\b(?:dog|cat|pony|horse|bird)\s+(?:named|called)\s+([A-Z][a-z]+)/) ||
      sent.match(/\b([A-Z][a-z]+),?\s+(?:the|our|her|his|my)\s+(?:dog|cat|pony|horse)\b/);
    if (petM) {
      push({ type: 'object', name: petM[1], detail: cap(sent), quote: sent, subject: petM[1].toLowerCase(), valence: 0.7, salience: 0.7 });
    } else {
      const objN = sent.match(OBJECT_NOUN);
      if (objN && !/\bdog|cat\b/.test(objN[1])) push({ type: 'object', name: titleCase(objN[1]), detail: cap(sent), quote: sent, subject: objN[1].toLowerCase(), salience: 0.45 });
    }

    // SAYING — quoted speech or "always said"
    const sayM = sent.match(/["“]([^"”]{4,})["”]/) || (/\b(always said|used to say|would say)\b/i.test(sent) ? [sent, sent] as any : null);
    if (sayM) push({ type: 'saying', name: (sayM[1] || sent).slice(0, 60), detail: cap(sent), quote: sent, valence: 0.5, salience: 0.62 });

    // VALUE — a belief / rule
    if (/\b(never|always|you have to|you must|the important thing|what matters|believe|taught me)\b/i.test(sent) && !sayM) {
      push({ type: 'value', name: cap(sent).slice(0, 60), detail: cap(sent), quote: sent, valence: 0.55, salience: 0.7 });
    }

    // EVENT — a life verb
    const evM = low.match(/\b(crossed|married|escaped|survived|born|moved|emigrated|opened|built|buried|fled|fought|worked|lost|left|arrived|met)\b/);
    if (evM && !yearM && !streetM) {
      push({ type: 'event', name: cap(sent).slice(0, 70), detail: cap(sent), quote: sent, valence: 0.4, salience: 0.6 });
    }
  }

  // never drop a telling on the floor — if nothing matched, keep the utterance as an event tile
  if (!records.length && whole.trim().length > 3) {
    records.push({ type: 'event', name: cap(whole.trim()).slice(0, 70), detail: cleanInscription(whole), quote: whole.trim(), salience: 0.4 });
  }

  return { records: records.slice(0, 6), inscription: cleanInscription(whole) };
}

/** The memory-grounded answer — ONLY from recalled tesserae. Never invents; flags the gap. */
export function offlineAnswer(input: AnswerInput): string {
  if (!input.memoryOn) {
    return `Sorry — remind me? With memory off I'm just a recorder; I've kept nothing about ${input.personName} to draw on.`;
  }
  const best = input.recalled[0];
  if (!best) {
    return `I don't know that yet — ${input.personName} never told me. I won't invent it. Want me to ask next time?`;
  }
  const label = best.name.replace(/\s*[—-]\s.*$/, '').replace(/[.:]$/, '').trim(); // "Biscuit — the dog…" → "Biscuit"
  // prefer a provenance-style detail if it reads like one; else her own words; else the plain detail.
  const provDetail = /you (said|told)|first session|the day you started|session \d/i.test(best.detail) ? best.detail : '';
  const line = provDetail || (best.quote ? `"${best.quote}"` : best.detail);
  return `${label}. ${line}`.replace(/\s+/g, ' ').trim();
}

/** A warm reflection back of what was just set (offline biographer acknowledgement). */
export function offlineReflect(inscription: string, setCount: number, personName: string): string {
  const bits = [
    `I've kept that.`,
    `That's set — ${setCount} new ${setCount === 1 ? 'tessera' : 'tesserae'} in ${personName}'s mosaic.`,
    `I'm listening — go on.`,
  ];
  return bits.join(' ');
}

export function classifyType(word: string): TesseraType {
  if (PLACE_NOUN.test(word)) return 'place';
  if (OBJECT_NOUN.test(word)) return 'object';
  if (REL_WORDS.test(word)) return 'relationship';
  return 'event';
}
