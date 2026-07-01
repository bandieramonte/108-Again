export const SEEDED_IDS = new Set([
  "11111111-1111-1111-1111-111111111001",
  "11111111-1111-1111-1111-111111111002",
  "11111111-1111-1111-1111-111111111003",
  "11111111-1111-1111-1111-111111111004",
  "11111111-1111-1111-1111-111111111005"
]);

const seeded_ids_array = [...SEEDED_IDS];

export const DEFAULT_PRACTICES = [
  { id: seeded_ids_array[0], name: "Short Refuge", targetCount: 11111, orderIndex: 1, imageKey: 'short-refuge', dailyTargetCount: null, defaultSessionCount: 108, totalOffset: 0 },
  { id: seeded_ids_array[1], name: "Prostrations", targetCount: 111111, orderIndex: 2, imageKey: 'prostrations', dailyTargetCount: null, defaultSessionCount: 108, totalOffset: 0 },
  { id: seeded_ids_array[2], name: "Diamond Mind", targetCount: 111111, orderIndex: 3, imageKey: 'diamond-mind', dailyTargetCount: null, defaultSessionCount: 108, totalOffset: 0 },
  { id: seeded_ids_array[3], name: "Mandala", targetCount: 111111, orderIndex: 4, imageKey: 'mandala', dailyTargetCount: null, defaultSessionCount: 108, totalOffset: 0 },
  { id: seeded_ids_array[4], name: "Guru Yoga", targetCount: 111111, orderIndex: 5, imageKey: 'guru-yoga', dailyTargetCount: null, defaultSessionCount: 108, totalOffset: 0 }
]
