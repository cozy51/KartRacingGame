export const CONFIG = {
  title: 'Turbo Kart Arena',
  titleLines: ['TURBO', 'KART', 'ARENA'],
  brand: 'TURBO KART',
  trackName: 'Sun Cove Circuit',
  trackShortName: 'SUN COVE',
  trackNameJa: 'サンコーブ・サーキット',
  laps: 3,
  maxSpeed: 30,
  acceleration: 17,
  roadWidth: 15,
};
export type Difficulty = 'Easy' | 'Normal' | 'Hard';
export const DIFFICULTY: Record<Difficulty, number> = { Easy: 0.79, Normal: 0.91, Hard: 1.02 };
