/**
 * Memorez Istorie — backend în Google Apps Script.
 * Primește datele de la aplicație și le scrie în Sheet; dă lecțiile aplicației;
 * dă datele panoului de admin DOAR cu parola corectă.
 *
 * Foi:
 *   Sesiuni     — un rând pe sesiune (rezumat + datele complete în coloana json)
 *   Evenimente  — un rând pe acțiune (citit, a cerut să vadă, încercare...)
 *   Lecții      — lecțiile; le editezi direct aici
 *
 * Parola panoului stă în Project Settings → Script properties → ADMIN_KEY
 * (pe serverul Google — nu apare niciodată în codul aplicației).
 */

const SHEET = { runs: 'Sesiuni', events: 'Evenimente', lessons: 'Lecții' }

const RUN_COLS = [
  'id', 'elev', 'lectie', 'capitol', 'inceput', 'ultima_activitate', 'status',
  'timp_activ_min', 'timp_citire_min', 'verificari', 'a_vazut_textul', 'a_ascultat',
  'runde_incaodata', 'iesiri_din_app', 'intrebari_corecte', 'intrebari_total', 'bucati_grele', 'json',
]
const EVENT_COLS = ['run_id', 'elev', 'ora', 'timp_din_sesiune (mm:ss)', 'tip', 'pas', 'bucata', 'detalii']
const DATE_FORMAT = 'dd.MM.yyyy HH:mm:ss'
const LESSON_COLS = ['id', 'capitol', 'titlu', 'ordine', 'text (bucăți separate prin rând liber)', 'intrebari (Întrebare | Răspuns, câte una pe rând)']

const MAX_BODY = 300000

/* ===================== punct de intrare ===================== */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'lessons'
  try {
    if (action === 'lessons') return reply({ ok: true, lessons: readLessons() })
    return reply({ ok: false, error: 'unknown_action' })
  } catch (err) {
    return reply({ ok: false, error: String(err) })
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || ''
    if (raw.length > MAX_BODY) return reply({ ok: false, error: 'too_large' })
    const body = JSON.parse(raw)

    if (body.action === 'saveRun') return reply(saveRun(body))
    if (body.action === 'adminRuns') return reply(requireAdmin(body, () => adminRuns()))
    if (body.action === 'adminRun') return reply(requireAdmin(body, () => adminRun(String(body.id || ''))))
    return reply({ ok: false, error: 'unknown_action' })
  } catch (err) {
    return reply({ ok: false, error: String(err) })
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

/* ===================== salvarea datelor de la elev ===================== */

function saveRun(body) {
  const run = body.run
  if (!run || typeof run.id !== 'string' || !/^[a-z0-9]{6,20}$/.test(run.id)) return { ok: false, error: 'bad_run' }
  if (!Array.isArray(run.chunks) || typeof run.startedAt !== 'number') return { ok: false, error: 'bad_run' }

  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const sum = body.summary || {}
    const runForSheet = Object.assign({}, run)
    delete runForSheet.events // evenimentele merg în foaia lor
    let json = JSON.stringify(runForSheet)
    if (json.length > 49000) json = JSON.stringify(Object.assign({}, runForSheet, { quiz: [], truncated: true }))

    const row = [
      run.id,
      safe(run.learnerName, 60),
      safe(run.lessonTitle, 120),
      safe(run.chapter, 120),
      new Date(run.startedAt),
      new Date(run.updatedAt || Date.now()),
      safe(run.status, 20),
      minutes(sum.activeMs),
      minutes(sum.readMs),
      num(sum.attempts),
      num(sum.shows),
      num(sum.listens) + num(sum.readListens),
      num(sum.againRounds),
      num(run.awayCount),
      num(sum.quizCorrect),
      num(sum.quizTotal),
      (sum.hardest || []).map((i) => i + 1).join(', '),
      json,
    ]

    const sheet = getSheet(SHEET.runs, RUN_COLS)
    const found = sheet.getRange('A:A').createTextFinder(run.id).matchEntireCell(true).findNext()
    const rowIndex = found ? found.getRow() : sheet.getLastRow() + 1
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row])
    sheet.getRange(rowIndex, 5, 1, 2).setNumberFormat(DATE_FORMAT) // inceput, ultima_activitate

    // doar evenimentele noi (aplicația trimite de la ultimul trimis încolo)
    const events = Array.isArray(body.newEvents) ? body.newEvents.slice(0, 800) : []
    if (events.length) {
      const ev = getSheet(SHEET.events, EVENT_COLS)
      const rows = events.map((e) => {
        const { t, type, step, chunk, ...rest } = e || {}
        return [
          run.id,
          safe(run.learnerName, 60),
          new Date(run.startedAt + num(t)),
          "'" + mmss(t), // apostroful: Sheet-ul să nu-l transforme în oră
          safe(type, 40),
          safe(step, 20),
          chunk == null ? '' : num(chunk) + 1,
          safe(JSON.stringify(rest), 500),
        ]
      })
      const first = ev.getLastRow() + 1
      ev.getRange(first, 1, rows.length, EVENT_COLS.length).setValues(rows)
      ev.getRange(first, 3, rows.length, 1).setNumberFormat(DATE_FORMAT)
    }
    return { ok: true }
  } finally {
    lock.releaseLock()
  }
}

