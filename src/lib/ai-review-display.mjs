export function reviewDisplay(result = {}) {
  const verdict = {
    accepted: 'Принято',
    accepted_with_remarks: 'Принято с замечаниями',
    accepted_with_notes: 'Принято с замечаниями',
    rework: 'Требует доработки',
    needs_master_review: 'Нужна проверка мастером',
  }[result.verdict] ?? 'Вердикт не распознан';
  const modern = !!result.layer2 && Object.hasOwn(result.layer2, 'work_match');
  if (modern) {
    const semanticSource = result.layer1?.completeness?.semantic?.source;
    const fellBack = (result.rule_flags || []).includes('no_model') || semanticSource === 'rules_fallback';
    const language = result.layer2.work_match != null && !fellBack;
    const photo = result.layer2.photo != null;
    const cached = language && result.layer2.work_match.cached === true;
    return {
      verdict, modelParticipated: language,
      label: cached ? 'Правила и кэш языковой модели' : language ? 'Правила и языковая модель' : 'Проверка по правилам',
      detail: (language
        ? cached ? 'В проверке текста использован сохранённый ответ языковой модели, не новый вызов.' : 'Текст отчёта проверен языковой моделью.'
        : 'Языковая модель не участвовала: только правила.') + (photo
          ? ' Приложен результат фотомодуля; его источник этой карточкой не подтверждён.'
          : ' Визуальное сравнение фото не выполнялось.'),
    };
  }
  const mode = result.mode;
  return {
    verdict, modelParticipated: mode === 'live' || mode === 'cache',
    label: mode === 'live' ? 'Ответ модели' : mode === 'cache' ? 'Кэш ответа модели' : mode === 'rules' ? 'Проверка по правилам' : 'Источник проверки не указан',
    detail: mode === 'live' ? 'Ответ языковой модели.' : mode === 'cache' ? 'Сохранённый ответ модели, не новый вызов.' : mode === 'rules' ? 'Языковая модель не участвовала: только правила.' : 'Данных для определения участия модели нет.',
  };
}

// Endpoint envelope metadata is not persisted inside result. Missing metadata
// must not be translated into successful archival or trigger an automatic retry.
export function reviewArchiveDisplay(response) {
  if (response?.archived === true) return {state:'saved',label:'Проверка сохранена в архиве'};
  if (response?.archived === false) return {state:'failed',label:'Архив не сохранён. Сообщите администратору.'};
  return {state:'unknown',label:'Сохранение проверки в архиве не подтверждено'};
}

export function reviewPresentation(result,receipt){const display=reviewDisplay(result);return {...display,provisional:receipt?.archived!==true,verdictLabel:receipt?.archived===true?display.verdict:'Предварительный вывод: '+display.verdict,scoreLabel:receipt?.archived===true?(result?.score==null?'Не выставлена':result.score+' / 5'):'Ожидает подтверждения архива'};}
