// Configuration Management Types
export interface ConfigExport {
  id: string;
  description: string;
  exported_at: string;
  exported_by: string;
  file_size: number;
  checksum: string;
  download_count: number;
  last_downloaded_at?: string;
  expires_at: string;
  export_type: string;
  file_path: string;
}

export interface ConfigImportResult {
  success: boolean;
  message: string;
  backup_id?: string;
  dry_run: boolean;
  errors: ImportError[];
  import_summary: ConfigImportSummary;
}

export interface ConfigImportSummary {
  users_imported: number;
  users_skipped: number;
  instances_imported: number;
  instances_skipped: number;
  settings_updated: number;
}

export interface ImportError {
  type: string;
  field: string;
  message: string;
  record: string;
  record_index: number;
}

export interface ExportRequest {
  description?: string;
}

export interface FileListResponse {
  files: ConfigFileInfo[];
  pagination: PaginationInfo;
  filters: FilterInfo;
  message: string;
}

// Shape of each entry returned by GET /oam/config/files. Mirrors the OAM
// response (the older name/size/created_at fields never matched the wire, which
// is why the File Management tab had fallen back to `any`).
export interface ConfigFileInfo {
  id: string;
  filename: string;
  description?: string;
  exported_at: string;
  exported_by: string;
  export_type?: string;
  file_size: number;
  file_size_human: string;
  // NOTE: file_exists is currently unreliable from the OAM list endpoint (it
  // reports false even for files that download fine), so the UI must not gate
  // downloads on it. is_expired / expires_in are reliable.
  file_exists: boolean;
  is_expired: boolean;
  expires_at?: string;
  expires_in?: string;
  download_count: number;
  last_downloaded_at?: string | null;
  time_since_export?: string;
  checksum?: string;
  download_url?: string;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface FilterInfo {
  exported_by?: string[];
  date_range?: {
    start: string;
    end: string;
  };
}

// UI State Types
export interface ConfigUIState {
  activeTab: ConfigTab;
  exportProgress: OperationProgress;
  importProgress: OperationProgress;
  selectedFiles: string[];
  validationResult?: ValidationResult;
  isLoading: boolean;
  error?: string;
}

export type ConfigTab = 'export' | 'import' | 'files' | 'backups';

export interface OperationProgress {
  status: 'idle' | 'processing' | 'success' | 'error';
  progress: number;
  message?: string;
  startTime?: Date;
  estimatedCompletion?: Date;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
  summary: {
    total_records: number;
    valid_records: number;
    invalid_records: number;
  };
}

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
  line?: number;
  suggestion?: string;
}

// API Response Types
export interface ExportResponse {
  export_id: string;
  export_data: ConfigExport;
  message: string;
}

export interface ExportListResponse {
  exports: ConfigExport[];
  count: number;
  message: string;
}