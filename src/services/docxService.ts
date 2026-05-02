import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Candidate } from '../types';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export const fillTemplate = async (candidate: Candidate, templateBase64: string, templateName: string) => {
  try {
    const binaryString = atob(templateBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const zip = new PizZip(bytes.buffer);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    // Map candidate data to template variables
    doc.setData({
        CANDIDATE_NAME: candidate.candidateName || '',
        EMAIL: candidate.email || '',
        PHONE: candidate.phone || '',
        YEARS_EXP: candidate.yearsExp || 0,
        EDUCATION: candidate.education || '',
        DISCIPLINE: candidate.discipline || '',
        SPECIALIZED_FIELD: candidate.specializedField || '',
        WORK_FIELDS: candidate.workFields || '',
        AI_SUMMARY: candidate.aiSummary || '',
        AI_SCORE: candidate.aiScore || 0,
        PROFESSIONAL_SUMMARY: candidate.professionalSummary || '',
    });

    try {
        doc.render();
    } catch (error) {
        console.error("Docxtemplater render error:", error);
        throw error;
    }

    const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const safeName = (candidate.candidateName || 'Unknown').replace(/\W+/g, '_');
    saveAs(out, `CV_${safeName}_${templateName.replace(/\s+/g, '_')}.docx`);
  } catch (error) {
    console.error("Error filling template:", error);
    throw error;
  }
};

export const exportToWord = async (candidate: Candidate, templateName: string = 'Standard Company Format') => {
  const children: any[] = [];

  // Header Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `${templateName.toUpperCase()}`, bold: true, size: 36, color: '1e293b' })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    })
  );

  children.push(new Paragraph({ spacing: { after: 200 } }));

  // Candidate Information
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '1. CANDIDATE INFORMATION', bold: true, size: 24, color: '334155' })],
      spacing: { after: 100 },
      border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } }
    })
  );

  const infoRows = [
    ['Full Name', candidate.candidateName || 'N/A'],
    ['Phone', candidate.phone || 'N/A'],
    ['Email', candidate.email || 'N/A'],
    ['Years of Experience', `${candidate.yearsExp} years`],
    ['Discipline', candidate.discipline || 'N/A'],
    ['Specialization', candidate.specializedField || 'N/A'],
    ['Work Fields / Industries', candidate.workFields || 'N/A'],
  ];

  const table = new Table({
    rows: infoRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
          width: { size: 40, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value })] })],
          width: { size: 60, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        })
      ]
    })),
    width: { size: 100, type: WidthType.PERCENTAGE }
  });

  children.push(table);
  children.push(new Paragraph({ spacing: { after: 300 } }));

  // Professional Summary
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '2. PROFESSIONAL SUMMARY', bold: true, size: 24, color: '334155' })],
      spacing: { after: 100 },
      border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } }
    })
  );

  const summaryText = candidate.professionalSummary || (candidate.rawText ? candidate.rawText.substring(0, 2000) : 'No summary available.');
  const summaryParagraphs = summaryText.split('\n').filter(l => l.trim()).map(line => 
    new Paragraph({ children: [new TextRun({ text: line.trim() })], spacing: { after: 100 } })
  );
  children.push(...summaryParagraphs);

  // Key Competencies
  children.push(new Paragraph({ spacing: { after: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '3. KEY COMPETENCIES & AI EVALUATION', bold: true, size: 24, color: '334155' })],
      spacing: { after: 100 },
      border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } }
    })
  );

  children.push(new Paragraph({ children: [new TextRun({ text: `AI Score: ${candidate.aiScore || 'N/A'}/100`, bold: true })], spacing: { after: 100 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `System Notes: ${candidate.aiSummary || 'None'}` })], spacing: { after: 100 } }));

  // Create doc
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (candidate.candidateName || 'Unknown').replace(/\W+/g, '_');
  saveAs(blob, `CV_${safeName}_Formatted.docx`);
};
