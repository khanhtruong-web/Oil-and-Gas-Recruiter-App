import * as XLSX from 'xlsx';
import { Candidate, ActivityLog } from '../types';

export const exportToExcelWithPivots = (candidates: Candidate[], filenamePrefix: string = 'CV_Report') => {
    // 1. Raw Data Sheet
    const rawData = candidates.map((c, i) => ({
        'No': i + 1,
        'Candidate Name': c.candidateName,
        'Experience (Yrs)': c.yearsExp,
        'Discipline': c.discipline,
        'Specialized Field': c.specializedField || 'N/A',
        'Work Fields': c.workFields || 'N/A',
        'Status': c.currentStatus || 'New',
        'AI Score': c.aiScore || 0,
        'Added Date': c.addedAt ? new Date(c.addedAt).toLocaleDateString() : 'N/A'
    }));

    const wsRaw = XLSX.utils.json_to_sheet(rawData);
    wsRaw['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];

    // 2. Summary by Discipline (Pivot: Discipline vs Status)
    const disciplines = Array.from(new Set(candidates.map(c => c.discipline || 'Uncategorized')));
    const statuses = Array.from(new Set(candidates.map(c => c.currentStatus || 'New')));
    
    const pivotDiscipline = disciplines.map(disc => {
        const row: any = { 'Discipline': disc };
        let total = 0;
        statuses.forEach(status => {
            const count = candidates.filter(c => (c.discipline || 'Uncategorized') === disc && (c.currentStatus || 'New') === status).length;
            row[status] = count;
            total += count;
        });
        row['Grand Total'] = total;
        return row;
    });

    const wsPivotDisc = XLSX.utils.json_to_sheet(pivotDiscipline);
    wsPivotDisc['!cols'] = [{ wch: 30 }, ...statuses.map(() => ({ wch: 15 })), { wch: 15 }];

    // 3. Summary by Status (Count & Avg AI Score)
    const pivotStatus = statuses.map(status => {
        const cands = candidates.filter(c => (c.currentStatus || 'New') === status);
        const avgScore = cands.reduce((sum, c) => sum + (c.aiScore || 0), 0) / (cands.length || 1);
        return {
            'Status': status,
            'Candidate Count': cands.length,
            'Average AI Score': avgScore.toFixed(1)
        };
    });
    const wsPivotStatus = XLSX.utils.json_to_sheet(pivotStatus);
    wsPivotStatus['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }];

    // 4. Summary by Experience Range
    const ranges = ['0-2 Yrs', '3-5 Yrs', '6-10 Yrs', '11-15 Yrs', '16+ Yrs'];
    const getExpRange = (yrs: number) => {
        if (yrs <= 2) return '0-2 Yrs';
        if (yrs <= 5) return '3-5 Yrs';
        if (yrs <= 10) return '6-10 Yrs';
        if (yrs <= 15) return '11-15 Yrs';
        return '16+ Yrs';
    };

    const pivotExp = disciplines.map(disc => {
        const row: any = { 'Discipline': disc };
        let total = 0;
        ranges.forEach(range => {
            const count = candidates.filter(c => (c.discipline || 'Uncategorized') === disc && getExpRange(c.yearsExp || 0) === range).length;
            row[range] = count;
            total += count;
        });
        row['Total'] = total;
        return row;
    });
    const wsPivotExp = XLSX.utils.json_to_sheet(pivotExp);
    wsPivotExp['!cols'] = [{ wch: 30 }, ...ranges.map(() => ({ wch: 15 })), { wch: 10 }];

    // Build workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsRaw, "Raw Data");
    XLSX.utils.book_append_sheet(wb, wsPivotDisc, "Pivot - Status by Discipline");
    XLSX.utils.book_append_sheet(wb, wsPivotStatus, "Pivot - Overall Status");
    XLSX.utils.book_append_sheet(wb, wsPivotExp, "Pivot - Experience Matrix");

    XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const exportActivityLogsToExcel = (logs: ActivityLog[], filenamePrefix: string = 'Activity_Log') => {
    const rawData = logs.map((l, i) => ({
        'No': i + 1,
        'Type': l.type,
        'Action': l.text,
        'User': l.userName,
        'Timestamp': l.timestamp ? new Date(l.timestamp).toLocaleString() : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(rawData);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 60 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activity Logs");
    XLSX.writeFile(wb, `${filenamePrefix}_${new Date().toISOString().slice(0,10)}.xlsx`);
};
