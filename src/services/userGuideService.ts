import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import userGuideMarkdown from '../../USER_GUIDE_VI.md?raw';

function parseTextRuns(text: string, isQuote: boolean = false) {
    const segments = text.split(/(\*\*.*?\*\*)/g);
    return segments.map(seg => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
            return new TextRun({ text: seg.substring(2, seg.length - 2), bold: true, italics: isQuote, size: 24, font: 'Arial' });
        }
        return new TextRun({ text: seg, size: 24, italics: isQuote, bold: true, font: 'Arial' });
    });
}

export async function generateUserGuide() {
    const lines = userGuideMarkdown.split('\n');
    const children: Paragraph[] = [];

    for (let line of lines) {
        if (line.trim() === '---') continue;
        
        let text = line;
        let heading: any = undefined;
        let isQuote = false;
        let bullet: any = undefined;

        if (line.startsWith('# ')) {
            heading = HeadingLevel.TITLE;
            text = line.substring(2);
        } else if (line.startsWith('## ')) {
            heading = HeadingLevel.HEADING_1;
            text = line.substring(3);
        } else if (line.startsWith('### ')) {
            heading = HeadingLevel.HEADING_2;
            text = line.substring(4);
        } else if (line.startsWith('#### ')) {
            heading = HeadingLevel.HEADING_3;
            text = line.substring(5);
        } else if (line.startsWith('- ')) {
            text = line.substring(2);
            bullet = { level: 0 };
        } else if (line.startsWith('* ')) {
            text = line.substring(2);
            bullet = { level: 0 };
        } else if (line.startsWith('> ')) {
            text = line.substring(2);
            isQuote = true;
        } else if (line.match(/^\s*- /)) {
            text = line.replace(/^\s*- /, '');
            bullet = { level: 1 };
        }

        children.push(new Paragraph({
            heading: heading,
            spacing: { before: heading ? 240 : 120, after: 120 },
            bullet: bullet,
            children: parseTextRuns(text, isQuote)
        }));
    }

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: "Arial",
                        size: 24,
                        bold: true,
                    },
                },
            },
        },
        sections: [{
            properties: {},
            children: children
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "Huong_Dan_Su_Dung_Quan_Ly_CV.docx");
}

