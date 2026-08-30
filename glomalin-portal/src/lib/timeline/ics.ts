/**
 * Minimal ICS (iCalendar) parser for the group-calendar timeline source.
 *
 * Handles the shapes a Google Calendar "secret address in iCal format" feed
 * actually emits: VEVENT blocks with DTSTART/DTEND (date or date-time),
 * SUMMARY/LOCATION/DESCRIPTION, and simple RRULEs (DAILY/WEEKLY/MONTHLY with
 * optional COUNT/UNTIL). Anything fancier (BYDAY lists, EXDATE, timezones
 * beyond the date component) degrades to the base occurrence rather than
 * erroring — this feeds a farm ops calendar, not a scheduling engine.
 */

export interface IcsEvent {
  uid: string
  date: string // YYYY-MM-DD (start date; time-of-day dropped)
  endDate: string | null
  summary: string
  location: string | null
  description: string | null
  allDay: boolean
}

/** Unfold RFC 5545 folded lines (continuation lines start with space/tab). */
function unfold(text: string): string[] {
  const raw = text.split(/\r?\n/)
  const lines: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

/** "20260830" or "20260830T140000Z" → "2026-08-30" */
function icsDateToIso(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

interface RawEvent {
  uid: string
  dtstart: string | null
  dtend: string | null
  allDay: boolean
  summary: string
  location: string | null
  description: string | null
  rrule: string | null
}

const MAX_OCCURRENCES = 120

/** Expand one event (applying a simple RRULE) into dated occurrences inside [from, to]. */
function expand(ev: RawEvent, from: string, to: string): IcsEvent[] {
  if (!ev.dtstart) return []
  const durationDays =
    ev.dtend && ev.dtend > ev.dtstart
      ? Math.round((Date.parse(ev.dtend) - Date.parse(ev.dtstart)) / 86_400_000)
      : 0

  const make = (date: string, idx: number): IcsEvent => ({
    uid: idx === 0 ? ev.uid : `${ev.uid}#${idx}`,
    date,
    endDate: durationDays > 0 ? addDays(date, durationDays) : null,
    summary: ev.summary,
    location: ev.location,
    description: ev.description,
    allDay: ev.allDay,
  })

  if (!ev.rrule) {
    return ev.dtstart >= from && ev.dtstart <= to ? [make(ev.dtstart, 0)] : []
  }

  const params = new Map<string, string>()
  for (const part of ev.rrule.split(';')) {
    const [k, v] = part.split('=')
    if (k && v) params.set(k.toUpperCase(), v)
  }
  const freq = params.get('FREQ')
  const interval = Math.max(1, parseInt(params.get('INTERVAL') ?? '1', 10) || 1)
  const count = params.get('COUNT') ? parseInt(params.get('COUNT')!, 10) : null
  const until = params.get('UNTIL') ? icsDateToIso(params.get('UNTIL')!) : null

  const step = (iso: string): string => {
    if (freq === 'DAILY') return addDays(iso, interval)
    if (freq === 'WEEKLY') return addDays(iso, 7 * interval)
    if (freq === 'MONTHLY') return addMonths(iso, interval)
    if (freq === 'YEARLY') return addMonths(iso, 12 * interval)
    return addDays(iso, 100_000) // unknown freq — terminate after the base occurrence
  }

  const out: IcsEvent[] = []
  let cursor = ev.dtstart
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    if (count != null && i >= count) break
    if (until && cursor > until) break
    if (cursor > to) break
    if (cursor >= from) out.push(make(cursor, i))
    cursor = step(cursor)
  }
  return out
}

/** Parse an ICS document and return occurrences within [from, to] (ISO dates, inclusive). */
export function parseIcs(text: string, from: string, to: string): IcsEvent[] {
  const lines = unfold(text)
  const events: IcsEvent[] = []
  let current: RawEvent | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {
        uid: `ics-${events.length}`,
        dtstart: null,
        dtend: null,
        allDay: false,
        summary: '(no title)',
        location: null,
        description: null,
        rrule: null,
      }
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(...expand(current, from, to))
      current = null
      continue
    }
    if (!current) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const keyPart = line.slice(0, colon)
    const value = line.slice(colon + 1)
    const key = keyPart.split(';')[0].toUpperCase()

    if (key === 'UID') current.uid = `ics-${value}`
    else if (key === 'DTSTART') {
      current.dtstart = icsDateToIso(value)
      current.allDay = keyPart.toUpperCase().includes('VALUE=DATE') || !value.includes('T')
    } else if (key === 'DTEND') {
      const iso = icsDateToIso(value)
      // all-day DTEND is exclusive per RFC — pull back one day
      current.dtend = iso && (keyPart.toUpperCase().includes('VALUE=DATE') || !value.includes('T'))
        ? addDays(iso, -1)
        : iso
    } else if (key === 'SUMMARY') current.summary = value.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim() || '(no title)'
    else if (key === 'LOCATION') current.location = value.replace(/\\,/g, ',').trim() || null
    else if (key === 'DESCRIPTION') current.description = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').slice(0, 500) || null
    else if (key === 'RRULE') current.rrule = value
  }

  return events
}
