/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-empty */
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, ShadingType, AlignmentType, WidthType, ImageRun } from 'docx';
import { Candidate } from '../types';

export const fetchLogoImage = async (domain: string): Promise<ArrayBuffer | null> => {
   try {
      const res = await fetch(`https://api.allorigins.win/raw?url=https://logo.clearbit.com/${domain}`);
      if (res.ok) {
         return await res.arrayBuffer();
      }
   } catch(e) {
      console.warn("Could not fetch logo for", domain, e);
   }
   return null;
}

const safeText = (text: any) => text ? String(text) : 'N/A';

const createParagraphs = (text: string) => {
    return safeText(text).split('\n').filter(Boolean).map(line =>
        new Paragraph({ children: [new TextRun({ text: line })], spacing: { after: 120 } })
    );
};

export const buildBureauVeritasTemplate = async (candidate: Candidate, logoBuf: ArrayBuffer | null) => {
    const red = 'b20023';
    const gray = '808080';
    const blue = '0000FF';

    const renderText = (text: string, options?: any) => {
        return new TextRun({ text: text, font: 'Arial', size: 26, ...options });
    };

    const renderPar = (text: string, options?: any) => {
        return new Paragraph({ children: [renderText(text, options)], spacing: { before: 60, after: 60 } });
    };

    const renderCell = (content: Paragraph | Paragraph[], isLeft: boolean = false, bgColor?: string) => {
        return new TableCell({
            children: Array.isArray(content) ? content : [content],
            shading: bgColor ? { fill: bgColor, type: ShadingType.CLEAR, color: 'auto' } : undefined,
            margins: { top: 100, bottom: 100, left: 150, right: 150 }
        });
    };

    const rows: TableRow[] = [];

    const headerLeftChildren = [];
    if (logoBuf) {
        try {
            headerLeftChildren.push(new Paragraph({
               alignment: AlignmentType.CENTER,
               children: [new ImageRun({ type: 'png', data: logoBuf, transformation: { width: 120, height: 120 } })]
            }));
        } catch(e) {}
    } else {
        headerLeftChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [renderText('BUREAU VERITAS', { color: 'FFFFFF', bold: true })] }));
    }

    rows.push(new TableRow({
        children: [
            new TableCell({
                shading: { fill: red, type: ShadingType.CLEAR, color: 'auto' },
                children: headerLeftChildren,
                margins: { top: 150, bottom: 150, left: 150, right: 150 },
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 100 },
                        children: [new TextRun({ text: (candidate.candidateName || 'UNKNOWN').toUpperCase(), font: 'Arial', size: 56, color: '707070', bold: true })]
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 200 },
                        children: [new TextRun({ text: 'CURRICULUM VITAE', font: 'Arial', size: 52, color: red, bold: true })]
                    })
                ]
            })
        ]
    }));

    const addSection = (idx: string, title: string) => {
        rows.push(new TableRow({
            children: [
                new TableCell({
                    columnSpan: 2,
                    shading: { fill: gray, type: ShadingType.CLEAR, color: 'auto' },
                    margins: { top: 100, bottom: 100, left: 150, right: 150 },
                    children: [
                        new Paragraph({ children: [new TextRun({ text: `${idx}.   ${title}`, font: 'Arial', size: 26, color: 'FFFFFF', bold: true })] })
                    ]
                })
            ]
        }));
    };

    const addDetailRow = (lbl: string, val: string | Paragraph[], isValBold: boolean = false, isValBlue: boolean = false) => {
        let rightP: Paragraph[];
        if (Array.isArray(val)) {
            rightP = val;
        } else {
            rightP = [renderPar(val, { bold: isValBold, color: isValBlue ? blue : '000000' })];
        }

        rows.push(new TableRow({
            children: [
                renderCell(renderPar(lbl, { color: 'FFFFFF' }), true, red),
                renderCell(rightP, false)
            ]
        }));
    };

    const parseContentToBulletParagraphs = (text: string) => {
        return safeText(text).split('\n').map(line => {
            let t = line.trim();
            if (!t) return null;
            
            if (/^([•\-\*✓>])\s/.test(t)) {
                t = '❖ ' + t.substring(2).trim();
            } else if (/^❖/.test(t)) {
                t = '❖ ' + t.substring(1).trim();
            } else if (/^[a-zA-Z0-9]/.test(t) && !/^❖/.test(t) && t.length > 50 && t.includes(' - ')) {
                 // heuristic for long lines, don't force bullet
            }
            // We shouldn't force ❖ on all sentences.
            
            return new Paragraph({
               children: [new TextRun({ text: t, font: 'Arial', size: 26 })],
               spacing: { before: 60, after: 60 }
            });
        }).filter(Boolean) as Paragraph[];
    };

    addSection('1', 'GENERAL INFORMATION:');
    addDetailRow('Proposed position', safeText(candidate.discipline), true, true);
    addDetailRow('Home office', 'Bureau Veritas Vietnam, Vung Tau Office, Vung Tau, Vietnam');
    addDetailRow('Gender', 'Male');
    addDetailRow('Nationality', 'Vietnamese');

    addSection('2', 'AREAS OF SPECIALITY:');
    const summaryLines = safeText(candidate.professionalSummary).split('\n').map(l => l.trim()).filter(Boolean).map(l => renderPar(l));
    addDetailRow('Summary', summaryLines);
    if (candidate.keySkills) {
        let skillsLines = parseContentToBulletParagraphs(candidate.keySkills);
        addDetailRow('Key Skills', skillsLines);
    }

    addSection('3', 'EDUCATION:');
    addDetailRow('Education', safeText(candidate.education));

    if (candidate.certifications) {
        addSection('4', 'PROFESSIONAL TRAININGS AND CERTIFICATES:');
        let certsList = parseContentToBulletParagraphs(candidate.certifications);
        addDetailRow('Certificates', certsList);
    }

    addSection('5', 'LANGUAGES AND DEGREE OF PROFICIENCY:');
    addDetailRow('English', 'Good at reading, speaking, listening and writing');

    if (candidate.detailedTasks) {
        addSection('6', 'PROFESSIONAL EXPERIENCE & PROJECTS:');
        let expDetails = parseContentToBulletParagraphs(candidate.detailedTasks);
        if (expDetails.length === 0) expDetails = [renderPar('N/A')];
        addDetailRow('Experience', expDetails);
    }

    const table = new Table({
        rows: rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3200, 6800],
        borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        }
    });

    return new Document({ sections: [{ properties: {}, children: [table] }] });
};