/* ===================== panoul de admin (cu parolă) ===================== */

function requireAdmin(body, fn) {
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY')
  if (!key || typeof body.key !== 'string' || body.key !== key) {
    Utilities.sleep(800) // încetinește încercările de ghicire
    return { ok: false, error: 'wrong_password' }
  }
  return fn()
}

function adminRuns() {
  const sheet = getSheet(SHEET.runs, RUN_COLS)
  const values = sheet.getDataRange().getValues().slice(1)
  const runs = values
    .filter((r) => r[0])
    .map((r) => {
      let run = {}
      try { run = JSON.parse(r[17]) } catch (e) { run = {} }
      return run
    })
    .filter((r) => r.id)
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
  return { ok: true, runs }
}

function adminRun(id) {
  if (!id) return { ok: false, error: 'missing_id' }
  const runs = adminRuns().runs
  const run = runs.find((r) => r.id === id)
  if (!run) return { ok: false, error: 'not_found' }
  const evSheet = getSheet(SHEET.events, EVENT_COLS)
  const events = evSheet
    .getDataRange()
    .getValues()
    .slice(1)
    .filter((r) => r[0] === id)
    .map((r) => {
      let detail = {}
      try { detail = JSON.parse(r[7] || '{}') } catch (e) { detail = {} }
      return Object.assign(
        { t: new Date(r[2]).getTime() - run.startedAt, type: r[4], step: r[5] || null, chunk: r[6] === '' ? null : Number(r[6]) - 1 },
        detail,
      )
    })
  run.events = events
  return { ok: true, run }
}

/* ===================== lecțiile ===================== */

/**
 * Textul: o bucată pe paragraf (separate prin rând liber).
 * Dacă primul rând al paragrafului începe cu „Î:”, e întrebarea afișată deasupra bucății.
 */
function parseChunks(text) {
  const chunks = []
  const cues = []
  String(text)
    .split(/\n\s*\n/)
    .forEach((para) => {
      const lines = para.trim().split('\n')
      let cue = ''
      if (/^\s*[ÎI]\s*:/i.test(lines[0]) && lines.length > 1) cue = lines.shift().replace(/^\s*[ÎI]\s*:\s*/i, '').trim()
      const body = lines.join(' ').replace(/^\s*R\s*:\s*/i, '').replace(/\s+/g, ' ').trim()
      if (body) {
        chunks.push(body)
        cues.push(cue)
      }
    })
  return { chunks, cues }
}

