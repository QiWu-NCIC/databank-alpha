import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REQUIRED_HEADER =
  "Kernel,Machine&Compiler,DataType,Baseline tag,openSource,time phase,Matrix-all,Matrix,Time";

const eventPath = process.env.ISSUE_EVENT_PATH || process.env.GITHUB_EVENT_PATH;
const issueNumber = process.env.ISSUE_NUMBER || "unknown";
const outputDir = process.env.OUTPUT_DIR || ".github/tmp";

if (!eventPath) {
  throw new Error("GITHUB_EVENT_PATH is required.");
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const body = event.issue?.body || "";
const csvPath = path.join(outputDir, `spmv-issue-${issueNumber}.csv`);

fs.mkdirSync(outputDir, { recursive: true });

const uploadSection = getIssueFormSection(body, "Result CSV upload");
const upload = findCsvLink(uploadSection) || findCsvLink(body);

if (upload) {
  const response = await fetch(upload.url, {
    headers: process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${upload.url}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  validateCsvText(text, upload.label || upload.url);
  fs.writeFileSync(csvPath, text.endsWith("\n") ? text : `${text}\n`);
  writeGithubOutput("csv_path", csvPath);
  writeGithubOutput("csv_source", upload.url);
  console.log(`Extracted CSV attachment: ${upload.url}`);
} else {
  const pasted = cleanPastedCsv(getIssueFormSection(body, "Result CSV text"));
  validateCsvText(pasted, "Result CSV text");
  fs.writeFileSync(csvPath, pasted.endsWith("\n") ? pasted : `${pasted}\n`);
  writeGithubOutput("csv_path", csvPath);
  writeGithubOutput("csv_source", "issue body");
  console.log("Extracted CSV from issue body.");
}

function getIssueFormSection(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\n)### ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n### |$)`, "i");
  return markdown.match(pattern)?.[1]?.trim() || "";
}

function findCsvLink(markdown) {
  const links = [];
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let match;

  while ((match = markdownLinkPattern.exec(markdown))) {
    links.push({ label: match[1], url: match[2] });
  }

  const rawUrlPattern = /(https?:\/\/[^\s)]+(?:\.csv|\/[^\s)]*csv[^\s)]*))/g;
  while ((match = rawUrlPattern.exec(markdown))) {
    links.push({ label: match[1], url: match[1] });
  }

  return links.find((link) => /\.csv(?:[?#].*)?$/i.test(link.label) || /\.csv(?:[?#].*)?$/i.test(link.url));
}

function cleanPastedCsv(text) {
  const trimmed = text.trim();
  if (!trimmed || /^No response$/i.test(trimmed)) {
    return "";
  }

  const fenced = trimmed.match(/^```(?:csv)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] || trimmed).trim();
}

function validateCsvText(text, source) {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error("No CSV attachment or pasted CSV content was found.");
  }

  const firstLine = normalized.split(/\r?\n/, 1)[0].trim();
  if (firstLine !== REQUIRED_HEADER) {
    throw new Error(
      `${source} has an invalid header. Expected exactly: ${REQUIRED_HEADER}`,
    );
  }
}

function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  fs.appendFileSync(outputPath, `${name}=${value}\n`);
}