export const buildPetrobrasTemplate = async (candidate: Candidate, logoBuf: ArrayBuffer | null) => {
    const color = '00AEEF';
    const children: any[] = [];
    
    // Header
    const hdrChildren: any[] = [];
    if (logoBuf) {
        try {
            hdrChildren.push(new ImageRun({
                type: 'png',
                data: logoBuf,
                transformation: { width: 150, height: 150 },
            }));
        } catch(e) {}
    }
    hdrChildren.push(new TextRun({ text: '\nPETROBRAS ONSHORE/OFFSHORE CV\n', bold: true, size: 36, color }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: hdrChildren, spacing: { after: 400 } }));

    // Petrobras style: Borderless table for info
    const infoRows = [
        ['Position:', safeText(candidate.discipline)],
        ['Name:', safeText(candidate.candidateName)],
        ['Years Experience:', safeText(candidate.yearsExp) + ' years'],
        ['Nationality:', 'Vietnamese'],
    ].map(([lbl, val]) => new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lbl, bold: true, color: '005f8a' })] })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: val })] })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } })
        ]
    }));
    children.push(new Table({ rows: infoRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ spacing: { after: 300 } }));

    // Sections Petrobras
    const sections = [
        { t: '1. PROFESSIONAL SUMMARY', c: candidate.professionalSummary },
        { t: '2. EDUCATION & CERTIFICATES', c: (candidate.education || '') + '\n' + (candidate.certifications || '') },
        { t: '3. KEY SKILLS', c: candidate.keySkills },
        { t: '4. PROFESSIONAL EXPERIENCE', c: candidate.detailedTasks }
    ];

    for (const sec of sections) {
        children.push(new Paragraph({
            children: [new TextRun({ text: sec.t, bold: true, size: 24, color: 'FFFFFF' })],
            shading: { fill: color, type: ShadingType.CLEAR, color: 'auto' },
            spacing: { before: 200, after: 100 }
        }));
        children.push(...createParagraphs(sec.c));
    }

    return new Document({ sections: [{ properties: {}, children }] });
};