function readLessons() {
  const values = getSheet(SHEET.lessons, LESSON_COLS).getDataRange().getValues().slice(1)
  return values
    .filter((r) => r[0] && r[4])
    .map((r) => ({
      id: String(r[0]),
      chapter: String(r[1] || ''),
      title: String(r[2] || ''),
      order: Number(r[3]) || 0,
      ...parseChunks(r[4]),
      questions: String(r[5] || '')
        .split('\n')
        .map((line) => line.split('|'))
        .filter((p) => p.length >= 2 && p[0].trim() && p[1].trim())
        .map((p) => ({ q: p[0].trim(), a: p.slice(1).join('|').trim() })),
    }))
    .sort((a, b) => a.chapter.localeCompare(b.chapter) || a.order - b.order)
}

/* ===================== utilitare ===================== */

function getSheet(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.setFrozenRows(1)
  }
  // capul de tabel e mereu cel actual (dacă am redenumit o coloană)
  const header = sheet.getRange(1, 1, 1, cols.length)
  if (header.getValues()[0].join('|') !== cols.join('|')) header.setValues([cols]).setFontWeight('bold')
  return sheet
}

/** Text sigur pentru Sheet: scurtat și fără formule (=, +, -, @ la început). */
function safe(v, max) {
  let s = v == null ? '' : String(v).slice(0, max)
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return s
}
function num(v) {
  const n = Number(v)
  return isFinite(n) ? n : 0
}
/** 82000 -> „01:22” */
function mmss(ms) {
  const s = Math.max(0, Math.floor(num(ms) / 1000))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}
function minutes(ms) {
  return Math.round(num(ms) / 600) / 100
}

/* ===================== rulează O DATĂ, manual ===================== */

/**
 * Lecțiile care se pun automat în foaia „Lecții” când rulezi setup().
 * Dacă o lecție cu același id există deja, e actualizată (textul din Sheet e înlocuit).
 * Lecții noi poți adăuga și direct în Sheet, fără să le pui aici.
 */
