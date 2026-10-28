import * as XLSX from 'xlsx';
import {
  COLUMN_DOCS,
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  TEMPLATE_EXAMPLE_ROWS,
  columnForHeader,
  excelSerialToParts,
  type ImportColumn,
} from '../../../shared/import';
import type { ImportRowDTO } from '../../../shared/types';

const DATE_COLUMNS: ImportColumn[] = ['schedule_date'];
const TIME_COLUMNS: ImportColumn[] = ['schedule_time'];
const DATETIME_COLUMNS: ImportColumn[] = ['start_datetime', 'end_datetime'];

/** Converts Excel serial numbers in date/time columns to the text formats the server expects. */
function cellToText(column: ImportColumn | null, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && column) {
    if (DATE_COLUMNS.includes(column) && value > 59) return excelSerialToParts(value).date;
    if (TIME_COLUMNS.includes(column) && value >= 0 && value < 1) return excelSerialToParts(value).time;
    if (DATETIME_COLUMNS.includes(column) && value > 59) {
      const { date, time } = excelSerialToParts(value);
      return Number.isInteger(value) ? date : `${date} ${time}`;
    }
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value).trim();
}

/** Reads the "Posts" sheet (or the first sheet) into rows keyed by the original headers. */
export async function parseSheet(file: File): Promise<{ rows: Record<string, string>[]; sheetName: string }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: /\.csv$/i.test(file.name) });
  const sheetName = workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'posts') ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error('The file has no sheets.');
  const sheet = workbook.Sheets[sheetName]!;
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true, blankrows: false });
  if (json.length > IMPORT_MAX_ROWS) throw new Error(`The sheet has ${json.length} rows; the limit is ${IMPORT_MAX_ROWS} per import.`);
  const rows = json.map((row) => {
    const out: Record<string, string> = {};
    for (const [header, value] of Object.entries(row)) {
      if (header.startsWith('__EMPTY')) continue;
      const text = cellToText(columnForHeader(header), value);
      if (text) out[header] = text.slice(0, 5000);
    }
    return out;
  });
  return { rows: rows.filter((r) => Object.keys(r).length > 0), sheetName };
}

function autoWidth(rows: string[][]): { wch: number }[] {
  const widths = rows[0]?.map((_, c) => Math.min(60, Math.max(...rows.map((r) => String(r[c] ?? '').length), 10) + 2)) ?? [];
  return widths.map((wch) => ({ wch }));
}

/** Generates orbitpost-template.xlsx with a Posts sheet (headers + examples) and Instructions. */
export function downloadTemplate(): void {
  const posts = [IMPORT_COLUMNS as readonly string[], ...TEMPLATE_EXAMPLE_ROWS.map((r) => IMPORT_COLUMNS.map((c) => r[c] ?? ''))] as string[][];
  const postsSheet = XLSX.utils.aoa_to_sheet(posts);
  postsSheet['!cols'] = IMPORT_COLUMNS.map((c) => ({ wch: c === 'post_content' ? 60 : Math.max(14, c.length + 4) }));
  postsSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  const instructions = [
    ['Column', 'Required', 'What it means', 'Allowed values'],
    ...IMPORT_COLUMNS.map((c) => [c, COLUMN_DOCS[c].required ? 'Yes' : 'No', COLUMN_DOCS[c].description, COLUMN_DOCS[c].allowed ?? '']),
    [],
    ['Tips'],
    ['Header names are not case-sensitive, and common names like "Business", "Email" or "Content" also work.'],
    ['One business can be managed by several Gmails: the gmail column decides which one publishes.'],
    ['Rows without schedule_date use the option you choose on the preview screen (ASAP or spread across dates).'],
    ['Times are in each location\'s own time zone (set on the Locations page).'],
    ['Images named in the image column must be uploaded together with the sheet (files or a ZIP).'],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  instructionsSheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 90 }, { wch: 44 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, postsSheet, 'Posts');
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');
  XLSX.writeFile(wb, 'orbitpost-template.xlsx');
}

/** Exports rows that need attention (original cells + status + problems) for fixing offline. */
export function downloadErrorRows(filename: string, rows: ImportRowDTO[]): void {
  const header = [...IMPORT_COLUMNS, 'row_number', 'status', 'problems'];
  const body = rows.map((r) => [
    ...IMPORT_COLUMNS.map((c) => r.raw[c] ?? ''),
    String(r.row_number),
    r.status === 'needs_review' ? 'needs review' : r.status,
    [...r.errors, ...r.warnings].join(' | '),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  sheet['!cols'] = autoWidth([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Posts');
  XLSX.writeFile(wb, `${filename.replace(/\.(xlsx|xls|csv)$/i, '')}-errors.xlsx`);
}
