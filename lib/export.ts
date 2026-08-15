/**
 * Client-side file downloads — CSV exports and calendar invites.
 *
 * These run entirely in the browser on data the screen already has. There is no
 * server round trip because there is nothing the server knows that the export
 * needs: the ledger, the report tables and the class list are all in memory by
 * the time the button is visible.
 */

/**
 * Escape one CSV cell.
 *
 * Quoting is not optional here: member names contain commas, notes contain
 * quotes and addresses contain newlines, and any one of those silently shifts
 * every following column in the row. A leading `=`, `+`, `-` or `@` is prefixed
 * with a quote because spreadsheets treat those as formulas — a member called
 * `=Sharma` would otherwise open as `#NAME?` in Excel, and a crafted value is a
 * real injection route into whoever opens the file.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export interface CsvColumn<T> {
  header: string
  value: (row: T, index: number) => unknown
}

/** Build a CSV string from rows and a column spec. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => cell(c.header)).join(',')
  const body = rows.map((r, i) => columns.map((c) => cell(c.value(r, i))).join(','))
  return [head, ...body].join('\r\n')
}

/**
 * Hand a file to the browser.
 *
 * The BOM is there so Excel on Windows reads the file as UTF-8; without it,
 * every ₹ and every non-ASCII name renders as mojibake, which is the most
 * common way a working export still gets reported as broken.
 */
export function download(filename: string, contents: string, mime = 'text/csv;charset=utf-8'): void {
  const bom = mime.startsWith('text/csv') ? '\uFEFF' : ''
  const blob = new Blob([bom + contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): number {
  download(filename, toCsv(rows, columns))
  return rows.length
}

/** `flexfit-payments-2026-08-15.csv` — dated so two exports never overwrite. */
export function datedFilename(stem: string, ext = 'csv'): string {
  const d = new Date()
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `flexfit-${stem}-${iso}.${ext}`
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                     */
/* -------------------------------------------------------------------------- */

function icsStamp(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** Fold a line to 75 octets as RFC 5545 requires, or Outlook drops the tail. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest) parts.push(' ' + rest)
  return parts.join('\r\n')
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export interface CalendarEvent {
  uid: string
  title: string
  description?: string
  location?: string
  start: Date
  durationMin: number
}

/**
 * A real `.ics` file, which is what "Add to calendar" has to produce to work
 * everywhere — Apple Calendar, Google, Outlook all import it, and none of them
 * needs an account or a link.
 */
export function toIcs(events: CalendarEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FlexFit Studio//EN', 'CALSCALE:GREGORIAN']
  for (const e of events) {
    const end = new Date(e.start.getTime() + e.durationMin * 60_000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@flexfit.studio`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(e.start)}`,
      `DTEND:${icsStamp(end)}`,
      fold(`SUMMARY:${escapeIcs(e.title)}`),
      ...(e.description ? [fold(`DESCRIPTION:${escapeIcs(e.description)}`)] : []),
      ...(e.location ? [fold(`LOCATION:${escapeIcs(e.location)}`)] : []),
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(filename: string, events: CalendarEvent[]): void {
  download(filename, toIcs(events), 'text/calendar;charset=utf-8')
}
