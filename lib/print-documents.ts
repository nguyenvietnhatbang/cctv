import { brandAssets, companyProfile } from "@/lib/company";

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function money(value: unknown) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function dateTime(value: unknown) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(String(value)));
}

export function printDocumentResponse({
  title,
  documentTitle,
  documentCode,
  sections,
  footer,
}: {
  title: string;
  documentTitle: string;
  documentCode: string;
  sections: string;
  footer: string;
}) {
  const logoSrc = encodeURI(brandAssets.fullLogo);

  return new Response(
    `<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 16mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; color: #111827; background: #f1f5f9; }
          .page { max-width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; padding: 18mm; }
          .print-actions { max-width: 210mm; margin: 16px auto; display: flex; justify-content: flex-end; padding: 0 12px; }
          button { min-height: 44px; border: 1px solid #1d4ed8; border-radius: 6px; background: #2563eb; color: #ffffff; padding: 10px 14px; font-weight: 700; cursor: pointer; }
          header { display: grid; grid-template-columns: 170px 1fr; gap: 20px; align-items: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 14px; }
          .logo { width: 160px; max-height: 75px; object-fit: contain; }
          .company h2 { margin: 0 0 8px; font-size: 16px; color: #0f172a; text-transform: uppercase; }
          .company p { margin: 3px 0; font-size: 11px; line-height: 1.4; color: #475569; }
          h1 { margin: 22px 0 6px; text-align: center; font-size: 22px; letter-spacing: .02em; text-transform: uppercase; }
          .doc-code { text-align: center; color: #475569; font-size: 12px; margin-bottom: 18px; }
          .section { margin-top: 16px; border: 1px solid #dbeafe; border-radius: 8px; overflow: hidden; break-inside: avoid; }
          .section-title { background: #eff6ff; border-bottom: 1px solid #dbeafe; padding: 8px 10px; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
          .section-body { padding: 10px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
          .info-item span { display: block; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .info-item strong, .info-item p { margin: 3px 0 0; font-size: 12px; color: #111827; line-height: 1.45; }
          .full { grid-column: 1 / -1; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 11px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; font-weight: 800; color: #334155; }
          .right { text-align: right; }
          .center { text-align: center; }
          .totals { margin-left: auto; width: 330px; }
          .totals td { border: 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
          .totals .grand td { font-size: 15px; font-weight: 800; color: #1d4ed8; }
          .note-box { min-height: 70px; white-space: pre-wrap; line-height: 1.5; }
          .signature { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 70px; text-align: center; break-inside: avoid; }
          .signature p { margin: 0; font-size: 12px; font-weight: 800; text-transform: uppercase; }
          .signature small { display: block; margin-top: 4px; color: #64748b; }
          .signature-line { margin-top: 70px; font-weight: 800; }
          footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #64748b; text-align: center; }
          @media (max-width: 720px) {
            body { background: #ffffff; }
            .print-actions { position: sticky; top: 0; z-index: 10; margin: 0; padding: 10px; background: #ffffff; border-bottom: 1px solid #e5e7eb; }
            .print-actions button { width: 100%; }
            .page { width: 100%; min-height: auto; padding: 16px; }
            header { grid-template-columns: 1fr; gap: 10px; text-align: center; }
            .logo { width: 150px; margin: 0 auto; }
            h1 { font-size: 18px; line-height: 1.25; }
            .info-grid { grid-template-columns: 1fr; }
            .full { grid-column: auto; }
            .section { border-radius: 6px; }
            .section-body { padding: 8px; }
            .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
            .table-scroll table { min-width: 620px; }
            .totals { width: 100%; }
            .signature { grid-template-columns: 1fr; gap: 36px; }
          }
          @media print {
            body { background: #ffffff; }
            .print-actions { display: none; }
            .page { padding: 0; max-width: none; min-height: auto; }
            .table-scroll { overflow: visible; }
            .table-scroll table { min-width: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-actions">
          <button onclick="window.print()">In / Lưu PDF</button>
        </div>
        <main class="page">
          <header>
            <img class="logo" src="${logoSrc}" alt="${escapeHtml(companyProfile.legalName)}" />
            <div class="company">
              <h2>${escapeHtml(companyProfile.legalName)}</h2>
              <p><strong>Mã số thuế:</strong> ${escapeHtml(companyProfile.taxCode)} - <strong>Website:</strong> ${escapeHtml(companyProfile.website)}</p>
              <p><strong>Văn phòng:</strong> ${escapeHtml(companyProfile.officeAddress)}</p>
              <p><strong>Điện thoại:</strong> ${escapeHtml(companyProfile.consultationPhone)} - <strong>Hỗ trợ kỹ thuật:</strong> ${escapeHtml(companyProfile.technicalSupportPhone)} - <strong>Email:</strong> ${escapeHtml(companyProfile.email)}</p>
            </div>
          </header>
          <h1>${escapeHtml(documentTitle)}</h1>
          <div class="doc-code">${escapeHtml(documentCode)} - Ngày in: ${dateTime(new Date().toISOString())}</div>
          ${sections}
          <footer>${escapeHtml(footer)}</footer>
        </main>
      </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
