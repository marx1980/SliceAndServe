export type RecipeFamily = 'french' | 'croatian' | 'italian' | 'japanese' | 'american' | 'seasonal';

export interface Recipe {
  id: string;
  /** Level whose first completion earns this recipe stamp. */
  levelId: string;
  family: RecipeFamily;
  name: { en: string; hr: string };
}

export const FAMILY_NAMES: Record<RecipeFamily, { en: string; hr: string }> = {
  french: { en: 'French patisserie', hr: 'Francuska patisserie' },
  croatian: { en: 'Croatian desserts', hr: 'Hrvatski deserti' },
  italian: { en: 'Italian classics', hr: 'Talijanski klasici' },
  japanese: { en: 'Japanese sweets', hr: 'Japanski slatkiši' },
  american: { en: 'American bakery', hr: 'Američka pekara' },
  seasonal: { en: 'Seasonal', hr: 'Sezonski' },
};

type Row = [RecipeFamily, string, string];

// One stamp per campaign level, in level order; families alternate so each chapter has variety.
const ROWS: Row[] = [
  ['croatian', 'Madarica', 'Madarica'],
  ['french', 'Éclair', 'Éclair'],
  ['italian', 'Tiramisù', 'Tiramisù'],
  ['croatian', 'Kremsnita', 'Kremšnita'],
  ['american', 'Brownie', 'Brownie'],
  ['japanese', 'Dorayaki', 'Dorayaki'],
  ['french', 'Macaron', 'Macaron'],
  ['croatian', 'Makovnjača', 'Makovnjača'],
  ['italian', 'Panna cotta', 'Panna cotta'],
  ['american', 'Cheesecake', 'Cheesecake'],
  ['japanese', 'Mochi', 'Mochi'],
  ['croatian', 'Orehnjača', 'Orehnjača'],
  ['french', 'Mille-feuille', 'Mille-feuille'],
  ['seasonal', 'Fritule', 'Fritule'],
  ['italian', 'Cannolo', 'Cannolo'],
  ['croatian', 'Rozata', 'Rožata'],
  ['american', 'Apple pie', 'Pita od jabuka'],
  ['japanese', 'Taiyaki', 'Taiyaki'],
  ['french', 'Paris-Brest', 'Paris-Brest'],
  ['italian', 'Sfogliatella', 'Sfogliatella'],
  ['croatian', 'Rapska torta', 'Rapska torta'],
  ['american', 'Red velvet', 'Red velvet'],
  ['japanese', 'Castella', 'Castella'],
  ['seasonal', 'Bûche de Noël', 'Božićno deblo'],
  ['french', 'Tarte Tatin', 'Tarte Tatin'],
  ['italian', 'Cassata', 'Cassata'],
  ['american', 'Carrot cake', 'Kolač od mrkve'],
  ['japanese', 'Daifuku', 'Daifuku'],
  ['seasonal', 'Pinca', 'Pinca'],
  ['seasonal', 'Festival cake', 'Svečana torta'],
];

export const RECIPES: readonly Recipe[] = ROWS.map(([family, en, hr], i) => ({
  id: `r${String(i + 1).padStart(2, '0')}`,
  levelId: `L${String(i + 1).padStart(2, '0')}`,
  family,
  name: { en, hr },
}));
