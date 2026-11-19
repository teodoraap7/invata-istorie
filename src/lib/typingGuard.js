// A doua linie de apărare împotriva lipirii textului (pe lângă blocarea evenimentului „paste”).
// Cineva poate opri din consolă (F12) evenimentul „paste”, dar textul tot ajunge în câmp printr-un
// eveniment „input”. Aici verificăm fiecare „input”:
//  - tipul lui (insertFromPaste / insertFromDrop) => lipire, o anulăm;
//  - câte caractere au apărut deodată: tastând apare 1 caracter (pe telefon, un cuvânt) => salt mare, îl anulăm;
// iar la „Verifică” ne uităm dacă textul chiar a fost tastat (destule evenimente de tastare pentru lungimea lui).

const MAX_CHARS_AT_ONCE = 30 // un cuvânt lung din sugestiile tastaturii de pe telefon încape
const MIN_INPUTS_PER_CHAR = 1 / 15 // cel puțin un eveniment de tastare la 15 caractere

const PASTE_TYPES = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank'])

/**
 * @param textRef  ref-ul cu textul din câmp
 * @param onBlocked(reason, chars)  apelat când anulăm o lipire
 */
export function useTypingGuard(textRef, onBlocked) {
  let inputs = 0
  let last = textRef.value || ''

  function onBeforeInput(e) {
    if (PASTE_TYPES.has(e.inputType)) {
      e.preventDefault()
      onBlocked('paste', (e.data || '').length)
    }
  }

  function onInput(e) {
    const value = e.target.value
    const added = value.length - last.length
    if (PASTE_TYPES.has(e.inputType) || added > MAX_CHARS_AT_ONCE) {
      e.target.value = last // anulăm: textul revine la ce era înainte
      onBlocked(PASTE_TYPES.has(e.inputType) ? 'paste' : 'jump', added)
      return
    }
    inputs++
    last = value
    textRef.value = value
  }

  /** La „Verifică”: textul a fost chiar tastat? (altfel a apărut „din senin” — ex. scris din consolă) */
  function typedByHand() {
    const len = (textRef.value || '').trim().length
    return len < 20 || inputs >= len * MIN_INPUTS_PER_CHAR
  }

  return { onBeforeInput, onInput, typedByHand }
}
