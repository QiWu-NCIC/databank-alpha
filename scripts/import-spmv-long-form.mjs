import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TARGET_CSV = "public/file/SPMV.csv";
const REQUIRED_LONG_HEADERS = [
  "Kernel",
  "Machine&Compiler",
  "DataType",
  "Baseline tag",
  "openSource",
  "time phase",
  "Matrix-all",
  "Matrix",
  "Time",
];
const META_HEADERS = [
  "Kernel",
  "Machine&Compiler",
  "DataType",
  "Baseline tag",
  "openSource",
  "time phase",
  "Matrix-all",
];
const KEY_HEADERS = ["Kernel", "Machine&Compiler", "DataType", "time phase"];

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");

if (!inputPath) {
  console.error("Usage: npm run import:spmv -- <long-form-result.csv> [--dry-run]");
  process.exit(1);
}

const sourceRows = parseCsv(fs.readFileSync(inputPath, "utf8"));
const targetRows = parseCsv(fs.readFileSync(TARGET_CSV, "utf8"));

if (sourceRows.length < 2) {
  throw new Error("Input CSV must include a header row and at least one result row.");
}
if (targetRows.length < 2) {
  throw new Error(`${TARGET_CSV} must include a header row and descriptor row.`);
}

const sourceHeaders = sourceRows[0];
const targetHeaders = targetRows[0];
validateRequiredHeaders(sourceHeaders, REQUIRED_LONG_HEADERS, inputPath);
validateRequiredHeaders(targetHeaders, META_HEADERS, TARGET_CSV);

const sourceIndexes = makeIndex(sourceHeaders);
const targetIndexes = makeIndex(targetHeaders);
const dataStartIndex = 2;
const existingRowByKey = new Map();
const newMatrixColumns = [];
let addedRows = 0;
let updatedRows = 0;
let writtenCells = 0;

for (let i = dataStartIndex; i < targetRows.length; i += 1) {
  const row = targetRows[i];
  existingRowByKey.set(makeRowKey(row, targetIndexes), row);
}

for (const sourceRow of sourceRows.slice(1)) {
  if (sourceRow.every((cell) => !String(cell ?? "").trim())) {
    continue;
  }

  const matrix = getRequiredCell(sourceRow, sourceIndexes, "Matrix");
  const time = getRequiredCell(sourceRow, sourceIndexes, "Time");
  const key = makeRowKey(sourceRow, sourceIndexes);
  const targetColumnIndex = ensureTargetColumn(targetRows, targetIndexes, matrix);

  let targetRow = existingRowByKey.get(key);
  if (!targetRow) {
    targetRow = Array(targetHeaders.length).fill("");
    for (const header of META_HEADERS) {
      targetRow[targetIndexes[header]] = getRequiredCell(sourceRow, sourceIndexes, header);
    }
    targetRows.push(targetRow);
    existingRowByKey.set(key, targetRow);
    addedRows += 1;
  } else {
    for (const header of META_HEADERS) {
      targetRow[targetIndexes[header]] = getRequiredCell(sourceRow, sourceIndexes, header);
    }
    updatedRows += 1;
  }

  targetRow[targetColumnIndex] = time;
  writtenCells += 1;
}

if (!dryRun) {
  fs.writeFileSync(TARGET_CSV, stringifyCsv(targetRows));
}

console.log(
  JSON.stringify(
    {
      target: path.normalize(TARGET_CSV),
      input: path.normalize(inputPath),
      dryRun,
      addedRows,
      updatedRows,
      writtenCells,
      newMatrixColumns,
    },
    null,
    2,
  ),
);

function ensureTargetColumn(rows, indexes, header) {
  if (indexes[header] !== undefined) {
    return indexes[header];
  }

  const nextIndex = rows[0].length;
  rows[0].push(header);
  indexes[header] = nextIndex;
  newMatrixColumns.push(header);

  for (let i = 1; i < rows.length; i += 1) {
    rows[i][nextIndex] = "";
  }

  return nextIndex;
}

function validateRequiredHeaders(headers, requiredHeaders, filePath) {
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) {
    throw new Error(`${filePath} is missing required header(s): ${missingHeaders.join(", ")}`);
  }
}

function makeIndex(headers) {
  return Object.fromEntries(headers.map((header, index) => [header, index]));
}

function makeRowKey(row, indexes) {
  return KEY_HEADERS.map((header) => getRequiredCell(row, indexes, header)).join("\u001f");
}

function getRequiredCell(row, indexes, header) {
  const value = row[indexes[header]];
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Missing required value for "${header}".`);
  }
  return normalized;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => cell !== ""));
}

function stringifyCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
