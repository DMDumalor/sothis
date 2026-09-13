/**
 * Minimal CSV parsing/serialization — just enough for the bulk-invite
 * template (a handful of short, mostly-unquoted columns). Handles quoted
 * fields, escaped quotes ("") and commas/newlines inside quotes, which
 * covers what a real spreadsheet export produces without pulling in a
 * dependency for it.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r') {
      // skip; \n (or end of text) closes the row
    } else if (char === '\n') {
      pushRow();
    } else {
      field += char;
    }
  }
  // Trailing field/row not terminated by a newline.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Parses a CSV with a header row into an array of column->value objects. */
export function parseCsvWithHeader(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (row[index] ?? '').trim();
    });
    return record;
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

/** Triggers a browser download of the given text as a named file. */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
