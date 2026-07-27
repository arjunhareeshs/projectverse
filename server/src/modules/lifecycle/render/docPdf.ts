import PDFDocument from 'pdfkit';
import { ExecutionDocContent } from '../../../shared/projectLog.types';

/**
 * Executive Publication-Grade PDF Generator for Project Execution Documents.
 * Formats multi-page engineering plans with dynamic table height calculations,
 * clean list indentations, callout boxes, risk badges, and running pagination.
 */
export function renderDocPdfBuffer(doc: ExecutionDocContent, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      margin: 40,
      size: 'A4',
      bufferPages: true,
    });
    const buffers: Buffer[] = [];

    pdf.on('data', (chunk) => buffers.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(buffers)));
    pdf.on('error', (err) => reject(err));

    const PrimaryColor = '#0F172A'; // Dark Slate Header
    const AccentColor = '#4F46E5';  // Indigo Accent
    const BorderColor = '#E2E8F0';  // Slate 200
    const CalloutBg = '#F8FAFC';    // Slate 50
    const MutedText = '#64748B';    // Slate 500
    const DarkText = '#1E293B';     // Slate 800

    const contentWidth = 515; // 595.28 (A4 width) - 80 margin
    const maxY = 770;          // Printable page boundary (A4 height 841.89 - 40 margin)

    // Helper for Page-Break Checking
    const checkPageBreak = (neededHeight: number = 30) => {
      if (pdf.y + neededHeight > maxY) {
        pdf.addPage();
        pdf.y = 50; // top padding on new page below running header line
      }
    };

    // ── Document Banner Header ───────────────────────────────────────────────
    pdf.rect(40, 40, contentWidth, 55).fill(PrimaryColor);

    pdf
      .fillColor('#FFFFFF')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('PROJECT EXECUTION PLAN', 52, 50, { width: contentWidth - 24 });

    pdf
      .fillColor('#94A3B8')
      .fontSize(10)
      .font('Helvetica')
      .text(title.toUpperCase(), 52, 68, { width: contentWidth - 24 });

    pdf.y = 105;

    // Uniqueness Scope Note (if present)
    if (doc.uniquenessNotes) {
      checkPageBreak(35);
      const curY = pdf.y;
      pdf
        .rect(40, curY, contentWidth, 26)
        .fillAndStroke('#EEF2FF', '#C7D2FE');

      pdf
        .fillColor(AccentColor)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('SCOPE VARIATION BREADCRUMB: ', 50, curY + 8, { width: 160 });

      pdf
        .fillColor(DarkText)
        .font('Helvetica')
        .text(doc.uniquenessNotes, 210, curY + 8, { width: contentWidth - 170 });

      pdf.y = curY + 32;
    }

    // Helper for Section Titles
    const addSectionTitle = (num: string, label: string) => {
      checkPageBreak(35);
      const titleY = pdf.y + 6;

      pdf
        .fillColor(AccentColor)
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .text(`${num}. ${label.toUpperCase()}`, 40, titleY);

      pdf
        .moveTo(40, pdf.y + 2)
        .lineTo(555, pdf.y + 2)
        .strokeColor(BorderColor)
        .lineWidth(1)
        .stroke();

      pdf.y = pdf.y + 8;
    };

    // Helper for Callout Boxes
    const addCalloutBox = (label: string, text: string) => {
      if (!text) return;
      pdf.fontSize(8.5).font('Helvetica');

      const textHeight = pdf.heightOfString(text, { width: contentWidth - 26 });
      const boxHeight = textHeight + 20;

      checkPageBreak(boxHeight + 6);

      const currentY = pdf.y;
      pdf.rect(40, currentY, contentWidth, boxHeight).fill(CalloutBg);
      pdf.rect(40, currentY, 4, boxHeight).fill(AccentColor);

      pdf
        .fillColor(AccentColor)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(label.toUpperCase(), 50, currentY + 6, { width: contentWidth - 26 });

      pdf
        .fillColor(DarkText)
        .fontSize(8.5)
        .font('Helvetica')
        .text(text, 50, currentY + 16, { width: contentWidth - 26, lineGap: 1.5 });

      pdf.y = currentY + boxHeight + 6;
    };

    // ── 1. OVERVIEW ─────────────────────────────────────────────────────────
    addSectionTitle('1', 'Executive Overview & Problem Scope');
    addCalloutBox('Problem Statement', doc.overview?.problemStatement || '');
    addCalloutBox('Background & Context', doc.overview?.background || '');
    addCalloutBox('Purpose & Core Value', doc.overview?.purpose || '');
    addCalloutBox('Scope Boundaries', doc.overview?.scope || '');
    addCalloutBox('Expected Outcome & Impact', doc.overview?.expectedOutcome || '');

    // ── 2. OBJECTIVES & DELIVERABLES ────────────────────────────────────────
    addSectionTitle('2', 'Project Objectives & Key Deliverables');

    if (doc.objectives && doc.objectives.length > 0) {
      checkPageBreak(25);
      pdf.fillColor(DarkText).fontSize(9).font('Helvetica-Bold').text('Core Objectives:', 40, pdf.y);
      pdf.y += 4;

      doc.objectives.forEach((obj, idx) => {
        pdf.fontSize(8.5).font('Helvetica');
        const textH = pdf.heightOfString(obj, { width: contentWidth - 28 });
        checkPageBreak(textH + 4);

        const curY = pdf.y;
        pdf
          .fillColor(AccentColor)
          .font('Helvetica-Bold')
          .text(`${idx + 1}.`, 48, curY, { width: 16 });

        pdf
          .fillColor(DarkText)
          .font('Helvetica')
          .text(obj, 66, curY, { width: contentWidth - 28, lineGap: 1.5 });

        pdf.y = curY + textH + 3;
      });
      pdf.y += 4;
    }

    if (doc.deliverables && doc.deliverables.length > 0) {
      checkPageBreak(25);
      pdf.fillColor(DarkText).fontSize(9).font('Helvetica-Bold').text('Key Deliverables:', 40, pdf.y);
      pdf.y += 4;

      doc.deliverables.forEach((del) => {
        pdf.fontSize(8.5).font('Helvetica');
        const textH = pdf.heightOfString(del, { width: contentWidth - 28 });
        checkPageBreak(textH + 4);

        const curY = pdf.y;
        pdf
          .fillColor(AccentColor)
          .font('Helvetica-Bold')
          .text('•', 48, curY, { width: 12 });

        pdf
          .fillColor(DarkText)
          .font('Helvetica')
          .text(del, 62, curY, { width: contentWidth - 28, lineGap: 1.5 });

        pdf.y = curY + textH + 3;
      });
      pdf.y += 6;
    }

    // ── 3. WORK BREAKDOWN STRUCTURE ─────────────────────────────────────────
    addSectionTitle('3', 'Work Breakdown Structure (WBS)');

    if (doc.workBreakdown && doc.workBreakdown.length > 0) {
      checkPageBreak(45);

      // Table Header
      const tableY = pdf.y;
      pdf.rect(40, tableY, contentWidth, 18).fill(PrimaryColor);

      pdf.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
      pdf.text('ID', 48, tableY + 5, { width: 45 });
      pdf.text('PACKAGE NAME', 95, tableY + 5, { width: 145 });
      pdf.text('WEIGHT', 242, tableY + 5, { width: 45, align: 'right' });
      pdf.text('DESCRIPTION & RESPONSIBILITIES', 298, tableY + 5, { width: 250 });

      pdf.y = tableY + 18;

      doc.workBreakdown.forEach((wb, i) => {
        pdf.fontSize(8).font('Helvetica');
        const descH = pdf.heightOfString(wb.description || '-', { width: 250 });
        const nameH = pdf.heightOfString(wb.name, { width: 145 });
        const rowHeight = Math.max(18, Math.max(descH, nameH) + 8);

        checkPageBreak(rowHeight);

        const curY = pdf.y;
        const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        pdf.rect(40, curY, contentWidth, rowHeight).fill(rowBg);
        pdf.rect(40, curY, contentWidth, rowHeight).strokeColor(BorderColor).lineWidth(0.5).stroke();

        pdf.fillColor(AccentColor).font('Helvetica-Bold').text(wb.id, 48, curY + 4, { width: 45 });
        pdf.fillColor(DarkText).font('Helvetica-Bold').text(wb.name, 95, curY + 4, { width: 145 });
        pdf.fillColor(DarkText).font('Helvetica').text(`${wb.percentage}%`, 242, curY + 4, { width: 45, align: 'right' });
        pdf.fillColor(MutedText).font('Helvetica').text(wb.description || '-', 298, curY + 4, { width: 250, lineGap: 1 });

        pdf.y = curY + rowHeight;
      });

      pdf.y += 8;
    }

    // ── 4. MILESTONES & TIMELINE ─────────────────────────────────────────────
    addSectionTitle('4', 'Execution Milestones & Schedule');

    if (doc.milestones && doc.milestones.length > 0) {
      checkPageBreak(45);

      const msHeaderY = pdf.y;
      pdf.rect(40, msHeaderY, contentWidth, 18).fill(PrimaryColor);

      pdf.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
      pdf.text('TARGET WEEK', 48, msHeaderY + 5, { width: 80 });
      pdf.text('MILESTONE TITLE', 132, msHeaderY + 5, { width: 160 });
      pdf.text('EXPECTED OUTPUT & VERIFICATION', 298, msHeaderY + 5, { width: 250 });

      pdf.y = msHeaderY + 18;

      doc.milestones.forEach((m, i) => {
        pdf.fontSize(8).font('Helvetica');
        const outputH = pdf.heightOfString(m.expectedOutput || '-', { width: 250 });
        const nameH = pdf.heightOfString(m.name, { width: 160 });
        const rowHeight = Math.max(18, Math.max(outputH, nameH) + 8);

        checkPageBreak(rowHeight);

        const curY = pdf.y;
        const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        pdf.rect(40, curY, contentWidth, rowHeight).fill(rowBg);
        pdf.rect(40, curY, contentWidth, rowHeight).strokeColor(BorderColor).lineWidth(0.5).stroke();

        pdf.fillColor(AccentColor).font('Helvetica-Bold').text(`Week ${m.completionWeek}`, 48, curY + 4, { width: 80 });
        pdf.fillColor(DarkText).font('Helvetica-Bold').text(m.name, 132, curY + 4, { width: 160 });
        pdf.fillColor(MutedText).font('Helvetica').text(m.expectedOutput || '-', 298, curY + 4, { width: 250, lineGap: 1 });

        pdf.y = curY + rowHeight;
      });

      pdf.y += 8;
    }

    // ── 5. REQUIRED SKILLS & LEARNING RESOURCES ───────────────────────────────
    addSectionTitle('5', 'Skill Matrix & Learning Resources');

    if (doc.skillsRequired && doc.skillsRequired.length > 0) {
      checkPageBreak(25);
      pdf.fillColor(DarkText).fontSize(9).font('Helvetica-Bold').text('Required Technical Competencies:', 40, pdf.y);
      pdf.y += 3;

      pdf
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(MutedText)
        .text(doc.skillsRequired.join('   •   '), 48, pdf.y, { width: contentWidth - 10 });
      pdf.y += 8;
    }

    if (doc.learningResources && doc.learningResources.length > 0) {
      checkPageBreak(25);
      pdf.fillColor(DarkText).fontSize(9).font('Helvetica-Bold').text('Recommended Learning Resources:', 40, pdf.y);
      pdf.y += 4;

      doc.learningResources.forEach((res) => {
        const resourceText = `${res.resource}${res.url ? ` (${res.url})` : ''}`;
        pdf.fontSize(8).font('Helvetica');
        const textH = pdf.heightOfString(resourceText, { width: contentWidth - 135 });
        checkPageBreak(Math.max(14, textH));

        const curY = pdf.y;
        pdf
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor(AccentColor)
          .text(`• ${res.topic}:`, 48, curY, { width: 120 });

        pdf
          .font('Helvetica')
          .fillColor(DarkText)
          .text(resourceText, 172, curY, { width: contentWidth - 135, lineGap: 1 });

        pdf.y = Math.max(curY + textH + 2, curY + 12);
      });
      pdf.y += 8;
    }

    // ── 6. RISKS & SUCCESS CRITERIA ─────────────────────────────────────────
    addSectionTitle('6', 'Risk Management & Quality Criteria');

    if (doc.risks && doc.risks.length > 0) {
      checkPageBreak(25);
      pdf.fillColor(DarkText).fontSize(9).font('Helvetica-Bold').text('Project Risks & Mitigation Signals:', 40, pdf.y);
      pdf.y += 4;

      doc.risks.forEach((r) => {
        pdf.fontSize(8.5).font('Helvetica');
        const textH = pdf.heightOfString(r, { width: contentWidth - 26 });
        checkPageBreak(textH + 3);

        const curY = pdf.y;
        pdf
          .fillColor('#DC2626')
          .font('Helvetica-Bold')
          .text('⚠', 48, curY, { width: 14 });

        pdf
          .fillColor(DarkText)
          .font('Helvetica')
          .text(r, 64, curY, { width: contentWidth - 26, lineGap: 1.5 });

        pdf.y = curY + textH + 3;
      });
      pdf.y += 6;
    }

    if (doc.successCriteria && doc.successCriteria.length > 0) {
      checkPageBreak(25);
      pdf.fillColor(DarkText).fontSize(9).font('Helvetica-Bold').text('Official Acceptance Criteria:', 40, pdf.y);
      pdf.y += 4;

      doc.successCriteria.forEach((sc) => {
        pdf.fontSize(8.5).font('Helvetica');
        const textH = pdf.heightOfString(sc, { width: contentWidth - 26 });
        checkPageBreak(textH + 3);

        const curY = pdf.y;
        pdf
          .fillColor('#16A34A')
          .font('Helvetica-Bold')
          .text('✓', 48, curY, { width: 14 });

        pdf
          .fillColor(DarkText)
          .font('Helvetica')
          .text(sc, 64, curY, { width: contentWidth - 26, lineGap: 1.5 });

        pdf.y = curY + textH + 3;
      });
    }

    // ── Header & Footer Running Pagination ──────────────────────────────────
    const totalPages = pdf.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      pdf.switchToPage(i);

      // Running Header (Pages > 0)
      if (i > 0) {
        pdf
          .fillColor(MutedText)
          .fontSize(8)
          .font('Helvetica')
          .text('PROJECTVERSE EXECUTION BASELINE', 40, 24, { width: 300 });

        pdf
          .moveTo(40, 34)
          .lineTo(555, 34)
          .strokeColor(BorderColor)
          .lineWidth(0.5)
          .stroke();
      }

      // Running Footer
      pdf
        .moveTo(40, 790)
        .lineTo(555, 790)
        .strokeColor(BorderColor)
        .lineWidth(0.5)
        .stroke();

      pdf
        .fillColor(MutedText)
        .fontSize(8)
        .font('Helvetica')
        .text('ProjectVerse Official Execution Document', 40, 796, { width: 300 });

      pdf
        .fillColor(MutedText)
        .fontSize(8)
        .font('Helvetica')
        .text(`Page ${i + 1} of ${totalPages}`, 400, 796, { width: 155, align: 'right' });
    }

    pdf.end();
  });
}
