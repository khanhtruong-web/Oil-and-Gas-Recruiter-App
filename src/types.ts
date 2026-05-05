export type CandidateStatus = 'New' | 'Reviewing' | 'Shortlisted' | 'Rejected' | 'Hired' | 'Deleted';
export type UserRole = 'Admin' | 'Recruiter' | 'Viewer';

export interface Candidate {
  id?: string;
  candidateName: string;
  email?: string;
  phone?: string;
  yearsExp: number;
  education?: string;
  discipline: string;
  specializedField?: string;
  workFields?: string;
  currentStatus: CandidateStatus;
  certifications?: string;
  
  // AI Metadata
  aiScore?: number;
  aiStrengths?: string;
  aiGaps?: string;
  aiSummary?: string;
  professionalSummary?: string;
  rawText?: string;
  employmentRecords?: string;
  projectRecords?: string;
  detailedTasks?: string;
  
  // File context
  driveFileId?: string;
  driveFileName?: string;
  driveFileUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  
  // Tracking
  addedAt: string;
  updatedAt: string;
  ownerId: string;
  confirmed?: boolean;
  cvFormatted?: boolean;
  exportedWord?: string;
  keySkills?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface SystemConfig {
  driveSourceFolderId?: string;
  driveRootFolderId?: string;
  googleSheetId?: string;
  googleClientId?: string;
  autoBackupEnabled?: boolean;
  geminiApiKey?: string;
}

export interface UserSettings {
  userId: string;
  userName?: string;
  email: string;
  role: UserRole;
  driveToken?: string;
  driveSourceFolderId?: string;
  driveRootFolderId?: string;
  googleSheetId?: string;
  googleClientId?: string;
  autoBackupEnabled?: boolean;
  geminiApiKey?: string;
  updatedAt: string;
}

export interface ActivityLog {
  id?: string;
  type: 'extract' | 'status' | 'export' | 'delete' | 'ai' | 'template' | 'login' | string;
  text: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface CompanyTemplate {
  id: string;
  name: string;
  color: string;
  accent: string;
  logo: string;
  country: string;
  isCustom?: boolean;
  fileBase64?: string;
  ownerId?: string;
  updatedAt?: string;
}
