/**
 * Standardizes folder names for Google Drive disciplines.
 * This ensures consistency between App Logic (moving files),
 * Folder Syncing (creating folders), and Preview Logic.
 */
export const getSafeDisciplineFolderName = (discipline: string): string => {
    // Current App.tsx uses: replace(/[^a-zA-Z0-9_ -]/g, '')
    // but adds "CVs_" prefix.
    const safeName = (discipline || 'Uncategorized').replace(/[^a-zA-Z0-9_ -]/g, '');
    return `CVs_${safeName}`;
};

/**
 * Standardizes filename for approved candidates.
 */
export const getApprovedFileName = (candidateName: string, discipline: string, extension: string): string => {
    const approveDate = new Date().toISOString().split('T')[0];
    const safeName = (candidateName || 'Unknown').replace(/[^a-zA-Z0-9_ -]/g, '');
    const safeDiscipline = (discipline || 'Uncategorized').replace(/[^a-zA-Z0-9_ -]/g, '');
    return `${safeName}_${safeDiscipline}_${approveDate} APPROVED${extension}`;
};
