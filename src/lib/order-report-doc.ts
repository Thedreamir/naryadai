import type {DocSection} from './report-docs.ts'
import {STATUS} from './status.ts'

// Pure snapshot model. Caller must use an already-authorized, RLS-scoped order.
// Never accepts sessions, endpoints or photo URLs as exportable fields.
type Row = Record<string, unknown>
export interface OrderReportOptions {
  generatedAt: string
  snapshotAsOf: string
  events?: readonly unknown[]
  eventsComplete?: boolean
}
export interface OrderReportPhoto {
  phase: 'before' | 'after'
  index: number
  serverReceivedAt: string | null
  byteSize: number | null
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null
  sha256: string | null
  content: 'not-exported'
  capturedAt: null
}
export interface IndividualOrderReportDoc {
  kind: 'individual-order'
  schemaVersion: 1
  title: string
  subtitle: string
  disclaimer: string
  generatedAt: string
  snapshot: {orderId: string; version: number | null; asOf: string}
  sections: DocSection[]
  photos: OrderReportPhoto[]
  limitations: string[]
}
const UNKNOWN = 'Нет данных'
const REDACTED = '[Скрыто: ссылка или чувствительные данные]'
const record = (v: unknown): Row => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Row : {}
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : []
// Conservative redaction for known credential forms. This is not a general DLP
// guarantee for arbitrary prose: an authorized user must review the local export.
function text(v: unknown, max = 4000): string {
  if (typeof v !== 'string' || !v.trim()) return UNKNOWN
  if (/(?:[a-z][a-z0-9+.-]*:\/\/|data:|blob:|mailto:|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|authorization|bearer\s|password|passwd|secret|token|api[_ -]?key|credential|парол|токен|eyJ[A-Za-z0-9_-]{8,}\.|-----BEGIN)/i.test(v)) return REDACTED
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max)
}
function instant(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return null
  const [year, month, day] = v.slice(0, 10).split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}
function at(v: unknown): string {
  const iso = instant(v)
  return iso ? new Date(iso).toLocaleString('ru-RU', {timeZone: 'Asia/Almaty'}) + ' (Asia/Almaty)' : UNKNOWN
}
function identifier(v: unknown): string | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? String(v)
    : typeof v === 'string' && /^[1-9]\d{0,18}$/.test(v) ? v : null
}
const count = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null
const label = (v: unknown, labels: Record<string, string>): string => typeof v === 'string' && Object.hasOwn(labels, v) ? labels[v] : UNKNOWN
function status(v: unknown): string {
  return typeof v === 'string' && Object.hasOwn(STATUS, v) ? STATUS[v].label : UNKNOWN
}
function photo(phase: OrderReportPhoto['phase'], index: number, evidence: unknown): OrderReportPhoto {
  const p = record(evidence)
  const mime = p.mime_type
  return {phase, index, serverReceivedAt: instant(p.server_received_at), byteSize: count(p.byte_size),
    mimeType: mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' ? mime : null,
    sha256: typeof p.sha256 === 'string' && /^[a-fA-F0-9]{64}$/.test(p.sha256) ? p.sha256.toLowerCase() : null,
    content: 'not-exported', capturedAt: null}
}
function rows(heading: string, values: (string | number)[][]): DocSection {
  return {heading, table: {columns: [{header: 'Поле', weight: 1}, {header: 'Значение', weight: 3}], rows: values}}
}

