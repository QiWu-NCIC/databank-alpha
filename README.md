# databank-web

Databank Web is a static Vue site for collecting and displaying sparse operator benchmark results such as SpMV and SpMM.

Public site:

- Alpha: <https://qiwu-ncic.github.io/databank-alpha/>
- SpMV page: <https://qiwu-ncic.github.io/databank-alpha/#/spmv>

## Data Files

The SpMV page reads benchmark data from:

```text
public/file/SPMV.csv
```

Result submissions use a long-form CSV template:

```text
public/file/SPMV-template.csv
```

Required columns:

```csv
Kernel,Machine&Compiler,DataType,Baseline tag,openSource,time phase,Matrix-all,Matrix,Time
```

Column meaning:

- `Kernel`: implementation name shown in the result table.
- `Machine&Compiler`: hardware and software environment, for example `NVIDIA GeForce RTX 5090 / Triton 3.6.0`.
- `DataType`: data type, for example `double` or `single`.
- `Baseline tag`: `T` for baseline rows, `F` for non-baseline result rows.
- `openSource`: `Y` or `N`.
- `time phase`: benchmark phase, for example `solve_only`.
- `Matrix-all`: aggregate score, usually geometric mean speedup.
- `Matrix`: matrix name.
- `Time`: measured time for that matrix.

Each row contains one result for one matrix. Multiple kernels, baselines, machines, or data types can be included in the same CSV by adding more rows.

## Submit Results

Users submit results through GitHub Issues:

1. Open a new `SPMV Result Submission` issue.
2. Select the operator.
3. Upload a completed long-form CSV in `Result CSV upload`.
4. If upload is inconvenient, paste the CSV content into `Result CSV text`.
5. Add source code URL or notes when useful.

The Issue Form does not duplicate CSV metadata. The uploaded CSV is the source of truth for kernel name, machine, data type, baseline tag, matrix names, and timing values.

## Import Submitted SpMV Results

For maintainers, download the submitted CSV and run a dry run first:

```bash
npm run import:spmv -- path/to/result.csv --dry-run
```

If the dry run looks correct, import it into `public/file/SPMV.csv`:

```bash
npm run import:spmv -- path/to/result.csv
```

The importer:

- updates an existing result row when `Kernel + Machine&Compiler + DataType + time phase` already exists;
- adds a new result row when that key is new;
- writes each `Time` value into the matching `Matrix` column;
- adds new matrix columns when the uploaded CSV contains new matrix names.

After import, review the diff, commit `public/file/SPMV.csv`, and push. GitHub Pages deployment updates the website; closing the issue is only a bookkeeping step and does not affect deployment.

## Development

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Build the static site:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Notes For Future Operators

SpMM or other operators can reuse the same pattern:

- keep the displayed database in `public/file/<OPERATOR>.csv`;
- provide a long-form upload template in `public/file/<OPERATOR>-template.csv`;
- keep Issue Forms upload-first and use CSV as the source of truth;
- add an importer script that maps long-form submitted results into the display CSV.
