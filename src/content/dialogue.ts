export type Speaker = 'mira' | 'luka' | 'sofia' | 'niko' | 'ana' | 'bruno';

export const SPEAKER_NAMES: Record<Speaker, string> = {
  mira: 'Mira',
  luka: 'Luka',
  sofia: 'Sofia',
  niko: 'Niko',
  ana: 'Ana',
  bruno: 'Bruno',
};

export interface DialogueLine {
  id: string;
  levelId: string;
  when: 'before' | 'after';
  speaker: Speaker;
  text: { en: string; hr: string };
}

/** Short, optional story beats. Chapter 1 ends at L15, chapter 2 at L30. */
export const DIALOGUE: readonly DialogueLine[] = [
  {
    id: 'd01',
    levelId: 'L01',
    when: 'before',
    speaker: 'mira',
    text: {
      en: 'The old bakery needs a baker. Start with one plate.',
      hr: 'Stara pekara traži pekara. Počni s jednim tanjurom.',
    },
  },
  {
    id: 'd05',
    levelId: 'L05',
    when: 'after',
    speaker: 'luka',
    text: {
      en: 'Try a different order. Maybe it chains.',
      hr: 'Probaj drukčiji redoslijed. Možda se nanizaju.',
    },
  },
  {
    id: 'd09',
    levelId: 'L09',
    when: 'before',
    speaker: 'niko',
    text: {
      en: 'Five flavours, one tray, four orders.',
      hr: 'Pet okusa, jedan pladanj, četiri narudžbe.',
    },
  },
  {
    id: 'd13',
    levelId: 'L13',
    when: 'before',
    speaker: 'sofia',
    text: { en: 'I am watching. Make it neat.', hr: 'Promatram. Neka bude uredno.' },
  },
  {
    id: 'd15',
    levelId: 'L15',
    when: 'after',
    speaker: 'mira',
    text: { en: 'The doors are open again. Thank you.', hr: 'Vrata su opet otvorena. Hvala ti.' },
  },
  {
    id: 'd16',
    levelId: 'L16',
    when: 'before',
    speaker: 'luka',
    text: { en: 'New season, new ideas.', hr: 'Nova sezona, nove ideje.' },
  },
  {
    id: 'd22',
    levelId: 'L22',
    when: 'before',
    speaker: 'ana',
    text: { en: 'Three cakes for one wedding.', hr: 'Tri torte za jedno vjenčanje.' },
  },
  {
    id: 'd25',
    levelId: 'L25',
    when: 'before',
    speaker: 'bruno',
    text: { en: 'My shop is faster. Prove me wrong.', hr: 'Moja je pekara brža. Dokaži suprotno.' },
  },
  {
    id: 'd30',
    levelId: 'L30',
    when: 'before',
    speaker: 'mira',
    text: { en: 'The whole town is here. Bake.', hr: 'Cijeli je grad ovdje. Peci.' },
  },
  {
    id: 'd30b',
    levelId: 'L30',
    when: 'after',
    speaker: 'mira',
    text: { en: 'Every recipe is in the book.', hr: 'Svaki je recept u knjizi.' },
  },
];

export const dialogueFor = (levelId: string, when: 'before' | 'after'): DialogueLine[] =>
  DIALOGUE.filter((d) => d.levelId === levelId && d.when === when);