export function orderReportDoc(input: unknown, options: OrderReportOptions): IndividualOrderReportDoc {
  const o = record(input), orderId = identifier(o.id)
  if (!orderId) throw new TypeError('Требуется идентификатор наряда')
  const generatedAt = instant(options.generatedAt), asOf = instant(options.snapshotAsOf)
  if (!generatedAt || !asOf) throw new TypeError('Требуются даты с часовым поясом')
  if (Date.parse(asOf) > Date.parse(generatedAt)) throw new RangeError('Срез не может быть позже формирования')
  const closure = record(o.closure), ai = record(o.ai_result), rules = record(ai.document_rules)
  const events = list(options.events).map(record).filter(e => identifier(e.order_id) === orderId)
    .sort((a, b) => (Date.parse(instant(a.created_at) ?? '') || Infinity) - (Date.parse(instant(b.created_at) ?? '') || Infinity))
  const photos: OrderReportPhoto[] = []
  list(o.before_photos).forEach((_, i) => photos.push(photo('before', i + 1, null)))
  list(o.intake_photos).map(record).filter(p => p.phase === 'before_intake').forEach(p => photos.push(photo('before', photos.filter(x => x.phase === 'before').length + 1, p)))
  const after = list(closure.photos), receipts = list(closure.photo_evidence)
  // Entries are registry positions only, never a verified image-receipt binding.
  // Receipts without a visible image remain evidence, not a fabricated image.
  for (let i = 0; i < Math.max(after.length, receipts.length); i++) photos.push(photo('after', i + 1, receipts[i]))
  const version = count(o.version)
  const sections: DocSection[] = [rows('Наряд и загруженный срез', [
    ['Наряд', orderId], ['Версия', version ?? UNKNOWN], ['Работа', text(o.title)], ['Оборудование', text(o.equipment)],
    ['Участок', text(o.section)], ['Исполнитель', text(o.assignee)], ['Мастер', text(o.master)],
    ['Вид работы', label(o.kind, {planned: 'Плановая', unplanned: 'Внеплановая'})],
    ['Приоритет', label(o.priority, {normal: 'Обычный', high: 'Высокий', emergency: 'Аварийный', planned: 'Плановый'})],
    ['Статус среза', status(o.status)], ['Отменён', o.cancelled === true ? 'Да' : o.cancelled === false ? 'Нет' : UNKNOWN],
    ['Создан', at(o.created_at)], ['Начало работы (запись)', at(o.started_at)], ['Срок', at(o.deadline)], ['Закрыт мастером', at(o.closed_at)],
  ]), rows('Отчёт исполнителя', [['Выполненные работы', text(closure.works)], ['Шифр неисправности', text(closure.fault_code, 80)]]), {
    heading: 'Материалы (записанные значения, без пересчёта единиц)',
    table: {columns: [{header: 'Материал'}, {header: 'Количество'}, {header: 'Единица'}], rows: list(closure.materials).map(record).map(m => [text(m.name, 160), typeof m.quantity === 'number' && Number.isFinite(m.quantity) && m.quantity > 0 ? m.quantity : UNKNOWN, text(m.unit, 40)])},
    ...(list(closure.materials).length ? {} : {lines: ['Материалы не указаны. Это не доказательство отсутствия расхода.']}),
  }, rows('Допуск (запись, не разрешение на работу)', [
    ['Тип', label(o.permit_kind, {confirmed: 'Подтверждён в записи', not_required: 'Не требуется по заявлению'})],
    ['Основание', text(o.permit_note)], ['Время записи', at(o.permit_at)],
  ]), {
    heading: 'Заявления безопасности',
    table: {columns: [{header: 'Фаза'}, {header: 'Заявление'}, {header: 'Подтверждено'}, {header: 'Время записи'}], rows: [
      ...list(o.declarations), ...list(closure.safety_declarations),
    ].map(record).filter(d => d.order_id == null || identifier(d.order_id) === orderId).map(d => [label(d.phase, {pre_work: 'До работы', post_work: 'После работы'}), text(d.text), d.confirmed === true ? 'Да (заявление)' : d.confirmed === false ? 'Нет' : UNKNOWN, at(d.created_at)])},
    lines: ['Заявление пользователя не подтверждает физическое выполнение и не заменяет допуск. Дубли источников не удалены.'],
  }, rows('Предварительная проверка документа (не оценка ремонта)', [
    ['Вердикт', label(rules.verdict, {rework: 'Документ требует доработки', accepted: 'Документ заполнен'})],
    ['Основания проверки', list(rules.reasons).map(r => text(r)).join('\n') || UNKNOWN],
    ['Балл полноты по правилам', typeof rules.score === 'number' && Number.isFinite(rules.score) && rules.score >= 0 && rules.score <= 5 ? rules.score : UNKNOWN],
    ['Источник', 'Только поля document_rules. Участие модели и архив не подтверждены этим экспортом.'],
  ]), rows('Решение мастера', [
    ['Текущий статус среза', status(o.status)], ['Дата закрытия', at(o.closed_at)],
    ['Оценка мастера / 5', typeof ai.human_score === 'number' && Number.isInteger(ai.human_score) && ai.human_score >= 1 && ai.human_score <= 5 ? ai.human_score : UNKNOWN],
    ['Комментарий', text(ai.human_comment)], ['Примечание', o.status === 'closed' ? 'Закрытие отражено в загруженном срезе.' : 'Текущее окончательное закрытие не подтверждено. Оценка может быть исторической.'],
  ]), {
    heading: 'Фото: только безопасный реестр, без ссылок и содержимого',
    table: {columns: [{header: 'Фаза / №'}, {header: 'Получено сервером'}, {header: 'Байт'}, {header: 'Тип'}], rows: photos.map(p => [p.phase === 'before' ? `До ${p.index}` : `После ${p.index}`, at(p.serverReceivedAt), p.byteSize ?? UNKNOWN, p.mimeType ?? UNKNOWN])},
    lines: ['Время получения не равно времени съёмки. Содержимое, EXIF, пути хранилища и подписанные ссылки не экспортируются.', 'Номер обозначает позицию реестра. Соответствие квитанции изображению и уникальность фото не проверены.', ...(photos.length ? [] : ['Фото не представлены в срезе.'])],
  }, {
    heading: 'Журнал действий по этому наряду',
    table: {columns: [{header: 'Время'}, {header: 'Автор'}, {header: 'Статус / событие'}, {header: 'Основание'}], rows: events.map(e => [at(e.created_at), text(e.actor, 160), status(e.new_status), text(e.reason)])},
    lines: [options.eventsComplete === true ? 'Полнота журнала заявлена вызывающим кодом; модель не проверяет сервер.' : 'Полнота журнала не подтверждена. Это только переданные записи.'],
  }]
  sections.push({heading: 'Ограничения экспорта', lines: [
    'Загруженный срез не доказывает текущее состояние или полноту данных. Экспорт не подтверждает физический ремонт.',
    'Фото представлены реестром метаданных, без изображений. Соответствие квитанций изображениям не проверено.',
    'Свободный текст может содержать нераспознанные чувствительные данные. Перед передачей нужен просмотр.',
  ]})
  return {kind: 'individual-order', schemaVersion: 1, title: `Отчёт по наряду #${orderId}`,
    subtitle: `Учебный набор · срез ${at(asOf)} · версия ${version ?? UNKNOWN}`, generatedAt: at(generatedAt),
    disclaimer: 'Синтетические данные демонстрации. Не официальный документ завода, не подтверждение ремонта и не аттестация персонала.',
    snapshot: {orderId, version, asOf}, sections, photos,
    limitations: ['Экспорт не проверяет права и не обновляет состояние. Вызывающий код обязан получить наряд в области доступа пользователя.',
      'Не рассчитывает простой, трудоёмкость, точность ИИ или рейтинг. Нет данных означает неизвестно, не ноль.',
      'Свободный текст выбран явно; известные ссылки и формы секретов скрываются. Произвольный секрет в тексте может быть не распознан: нужен просмотр перед передачей.']}
}
