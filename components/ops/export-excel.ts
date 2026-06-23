"use client";

type ExcelCellValue = string | number | null | undefined;

export type ExcelColumn<T> = {
  header: string;
  value: (row: T, index: number) => ExcelCellValue;
  align?: "left" | "center" | "right";
};

export type ExcelSection<T = Record<string, unknown>> = {
  title: string;
  columns: ReadonlyArray<ExcelColumn<T>>;
  rows: ReadonlyArray<T>;
  emptyText?: string;
};

type ResolvedExcelColumn = {
  header: string;
  value: (row: unknown, index: number) => ExcelCellValue;
  align?: "left" | "center" | "right";
};

export type ResolvedExcelSection = {
  title: string;
  columns: ReadonlyArray<ResolvedExcelColumn>;
  rows: ReadonlyArray<unknown>;
  emptyText?: string;
};

type ExportExcelOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  sections: ReadonlyArray<ResolvedExcelSection>;
};

type ExportExcelWorkbookOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  sheets: ReadonlyArray<ResolvedExcelSection>;
};

function escapeHtml(value: ExcelCellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("\n", "<br />");
}

function escapeXml(value: ExcelCellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function nowLabel() {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function safeSheetName(value: string, usedNames: Set<string>) {
  const baseName = value
    .trim()
    .replace(/[\\/:*?[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 31) || "Sheet";
  let sheetName = baseName;
  let suffix = 2;

  while (usedNames.has(sheetName.toLocaleLowerCase("vi"))) {
    const suffixText = ` ${suffix}`;
    sheetName = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  usedNames.add(sheetName.toLocaleLowerCase("vi"));
  return sheetName;
}

export function createExcelSection<T>(section: ExcelSection<T>): ResolvedExcelSection {
  return {
    ...section,
    rows: section.rows as ReadonlyArray<unknown>,
    columns: section.columns.map((column) => ({
      ...column,
      value: (row: unknown, index: number) => column.value(row as T, index),
    })),
  };
}

function renderSection(section: ResolvedExcelSection) {
  const columnCount = Math.max(section.columns.length, 1);
  const bodyRows = section.rows.length > 0
    ? section.rows.map((row, rowIndex) => (
      `<tr>${section.columns.map((column) => {
        const value = column.value(row, rowIndex);
        return `<td class="${column.align ?? "left"}">${escapeHtml(value)}</td>`;
      }).join("")}</tr>`
    )).join("")
    : `<tr><td colspan="${columnCount}" class="empty">${escapeHtml(section.emptyText ?? "Không có dữ liệu")}</td></tr>`;

  return `
    <table>
      <thead>
        <tr><th colspan="${columnCount}" class="section-title">${escapeHtml(section.title)}</th></tr>
        <tr>${section.columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("")}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

export function exportSectionsToExcel(options: ExportExcelOptions) {
  if (typeof window === "undefined") return;

  const html = `<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { color: #4b5563; font-size: 12px; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: top; mso-number-format: "\\@"; }
          th { background: #eff6ff; color: #0f172a; font-weight: 700; }
          .section-title { background: #1d4ed8; color: #ffffff; text-align: left; font-size: 14px; }
          .right { text-align: right; }
          .center { text-align: center; }
          .left { text-align: left; }
          .empty { color: #6b7280; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(options.title)}</h1>
        <div class="meta">
          ${options.subtitle ? `${escapeHtml(options.subtitle)}<br />` : ""}
          Thời điểm xuất: ${escapeHtml(nowLabel())}
        </div>
        ${options.sections.map((section) => renderSection(section)).join("")}
      </body>
    </html>`;

  const blob = new Blob([`\ufeff${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(options.filename)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderWorkbookCell(value: ExcelCellValue, styleId?: string) {
  const type = typeof value === "number" && Number.isFinite(value) ? "Number" : "String";
  const content = type === "Number" ? String(value) : escapeXml(value);
  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="${type}">${content}</Data></Cell>`;
}

function renderWorksheet(
  section: ResolvedExcelSection,
  sheetName: string,
  title: string,
  subtitle?: string,
) {
  const columnCount = Math.max(section.columns.length, 1);
  const columns = section.columns.map(() => '<Column ss:AutoFitWidth="1" ss:Width="120"/>').join("");
  const headerCells = section.columns.map((column) => renderWorkbookCell(column.header, "Header")).join("");
  const bodyRows = section.rows.length > 0
    ? section.rows.map((row, rowIndex) => {
      const cells = section.columns.map((column) => {
        const alignmentStyle = column.align === "right"
          ? "Right"
          : column.align === "center"
            ? "Center"
            : undefined;
        return renderWorkbookCell(column.value(row, rowIndex), alignmentStyle);
      }).join("");
      return `<Row>${cells}</Row>`;
    }).join("")
    : `<Row><Cell ss:MergeAcross="${Math.max(columnCount - 1, 0)}" ss:StyleID="Empty"><Data ss:Type="String">${escapeXml(section.emptyText ?? "Không có dữ liệu")}</Data></Cell></Row>`;

  return `
    <Worksheet ss:Name="${escapeXml(sheetName)}">
      <Table>
        ${columns}
        <Row ss:Height="24">
          <Cell ss:MergeAcross="${Math.max(columnCount - 1, 0)}" ss:StyleID="Title">
            <Data ss:Type="String">${escapeXml(title)} - ${escapeXml(section.title)}</Data>
          </Cell>
        </Row>
        <Row>
          <Cell ss:MergeAcross="${Math.max(columnCount - 1, 0)}" ss:StyleID="Meta">
            <Data ss:Type="String">${escapeXml(subtitle ?? "")}${subtitle ? " | " : ""}Thời điểm xuất: ${escapeXml(nowLabel())}</Data>
          </Cell>
        </Row>
        <Row>${headerCells}</Row>
        ${bodyRows}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>3</SplitHorizontal>
        <TopRowBottomPane>3</TopRowBottomPane>
        <ActivePane>2</ActivePane>
        <ProtectObjects>False</ProtectObjects>
        <ProtectScenarios>False</ProtectScenarios>
      </WorksheetOptions>
    </Worksheet>
  `;
}

export function exportWorkbookToExcel(options: ExportExcelWorkbookOptions) {
  if (typeof window === "undefined") return;

  const usedNames = new Set<string>();
  const worksheets = options.sheets.map((sheet) => renderWorksheet(
    sheet,
    safeSheetName(sheet.title, usedNames),
    options.title,
    options.subtitle,
  )).join("");
  const workbook = `<?xml version="1.0"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook
      xmlns="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
      xmlns:html="http://www.w3.org/TR/REC-html40">
      <Styles>
        <Style ss:ID="Default" ss:Name="Normal">
          <Alignment ss:Vertical="Top"/>
          <Font ss:FontName="Arial" ss:Size="10"/>
        </Style>
        <Style ss:ID="Title">
          <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/>
          <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
          <Alignment ss:Vertical="Center"/>
        </Style>
        <Style ss:ID="Meta">
          <Font ss:FontName="Arial" ss:Size="9" ss:Color="#4B5563"/>
        </Style>
        <Style ss:ID="Header">
          <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
          <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
          <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD"/></Borders>
        </Style>
        <Style ss:ID="Right"><Alignment ss:Horizontal="Right" ss:Vertical="Top"/></Style>
        <Style ss:ID="Center"><Alignment ss:Horizontal="Center" ss:Vertical="Top"/></Style>
        <Style ss:ID="Empty"><Font ss:Color="#6B7280" ss:Italic="1"/><Alignment ss:Horizontal="Center"/></Style>
      </Styles>
      ${worksheets}
    </Workbook>`;

  const blob = new Blob([`\ufeff${workbook}`], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(options.filename)}.xml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportTableToExcel<T>({
  title,
  subtitle,
  filename,
  columns,
  rows,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ReadonlyArray<ExcelColumn<T>>;
  rows: ReadonlyArray<T>;
  emptyText?: string;
}) {
  exportSectionsToExcel({
    title,
    subtitle,
    filename,
    sections: [createExcelSection({ title, columns, rows, emptyText })],
  });
}
