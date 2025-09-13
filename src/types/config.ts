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
  trial_history_imported: number;
  trial_history_skipped: number;
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

export interface ConfigFileInfo {
  id: string;
  name: string;
  size: number;
  created_at: string;
  created_by: string;
  download_count: number;
  last_downloaded_at?: string;
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