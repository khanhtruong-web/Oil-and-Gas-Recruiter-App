import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { Candidate } from '../types';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { fetchLogoImage, buildBureauVeritasTemplate, buildPetrobrasTemplate, buildShellTemplate, buildExxonMobilTemplate, buildBPTemplate, buildChevronTemplate } from './docxServiceCompany';

export const getTemplateVariables = (templateBase64: string): string[] => {
    try {
        const binaryString = atob(templateBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const zip = new PizZip(bytes.buffer);
        const docXml = zip.files['word/document.xml'];
        if (!docXml) return [];
        const xmlText = docXml.asText();
        // Remove all XML tags to get raw text
        const plainText = xmlText.replace(/<[^>]+>/g, '');
        // Match {ANY_TEXT}
        const matches = plainText.match(/\{[^}]+\}/g);
        if (!matches) return [];
        // Extract inner values and dedupe, trimming whitespaces which docxtemplater ignores
        const vars = Array.from(new Set(matches.map(m => m.replace(/[\{\}]/g, '').trim())));
        return vars;
    } catch (error) {
        console.error("Failed to parse template variables:", error);
        return [];
    }
};

export const fillTemplate = async (mappedData: any, templateBase64: string, templateName: string) => {
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
    doc.setData(mappedData);

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

    const safeName = (mappedData.CANDIDATE_NAME || mappedData.candidateName || 'Candidate').replace(/\W+/g, '_');
    saveAs(out, `CV_${safeName}_${templateName.replace(/\s+/g, '_')}.docx`);
  } catch (error) {
    console.error("Error filling template:", error);
    throw error;
  }
};

const buildBrandedTemplate = (candidate: Candidate, companyName: string, headerColor: string, invertLogoText: boolean = false) => {
  const SECTION_GREY = '8c8c8e';
  
  const createSectionHeader = (title: string) => {
    return new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          shading: { fill: SECTION_GREY, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: title, bold: true, color: 'FFFFFF' })],
              alignment: AlignmentType.LEFT
            })
          ],
        })
      ]
    });
  };

  const createDataRow = (label: string, content: string | string[]) => {
    const contents = Array.isArray(content) ? content : (content || '').split('\n').filter(Boolean);
    return new TableRow({
      children: [
        new TableCell({
          shading: { fill: headerColor, type: ShadingType.CLEAR, color: 'auto' },
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, color: invertLogoText ? '000000' : 'FFFFFF' })]
            })
          ],
        }),
        new TableCell({
          margins: { top: 100, bottom: 100, left: 150, right: 150 },
          width: { size: 70, type: WidthType.PERCENTAGE },
          children: contents.length > 0 ? contents.map(text => 
            new Paragraph({
               children: [new TextRun({ text: text })],
               spacing: { after: 60 }
            })
          ) : [new Paragraph({ children: [new TextRun({ text: 'N/A' })] })],
        })
      ]
    });
  };

  const rows: TableRow[] = [];
  
  // 1. GENERAL INFORMATION
  rows.push(createSectionHeader('1. GENERAL INFORMATION:'));
  rows.push(createDataRow('Proposed position', candidate.discipline || 'N/A'));
  rows.push(createDataRow('Home office', `${companyName} Representative`));
  rows.push(createDataRow('Gender', 'Male/Female'));
  rows.push(createDataRow('Nationality', 'Vietnamese'));
  
  // 2. AREAS OF SPECIALITY
  rows.push(createSectionHeader('2. AREAS OF SPECIALITY:'));
  rows.push(createDataRow('Summary', candidate.professionalSummary || 'No summary available.'));
  if (candidate.keySkills) {
      rows.push(createDataRow('Key Skills', candidate.keySkills));
  }
  
  // 3. EDUCATION
  rows.push(createSectionHeader('3. EDUCATION:'));
  rows.push(createDataRow('Education', candidate.education || 'N/A'));
  
  // 4. PROFESSIONAL TRAININGS...
  if (candidate.certifications) {
    rows.push(createSectionHeader('4. PROFESSIONAL TRAININGS AND CERTIFICATES:'));
    rows.push(createDataRow('Certificates', candidate.certifications));
  }

  // Languages...
  rows.push(createSectionHeader('5. LANGUAGES AND DEGREE OF PROFICIENCY:'));
  rows.push(createDataRow('English', 'Good at reading, speaking, listening and writing'));
  
  // Experience
  if (candidate.detailedTasks) {
      rows.push(createSectionHeader('6. PROFESSIONAL EXPERIENCE & PROJECTS:'));
      rows.push(createDataRow('Details', candidate.detailedTasks));
  } else if (candidate.rawText) {
      rows.push(createSectionHeader('6. RAW DATA (Fallback):'));
      rows.push(createDataRow('Raw Data', candidate.rawText.substring(0, 3000) + '...'));
  }

  const table = new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' },
      }
  });

  const children = [
      new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
             new TextRun({ text: companyName.toUpperCase(), bold: true, size: 36, color: headerColor }),
          ],
          spacing: { after: 400 }
      }),
      new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
             new TextRun({ text: candidate.candidateName?.toUpperCase() || 'CANDIDATE', bold: true, size: 36, color: '555555' }),
          ]
      }),
      new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
             new TextRun({ text: 'CURRICULUM VITAE', bold: true, size: 36, color: headerColor }),
          ],
          spacing: { after: 400 }
      }),
      table,
      new Paragraph({ spacing: { before: 800, after: 800 } }),
      new Paragraph({
         children: [
            new TextRun({ text: 'The undersigned certifies the above information is true and correct and will be responsible for any false statement discovered.' })
         ]
      }),
      new Paragraph({ spacing: { before: 800, after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: '------------------------', bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: candidate.candidateName || 'Candidate name', bold: true })] }),
  ];

  return new Document({ sections: [{ properties: {}, children }] });
};