export const buildShellTemplate = async (candidate: Candidate, logoBuf: ArrayBuffer | null) => {
    const color = 'FFD700'; // Shell yellow
    const textCol = 'DD1D21'; // Shell red
    const children: any[] = [];
    
    // Header
    const hdrChildren: any[] = [];
    if (logoBuf) {
        try {
            hdrChildren.push(new ImageRun({
                type: 'png',
                data: logoBuf,
                transformation: { width: 100, height: 100 },
            }));
        } catch(e) {}
    }
    hdrChildren.push(new TextRun({ text: '\nSHELL GLOBAL CONTRACTOR PROFILE\n', bold: true, size: 36, color: textCol }));
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: hdrChildren, spacing: { after: 400 } }));

    // Info Side-by-side using table
    const table = new Table({
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({ children: [new TextRun({ text: 'PERSONAL DETAILS', bold: true, color: textCol })], spacing: { after: 120 } }),
                            new Paragraph({ children: [new TextRun({ text: `Name: ${safeText(candidate.candidateName)}` })], spacing: { after: 120 } }),
                            new Paragraph({ children: [new TextRun({ text: `Discipline: ${safeText(candidate.discipline)}` })], spacing: { after: 120 } }),
                            new Paragraph({ children: [new TextRun({ text: `Experience: ${safeText(candidate.yearsExp)} Years` })] })
                        ],
                        shading: { fill: 'FFF9E6', type: ShadingType.CLEAR, color: 'auto' },
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: { top: 150, bottom: 150, left: 150, right: 150 }
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({ children: [new TextRun({ text: 'CONTACT INFO', bold: true, color: textCol })], spacing: { after: 120 } }),
                            new Paragraph({ text: `Phone: ${safeText(candidate.phone)}`, spacing: { after: 120 } }),
                            new Paragraph({ text: `Email: ${safeText(candidate.email)}`, spacing: { after: 120 } }),
                            new Paragraph({ text: `Specialization: ${safeText(candidate.specializedField)}`, spacing: { after: 120 } })
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: { top: 150, bottom: 150, left: 150, right: 150 }
                    })
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
    children.push(table);
    children.push(new Paragraph({ spacing: { after: 300 } }));

    // Sections
    const secStyle = (title: string) => new Paragraph({
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 26, color: textCol })],
        border: { bottom: { color: color, space: 1, style: BorderStyle.THICK, size: 18 } },
        spacing: { before: 200, after: 100 }
    });

    children.push(secStyle('Executive Summary'));
    children.push(...createParagraphs(candidate.professionalSummary));

    children.push(secStyle('Core Competencies'));
    children.push(...createParagraphs(candidate.keySkills));

    children.push(secStyle('Work History & Projects'));
    children.push(...createParagraphs(candidate.detailedTasks));

    return new Document({ sections: [{ properties: {}, children }] });
};

export const buildExxonMobilTemplate = async (candidate: Candidate, logoBuf: ArrayBuffer | null) => {
    const color = 'E2132D'; // Exxon red
    const children: any[] = [];
    
    // Header
    const hdrChildren: any[] = [];
    if (logoBuf) {
        try {
            hdrChildren.push(new ImageRun({
                type: 'png',
                data: logoBuf,
                transformation: { width: 140, height: 50 },
            }));
        } catch(e) {}
    }
    children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: hdrChildren, spacing: { after: 200 } }));
    children.push(new Paragraph({
        children: [new TextRun({ text: 'EXXONMOBIL EXPERTISE DOSSIER', bold: true, size: 32, color })],
        border: { bottom: { color: color, space: 1, style: BorderStyle.SINGLE, size: 12 } },
        spacing: { after: 300 }
    }));

    children.push(new Paragraph({ children: [new TextRun({ text: `Candidate: `, bold: true }), new TextRun({ text: safeText(candidate.candidateName) })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Role: `, bold: true }), new TextRun({ text: safeText(candidate.discipline) })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Exp: `, bold: true }), new TextRun({ text: `${safeText(candidate.yearsExp)} years` })] }));
    
    children.push(new Paragraph({ spacing: { after: 300 } }));

    const drawLine = () => new Paragraph({ border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } } });

    children.push(new Paragraph({ children: [new TextRun({ text: '1. SUMMARY', bold: true, color })], spacing: { before: 200 } }));
    children.push(...createParagraphs(candidate.professionalSummary));
    children.push(drawLine());

    children.push(new Paragraph({ children: [new TextRun({ text: '2. SKILLS', bold: true, color })], spacing: { before: 200 } }));
    children.push(...createParagraphs(candidate.keySkills));
    children.push(drawLine());

    children.push(new Paragraph({ children: [new TextRun({ text: '3. EXPERIENCE', bold: true, color })], spacing: { before: 200 } }));
    children.push(...createParagraphs(candidate.detailedTasks));

    return new Document({ sections: [{ properties: {}, children }] });
};

