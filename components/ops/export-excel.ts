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

export async function exportWorkbookToExcel(options: ExportExcelWorkbookOptions) {
  if (typeof window === "undefined") return;

  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CCTV Ops";
  workbook.created = new Date();
  workbook.modified = new Date();

  const usedNames = new Set<string>();
  for (const sheet of options.sheets) {
    const worksheet = workbook.addWorksheet(safeSheetName(sheet.title, usedNames), {
      views: [{ state: "frozen", ySplit: 3 }],
    });
    const columnCount = Math.max(sheet.columns.length, 1);

    worksheet.mergeCells(1, 1, 1, columnCount);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = `${options.title} - ${sheet.title}`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    titleCell.alignment = { vertical: "middle" };
    worksheet.getRow(1).height = 24;

    worksheet.mergeCells(2, 1, 2, columnCount);
    const metaCell = worksheet.getCell(2, 1);
    metaCell.value = `${options.subtitle ? `${options.subtitle} | ` : ""}Thời điểm xuất: ${nowLabel()}`;
    metaCell.font = { name: "Arial", size: 9, color: { argb: "FF4B5563" } };

    const headerRow = worksheet.getRow(3);
    headerRow.values = sheet.columns.map((column) => column.header);
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FF93C5FD" } } };
      cell.alignment = { vertical: "middle" };
    });

    if (sheet.rows.length === 0) {
      worksheet.mergeCells(4, 1, 4, columnCount);
      const emptyCell = worksheet.getCell(4, 1);
      emptyCell.value = sheet.emptyText ?? "Không có dữ liệu";
      emptyCell.font = { italic: true, color: { argb: "FF6B7280" } };
      emptyCell.alignment = { horizontal: "center" };
    } else {
      sheet.rows.forEach((row, rowIndex) => {
        const values = sheet.columns.map((column) => column.value(row, rowIndex) ?? "");
        const excelRow = worksheet.addRow(values);
        excelRow.eachCell((cell, columnIndex) => {
          const column = sheet.columns[columnIndex - 1];
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = {
            horizontal: column.align ?? "left",
            vertical: "top",
            wrapText: true,
          };
        });
      });
    }

    worksheet.columns.forEach((column, columnIndex) => {
      const headerLength = sheet.columns[columnIndex]?.header.length ?? 10;
      let maxLength = headerLength;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        maxLength = Math.max(maxLength, String(cell.value ?? "").length);
      });
      column.width = Math.min(Math.max(maxLength + 2, 12), 36);
    });

    worksheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: columnCount },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(options.filename)}.xlsx`;
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