const LESSONS_SEED = [
  {
    "id": "fanariot-1",
    "chapter": "Capitolul 1 — Țările Române în secolul al XVIII-lea și începutul secolului al XIX-lea",
    "title": "Lecția 1: Regimul fanariot",
    "order": 1,
    "text": "Î: Ce este regimul fanariot?\nRegimul fanariot este un regim social, politic, economic și cultural impus de Imperiul Otoman Țărilor Române în secolul XVIII.\n\nÎ: De unde provine denumirea?\nDenumirea provine de la cartierul Fanar din Constantinopol, unde trăiau cei mai bogați oameni, care aveau posibilitatea de a cumpăra pe o perioadă limitată (3-4 ani) tronul Țărilor Române.\n\nÎ: Context extern, eveniment extern care a dus, a permis instaurarea regimului fanariot (1/2)\nÎn 1683, Imperiul Otoman dorea expansiunea spre vestul Europei, motiv pentru care a încercat să ocupe Viena. Turcii au fost înfrânți, fapt care a dus la decăderea Imperiului Otoman și afirmarea Imperiului Habsburgic.\n\nÎ: Context extern, eveniment extern care a dus, a permis instaurarea regimului fanariot (2/2)\nPentru a nu pierde Moldova și Țara Românească, sultanul a adus domni străini de origine greacă sau albaneză, cum ar fi cei din familia Ipsilanti sau Mavrocordat. Astfel, Țările Române erau sub suzeranitate otomană și le era încălcată autonomia.\n\nÎ: Context intern, eveniment intern care a dus la instaurarea regimului fanariot\nÎn 1711, domnul Moldovei, Dimitrie Cantemir, aliat cu țarul Rusiei Petru I (cel Mare), au atacat Imperiul Otoman, dar au fost înfrânți la Stănilești.\n\nÎ: Context intern — consecința\nSultanul și-a pierdut încrederea în domnii români și a adus la tron domni străini, care plăteau sultanului pentru funcție o sumă de bani numită mucarer.\n\nÎ: Două caracteristici ale instituției centrale din spațiul românesc în secolul XVIII\nDomnia era grecizată, instabilă, iar domnul era funcționar otoman cu rang de pașă.\n\nÎ: Caracteristicile regimului fanariot / aspecte negative aduse de regimul fanariot / cauzele Revoluției din 1821\nÎncălcarea autonomiei, grecizarea domniei, instabilitate la tron, fiscalitate excesivă.\n\nÎ: Aspecte pozitive aduse de regimul fanariot\nDezvoltarea culturii și independența Bisericii Ortodoxe.\n\nÎ: Consecințele decăderii Imperiului Otoman asupra spațiului românesc — politico-juridic și economic\nConsecința privind statutul politico-juridic: menținerea suzeranității otomane și încălcarea autonomiei datorită regimului fanariot. Consecința economică: fiscalitate excesivă (sultan și domn).\n\nÎ: Consecințe teritoriale — secolul XVII\nÎn secolul XVII, în 1699, prin Pacea de la Karlowitz, Imperiul Otoman cedează Imperiului Habsburgic Transilvania.\n\nÎ: Consecințe teritoriale — secolul XVIII\nÎn secolul XVIII, în 1774, prin Pacea de la Kuciuk-Kainargi, Imperiul Otoman a cedat Imperiului Habsburgic Bucovina (nordul Moldovei).\n\nÎ: Consecințe teritoriale — secolul XIX\nÎn secolul XIX, în 1812, prin Pacea de la București, Imperiul Otoman a cedat Rusiei Basarabia (teritoriul dintre Prut și Nistru, o bucată din Moldova).\n\nÎ: Concluzie privind teritoriile\nImperiul Otoman a fost cel care a decis cedarea teritoriilor.",
    "questions": "De unde provine denumirea de „fanariot”? | cartierul Fanar din Constantinopol\nÎn ce an au încercat turcii să ocupe Viena? | 1683\nUnde au fost înfrânți Dimitrie Cantemir și Petru cel Mare în 1711? | Stănilești\nCum se numea suma plătită sultanului pentru domnie? | mucarer\nNumește două caracteristici ale domniei în secolul XVIII. | grecizată instabilă\nCare sunt aspectele pozitive ale regimului fanariot? | dezvoltarea culturii independența bisericii\nCe teritoriu a cedat Imperiul Otoman Rusiei în 1812? | Basarabia\nPrin ce pace a fost cedată Transilvania Imperiului Habsburgic în 1699? | Karlowitz"
  }
]

/** Creează foile, pune/actualizează lecțiile de mai sus, setează parola de admin (o vezi în Execution log). */
function setup() {
  getSheet(SHEET.runs, RUN_COLS).getRange('E:F').setNumberFormat(DATE_FORMAT)
  getSheet(SHEET.events, EVENT_COLS).getRange('C:C').setNumberFormat(DATE_FORMAT)
  const sheet = getSheet(SHEET.lessons, LESSON_COLS)

  LESSONS_SEED.forEach((l) => {
    const row = [l.id, l.chapter, l.title, l.order, l.text, l.questions]
    const found = sheet.getRange('A:A').createTextFinder(l.id).matchEntireCell(true).findNext()
    const rowIndex = found ? found.getRow() : sheet.getLastRow() + 1
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row])
  })

  // lecția demo nu mai e necesară când există lecții reale
  const demo = sheet.getRange('A:A').createTextFinder('demo').matchEntireCell(true).findNext()
  if (demo && LESSONS_SEED.length) sheet.deleteRow(demo.getRow())

  sheet.getRange('E:F').setWrap(true).setVerticalAlignment('top')
  sheet.setColumnWidth(5, 500)
  sheet.setColumnWidth(6, 350)

  const props = PropertiesService.getScriptProperties()
  if (!props.getProperty('ADMIN_KEY')) props.setProperty('ADMIN_KEY', Utilities.getUuid().slice(0, 12))
  Logger.log('Gata. Lecții: ' + readLessons().map((x) => x.title + ' (' + x.chunks.length + ' bucăți)').join(', '))
  Logger.log('Parola panoului (ADMIN_KEY): ' + props.getProperty('ADMIN_KEY'))
}