export const buildBPTemplate = async (candidate: Candidate, logoBuf: ArrayBuffer | null) => {
    const color = '00A651'; // BP green
    const children: any[] = [];
    
    const hdrChildren: any[] = [];
    if (logoBuf) {
        try {
            hdrChildren.push(new ImageRun({
                type: 'png',
                data: logoBuf,
                transformation: { width: 80, height: 80 },
            }));
        } catch(e) {}
    }
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: hdrChildren, spacing: { after: 100 } }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BEYOND PETROLEUM - CONSULTANT CV', bold: true, size: 28, color })], spacing: { after: 300 } }));

    // Green left border for sections
    const secPar = (title: string, content: any) => {
        const p = [];
        p.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 24, color })], spacing: { before: 200, after: 100 } }));
        
        const contentTable = new Table({
            rows: [new TableRow({
                children: [
                    new TableCell({ children: [], width: { size: 2, type: WidthType.PERCENTAGE }, shading: { fill: color, type: ShadingType.CLEAR, color: 'auto' }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
                    new TableCell({ children: createParagraphs(content), margins: { left: 150 }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } })
                ]
            })],
            width: { size: 100, type: WidthType.PERCENTAGE }
        });
        p.push(contentTable);
        return p;
    };

    children.push(...secPar('Personal Info', `Name: ${safeText(candidate.candidateName)}\nDiscipline: ${safeText(candidate.discipline)}\nExperience: ${safeText(candidate.yearsExp)} years`));
    children.push(...secPar('Summary', candidate.professionalSummary));
    children.push(...secPar('Experience', candidate.detailedTasks));

    return new Document({ sections: [{ properties: {}, children }] });
};

export const buildChevronTemplate = async (candidate: Candidate, logoBuf: ArrayBuffer | null) => {
    const color = '0054A4'; // Chevron blue
    const red = 'ED1C24';
    const children: any[] = [];
    
    const hdrChildren: any[] = [];
    if (logoBuf) {
        try {
            hdrChildren.push(new ImageRun({
                type: 'png',
                data: logoBuf,
                transformation: { width: 80, height: 90 },
            }));
        } catch(e) {}
    }
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: hdrChildren, spacing: { after: 100 } }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CHEVRON CONTRACTOR FORM', bold: true, size: 32, color })], spacing: { after: 300 } }));

    const secLine = (title: string) => new Paragraph({
        children: [new TextRun({ text: title, bold: true, color: 'FFFFFF' })],
        shading: { fill: color, type: ShadingType.CLEAR, color: 'auto' },
        spacing: { before: 200, after: 100 }
    });

    children.push(secLine(' 1. PROFILE                 '));
    children.push(new Paragraph({ text: `Subject Matter: ${safeText(candidate.discipline)}`, spacing: { after: 120 } }));
    children.push(new Paragraph({ text: `Contractor: ${safeText(candidate.candidateName)}`, spacing: { after: 120 } }));
    children.push(...createParagraphs(candidate.professionalSummary));

    children.push(secLine(' 2. QUALIFICATIONS          '));
    children.push(...createParagraphs(candidate.keySkills));

    children.push(secLine(' 3. PROJECT HISTORY         '));
    children.push(...createParagraphs(candidate.detailedTasks));

    return new Document({ sections: [{ properties: {}, children }] });
};
