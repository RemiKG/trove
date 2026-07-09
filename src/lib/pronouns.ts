/* Pronouns derived from the trove's recorded relationship — "grandmother" reads as her/she,
   "grandfather" as his/he, and anything else (or anything ambiguous) stays neutral. */
const SHE = /\b(grandmother|grandma|granny|nana|nonna|mother|mamma|mama|mom|mum|aunt|auntie|sister|wife|daughter|niece|godmother)\b/i;
const HE = /\b(grandfather|grandpa|nonno|father|papa|dad|uncle|brother|husband|son|nephew|godfather)\b/i;

export interface Pronouns { subj: string; pos: string; Pos: string; talking: string }

export function pronounsFor(relationship?: string): Pronouns {
  const r = relationship || '';
  if (SHE.test(r) && !HE.test(r)) return { subj: 'she', pos: 'her', Pos: 'Her', talking: "she's talking" };
  if (HE.test(r) && !SHE.test(r)) return { subj: 'he', pos: 'his', Pos: 'His', talking: "he's talking" };
  return { subj: 'they', pos: 'their', Pos: 'Their', talking: "they're talking" };
}