export const exportToWord = async (candidate: Candidate, templateName: string = 'Standard Company Format') => {
  let doc: Document;
  let isStandard = false;

  const bSafeName = (candidate.candidateName || 'Unknown').replace(/\W+/g, '_');

  switch (templateName) {
    case 'Bureau Veritas': {
      const logo = await fetchLogoImage('bureauveritas.com');
      doc = await buildBureauVeritasTemplate(candidate, logo);
      break;
    }
    case 'Petrobras': {
      const logo = await fetchLogoImage('petrobras.com.br');
      doc = await buildPetrobrasTemplate(candidate, logo);
      break;
    }
    case 'Shell': {
      const logo = await fetchLogoImage('shell.com');
      doc = await buildShellTemplate(candidate, logo);
      break;
    }
    case 'ExxonMobil': {
      const logo = await fetchLogoImage('exxonmobil.com');
      doc = await buildExxonMobilTemplate(candidate, logo);
      break;
    }
    case 'BP': {
      const logo = await fetchLogoImage('bp.com');
      doc = await buildBPTemplate(candidate, logo);
      break;
    }
    case 'Chevron': {
      const logo = await fetchLogoImage('chevron.com');
      doc = await buildChevronTemplate(candidate, logo);
      break;
    }
    default:
      isStandard = true;
      doc = new Document({ sections: [] }); // Placeholder, we will build it below
      break;
  }

  if (!isStandard) {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `CV_${bSafeName}_${templateName.replace(/\W+/g, '')}.docx`);
      return;
  }

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

  // Key Skills
  if (candidate.keySkills) {
    children.push(new Paragraph({ spacing: { after: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '3. KEY SKILLS', bold: true, size: 24, color: '334155' })],
        spacing: { after: 100 },
        border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } }
      })
    );
    const skillsParagraphs = candidate.keySkills.split('\n').filter(l => l.trim()).map(line => 
      new Paragraph({ children: [new TextRun({ text: line.trim() })], spacing: { after: 100 } })
    );
    children.push(...skillsParagraphs);
  }

  // Education & Certifications
  if (candidate.education || candidate.certifications) {
    children.push(new Paragraph({ spacing: { after: 300 } }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '4. EDUCATION & CERTIFICATIONS', bold: true, size: 24, color: '334155' })],
        spacing: { after: 100 },
        border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } }
      })
    );

    if (candidate.education) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Education:', bold: true })], spacing: { after: 50, before: 100 } }));
      const eduParagraphs = candidate.education.split('\n').filter(l => l.trim()).map(line => 
        new Paragraph({ children: [new TextRun({ text: line.trim() })], spacing: { after: 100 } })
      );
      children.push(...eduParagraphs);
    }

    if (candidate.certifications) {
      children.push(new Paragraph({ children: [new TextRun({ text: 'Certifications:', bold: true })], spacing: { after: 50, before: 100 } }));
      const certParagraphs = candidate.certifications.split('\n').filter(l => l.trim()).map(line => 
        new Paragraph({ children: [new TextRun({ text: line.trim() })], spacing: { after: 100 } })
      );
      children.push(...certParagraphs);
    }
  }

  // Key Competencies
  children.push(new Paragraph({ spacing: { after: 300 } }));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '5. AI EVALUATION & NOTES', bold: true, size: 24, color: '334155' })],
      spacing: { after: 100 },
      border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } }
    })
  );

  children.push(new Paragraph({ children: [new TextRun({ text: `AI Score: ${candidate.aiScore || 'N/A'}/100`, bold: true })], spacing: { after: 100 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `System Notes: ${candidate.aiSummary || 'None'}` })], spacing: { after: 100 } }));

  // Projects and Employment
  if (candidate.detailedTasks) {
    children.push(new Paragraph({ spacing: { after: 300 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: '6. PROFESSIONAL EXPERIENCE & PROJECTS', bold: true, size: 24, color: '334155' })], spacing: { after: 100 }, border: { bottom: { color: 'cbd5e1', space: 2, style: BorderStyle.SINGLE, size: 2 } } }));
    children.push(...candidate.detailedTasks.split('\n').filter(l => l.trim()).map(line => new Paragraph({ children: [new TextRun({ text: line.replace(/^- /, '') })], spacing: { after: 100 } })));
  }

  // Signature Block
  children.push(new Paragraph({ spacing: { before: 800, after: 800 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: 'The undersigned certifies the above information is true and correct and will be responsible for any false statement discovered.' })] }));
  children.push(new Paragraph({ spacing: { before: 800, after: 100 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: '------------------------', bold: true })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: candidate.candidateName || 'Candidate name', bold: true })] }));

  // Create doc
  const standardDoc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const blob = await Packer.toBlob(standardDoc);
  const safeName = (candidate.candidateName || 'Unknown').replace(/\W+/g, '_');
  saveAs(blob, `CV_${safeName}_Formatted.docx`);
};
