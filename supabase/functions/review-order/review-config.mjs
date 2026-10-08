// Tekton OS — configuration for the AI order review (hackathon case «НарядAI» §6.2–6.4).
// All numbers are demo defaults tuned for the synthetic dataset; a plant calibrates them per участок.

export const REVIEW_CONFIG = {
  // Weight of each component in the 1..5 score.
  weights: { semantic: 0.35, materials: 0.25, photo: 0.25, time: 0.15 },

  semantic: {
    reworkBelow: 0.3,        // model match below this, with enough confidence, => rework
    remarkBelow: 0.55,       // match below this => remark
    minConfidence: 0.6,      // model confidence needed for a decisive rework call
    lowConfidence: 0.5,      // below this the model's answer only informs, master decides
    fallbackWeakBelow: 0.15, // rules-only lexical overlap below this counts as a warning
  },

  materials: {
    warnAbove: 1,            // qty > norm max => remark
    failAbove: 3,            // qty > 3x norm max => rework-eligible
    historyMinSamples: 5,    // past write-offs needed before history is trusted
    historyWarnAbove: 2.5,   // qty > 2.5x historical median => remark
    historyFailAbove: 4,     // qty > 4x historical median => rework-eligible
    norms: [
      // match = lowercase substring of the material name; plausible qty per one repair
      { match: 'подшипник', unit: 'шт', min: 1, max: 4 },
      { match: 'смазка', unit: 'кг', min: 0.2, max: 5 },
      { match: 'масло', unit: 'л', min: 1, max: 20 },
      { match: 'кабель', unit: 'м', min: 1, max: 50 },
      { match: 'фильтр', unit: 'шт', min: 1, max: 2 },
      { match: 'ремень', unit: 'шт', min: 1, max: 2 },
      { match: 'сальник', unit: 'шт', min: 1, max: 4 },
      { match: 'уплотнение', unit: 'шт', min: 1, max: 4 },
      { match: 'прокладка', unit: 'шт', min: 1, max: 6 },
      { match: 'электрод', unit: 'кг', min: 0.5, max: 5 },
      { match: 'болт', unit: 'шт', min: 1, max: 16 },
      { match: 'гайка', unit: 'шт', min: 1, max: 16 },
      { match: 'шайба', unit: 'шт', min: 1, max: 20 },
      { match: 'датчик', unit: 'шт', min: 1, max: 2 },
      { match: 'предохранитель', unit: 'шт', min: 1, max: 5 },
    ],
    unitDefaults: { 'шт': [1, 10], 'кг': [0.1, 10], 'м': [1, 100], 'л': [0.5, 25], 'компл': [1, 5] },
    // §6.2: materials must fit the fault type, not only the quantity.
    // Keyed by the first letter of the fault code (М/Э/Г/П/С per case §5.4).
    faultMaterials: {
      'М': ['подшипник', 'смазка', 'ремень', 'болт', 'гайка', 'шайба', 'вал', 'муфта', 'шпонка', 'звездочка', 'цепь', 'масло', 'электрод'],
      'Э': ['кабель', 'датчик', 'предохранитель', 'контактор', 'автомат', 'лампа', 'провод', 'клемма', 'двигатель', 'болт', 'гайка'],
      'Г': ['сальник', 'уплотнение', 'прокладка', 'масло', 'фильтр', 'шланг', 'рукав', 'манжета', 'клапан'],
      'П': ['уплотнение', 'фильтр', 'шланг', 'манжета', 'клапан', 'масло', 'прокладка'],
      'С': ['смазка', 'масло', 'фильтр', 'ветошь'],
    },
    universalMaterials: ['ветошь', 'обтироч', 'обезжириват', 'керосин', 'салфетк'],
  },

  time: {
    fastRatio: 0.25,   // finished in under 25% of the norm => credibility remark
    slowRatio: 2,      // over 2x norm => remark
    verySlowRatio: 4,  // over 4x norm => strong remark
    // Time alone never sends an order to rework: pace depends on access, pauses, parts.
  },

  photo: {
    captureBeforeIssueToleranceMin: 10, // capture may precede issue by this much
    captureAfterCloseToleranceMin: 30,  // upload/capture may lag closing by this much
    captureBeforeCloseMaxMin: 30,       // §6.3 п.1: фото «в момент закрытия» — не раньше чем за 30 мин
    layer2MinConfidence: 0.7,           // matches photo module CONF_MIN: below it never forces rework
    // Layer-1 photo flags never auto-rework: they force needs_master_review.
    // Missing photo on an unplanned order stays a completeness fail (rework).
    hardFlags: ['exact_duplicate', 'near_duplicate', 'stale', 'future_time', 'unreadable'],
    warnFlags: ['no_exif', 'blurry', 'too_dark'],
  },

  score: {
    acceptMin: 4.5,  // weighted 1..5 score needed for a clean «accepted»
    remarksMin: 3,   // below this even a remark-level verdict goes to the master
    reworkCap: 2,    // a rework verdict never shows a score above this
  },

  promptVersion: 'review-v2',
};
