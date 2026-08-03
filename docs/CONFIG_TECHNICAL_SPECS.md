# Config Management Technical Specifications

## 1. TypeScript Type Definitions

### 1.1 Core Types
```typescript
// src/types/config.ts

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
```

### 1.2 API Response Types
```typescript
// API Response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface ExportResponse {
  export_id: string;
  export_data: ConfigExport;
  message: string;
}

export interface DownloadResponse extends Blob {
  filename?: string;
}
```

## 2. Component Props Interfaces

### 2.1 Tab Components
```typescript
// Export Tab
export interface ExportTabProps {
  onExportStart: () => void;
  onExportComplete: (exportId: string) => void;
  onExportError: (error: string) => void;
  isExporting: boolean;
  exportProgress: number;
}

// Import Tab  
export interface ImportTabProps {
  onImportStart: (file: File) => void;
  onImportComplete: (result: ConfigImportResult) => void;
  onValidationComplete: (result: ValidationResult) => void;
  isImporting: boolean;
  importProgress: number;
  validationResult?: ValidationResult;
}

// File Management Tab
export interface FileManagementTabProps {
  files: ConfigFileInfo[];
  selectedFiles: string[];
  onFileSelect: (fileIds: string[]) => void;
  onFileDownload: (fileId: string) => void;
  onFileDelete: (fileIds: string[]) => void;
  onRefresh: () => void;
  isLoading: boolean;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}
```

### 2.2 Utility Components
```typescript
// File Uploader
export interface ConfigFileUploaderProps {
  onFileSelect: (file: File) => void;
  acceptedTypes: string[];
  maxSize: number; // in MB
  disabled?: boolean;
  dropzoneText?: string;
  className?: string;
}

// Progress Tracker
export interface ProgressTrackerProps {
  progress: OperationProgress;
  onCancel?: () => void;
  showDetails?: boolean;
  className?: string;
}

// Validation Panel
export interface ValidationPanelProps {
  result: ValidationResult;
  onAccept: () => void;
  onReject: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
}

// Configuration Table
export interface ConfigTableProps {
  data: ConfigFileInfo[];
  selectedItems: string[];
  onSelectionChange: (selected: string[]) => void;
  onDownload: (id: string) => void;
  onDelete: (ids: string[]) => void;
  onViewDetails: (id: string) => void;
  loading?: boolean;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}
```

## 3. Custom Hooks Specifications

### 3.1 Export Hook
```typescript
// src/hooks/config/useConfigExport.ts
export interface UseConfigExportReturn {
  exportConfig: (description?: string) => Promise<void>;
  exportProgress: OperationProgress;
  isExporting: boolean;
  lastExportId?: string;
  error?: string;
  clearError: () => void;
}

export const useConfigExport = (): UseConfigExportReturn => {
  // Implementation details...
};
```

### 3.2 Import Hook
```typescript
// src/hooks/config/useConfigImport.ts
export interface UseConfigImportReturn {
  validateImport: (file: File) => Promise<ValidationResult>;
  importConfig: (file: File) => Promise<ConfigImportResult>;
  importProgress: OperationProgress;
  validationResult?: ValidationResult;
  isValidating: boolean;
  isImporting: boolean;
  error?: string;
  clearError: () => void;
  clearValidation: () => void;
}

export const useConfigImport = (): UseConfigImportReturn => {
  // Implementation details...
};
```

### 3.3 File Management Hook
```typescript
// src/hooks/config/useConfigFiles.ts
export interface UseConfigFilesReturn {
  files: ConfigFileInfo[];
  loading: boolean;
  error?: string;
  pagination: PaginationInfo;
  filters: FilterInfo;
  selectedFiles: string[];
  
  // Actions
  fetchFiles: (params?: FetchFilesParams) => Promise<void>;
  downloadFile: (fileId: string) => Promise<void>;
  deleteFiles: (fileIds: string[]) => Promise<void>;
  setSelectedFiles: (fileIds: string[]) => void;
  setFilters: (filters: Partial<FilterInfo>) => void;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
}

export interface FetchFilesParams {
  limit?: number;
  offset?: number;
  exported_by?: string;
  start_date?: string;
  end_date?: string;
}
```

## 4. API Client Specifications

### 4.1 Configuration API Client
```typescript
// src/connector/config/configApi.ts

export class ConfigAPI {
  private baseURL: string;
  private authToken: string;

  constructor(baseURL: string, authToken: string) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  // Export configuration
  async exportConfig(request: ExportRequest): Promise<ExportResponse> {
    const response = await fetch(`${this.baseURL}/oam/config/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new ConfigAPIError('Export failed', response.status);
    }

    return response.json();
  }

  // Import configuration
  async importConfig(file: File): Promise<ConfigImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}/oam/config/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new ConfigAPIError('Import failed', response.status);
    }

    return response.json();
  }

  // Validate import (dry-run)
  async validateImport(file: File): Promise<ConfigImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}/oam/config/import/dry-run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new ConfigAPIError('Validation failed', response.status);
    }

    return response.json();
  }

  // Get configuration exports
  async getExports(): Promise<{ exports: ConfigExport[]; count: number; message: string }> {
    const response = await fetch(`${this.baseURL}/oam/config/exports`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new ConfigAPIError('Failed to fetch exports', response.status);
    }

    return response.json();
  }

  // Get configuration files
  async getConfigFiles(params: FetchFilesParams = {}): Promise<FileListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.exported_by) searchParams.set('exported_by', params.exported_by);

    const response = await fetch(
      `${this.baseURL}/oam/config/files?${searchParams}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new ConfigAPIError('Failed to fetch config files', response.status);
    }

    return response.json();
  }

  // Download configuration file
  async downloadConfigFile(exportId: string): Promise<DownloadResponse> {
    const response = await fetch(`${this.baseURL}/oam/config/download/${exportId}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    if (!response.ok) {
      throw new ConfigAPIError('Download failed', response.status);
    }

    const blob = await response.blob();
    const filename = this.extractFilenameFromResponse(response);
    
    return Object.assign(blob, { filename });
  }

  private extractFilenameFromResponse(response: Response): string {
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) return match[1];
    }
    return `config-export-${Date.now()}.json`;
  }
}

// Error handling
export class ConfigAPIError extends Error {
  constructor(message: string, public status?: number, public details?: any) {
    super(message);
    this.name = 'ConfigAPIError';
  }
}
```

## 5. State Management Specifications

### 5.1 Recoil Atoms
```typescript
// src/atoms.tsx - Add config-related atoms

export const configExportsAtom = atom<ConfigExport[]>({
  key: 'configExports',
  default: []
});

export const configFilesAtom = atom<ConfigFileInfo[]>({
  key: 'configFiles', 
  default: []
});

export const configUIStateAtom = atom<ConfigUIState>({
  key: 'configUIState',
  default: {
    activeTab: 'export',
    exportProgress: { status: 'idle', progress: 0 },
    importProgress: { status: 'idle', progress: 0 },
    selectedFiles: [],
    isLoading: false
  }
});

export const configValidationAtom = atom<ValidationResult | null>({
  key: 'configValidation',
  default: null
});
```

### 5.2 Selectors
```typescript
// Derived state selectors
export const configExportsByUserSelector = selectorFamily<ConfigExport[], string>({
  key: 'configExportsByUser',
  get: (userId) => ({ get }) => {
    const exports = get(configExportsAtom);
    return exports.filter(exp => exp.exported_by === userId);
  }
});

export const configFileSummarySelector = selector<{
  totalFiles: number;
  totalSize: number;
  recentFiles: ConfigFileInfo[];
}>({
  key: 'configFileSummary',
  get: ({ get }) => {
    const files = get(configFilesAtom);
    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      recentFiles: files.slice(0, 5).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    };
  }
});
```

## 6. Routing Configuration

### 6.1 Route Definition
```typescript
// src/App.tsx - Add config management route

import { ConfigManagementPage } from './pages/ConfigManagementPage';

// Add to routes array
{
  path: '/config-management',
  element: <ConfigManagementPage />,
  meta: {
    title: 'Configuration Management',
    requiresAuth: true,
    requiredRole: ['admin'],
    breadcrumb: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Configuration Management', path: '/config-management' }
    ]
  }
}
```

### 6.2 Navigation Integration
```typescript
// src/components/layout/Navigation.tsx - Add menu item

const configManagementMenuItem = {
  id: 'config-management',
  label: t('navigation.configManagement'),
  path: '/config-management',
  icon: <SettingsApplicationsIcon />,
  roles: ['admin'],
  children: [
    {
      id: 'export-config',
      label: t('navigation.exportConfig'),
      path: '/config-management#export'
    },
    {
      id: 'import-config', 
      label: t('navigation.importConfig'),
      path: '/config-management#import'
    },
    {
      id: 'manage-files',
      label: t('navigation.manageFiles'), 
      path: '/config-management#files'
    }
  ]
};
```

## 7. Internationalization Keys

### 7.1 English (en.json)
```json
{
  "configManagement": {
    "title": "Configuration Management",
    "description": "Export, import, and manage system configurations",
    "tabs": {
      "export": "Export Configuration",
      "import": "Import Configuration", 
      "files": "File Management",
      "backups": "Backup History"
    },
    "export": {
      "title": "Export System Configuration",
      "description": "Create a backup of current system configuration",
      "descriptionPlaceholder": "Optional: Enter export description",
      "startExport": "Start Export",
      "exporting": "Exporting configuration...",
      "success": "Configuration exported successfully",
      "downloadReady": "Download is ready"
    },
    "import": {
      "title": "Import Configuration",
      "description": "Upload and apply configuration from file",
      "selectFile": "Select Configuration File",
      "dragDropText": "Drag and drop file here, or click to select",
      "validating": "Validating configuration...",
      "importing": "Importing configuration...",
      "validationResults": "Validation Results",
      "proceedWithImport": "Proceed with Import",
      "cancelImport": "Cancel Import"
    },
    "files": {
      "title": "Configuration Files",
      "description": "Manage exported configuration files",
      "fileName": "File Name",
      "fileSize": "Size",
      "exportedBy": "Exported By", 
      "exportedAt": "Export Date",
      "downloadCount": "Downloads",
      "actions": "Actions",
      "download": "Download",
      "delete": "Delete",
      "viewDetails": "View Details",
      "bulkActions": "Bulk Actions",
      "selectedItems": "{{count}} items selected"
    },
    "validation": {
      "errors": "{{count}} errors found",
      "warnings": "{{count}} warnings found",
      "noIssues": "No issues found",
      "details": "Show Details",
      "hideDetails": "Hide Details"
    },
    "errors": {
      "exportFailed": "Failed to export configuration",
      "importFailed": "Failed to import configuration", 
      "validationFailed": "Configuration validation failed",
      "downloadFailed": "Failed to download file",
      "deleteFailed": "Failed to delete file(s)",
      "fileTooLarge": "File size exceeds maximum limit",
      "invalidFileType": "Invalid file type",
      "networkError": "Network connection error"
    }
  }
}
```

## 8. Testing Specifications

### 8.1 Unit Tests Structure
```typescript
// __tests__/config/
├── ConfigManagementPage.test.tsx
├── components/
│   ├── ExportTab.test.tsx
│   ├── ImportTab.test.tsx
│   ├── FileManagementTab.test.tsx
│   ├── ConfigFileUploader.test.tsx
│   └── ValidationPanel.test.tsx
├── hooks/
│   ├── useConfigExport.test.ts
│   ├── useConfigImport.test.ts
│   └── useConfigFiles.test.ts
├── api/
│   └── configApi.test.ts
└── utils/
    └── configValidation.test.ts
```

### 8.2 Test Scenarios
```typescript
// Example test cases
describe('ConfigManagementPage', () => {
  it('should render all tabs', () => {});
  it('should handle tab navigation', () => {});
  it('should display loading state', () => {});
  it('should handle error states', () => {});
});

describe('useConfigExport', () => {
  it('should export configuration successfully', () => {});
  it('should handle export errors', () => {});
  it('should track export progress', () => {});
  it('should clear errors', () => {});
});

describe('ConfigAPI', () => {
  it('should make correct API calls', () => {});
  it('should handle network errors', () => {});
  it('should format request/response data', () => {});
});
```

This technical specification provides the detailed implementation guidelines needed to build the config management feature following TypeScript best practices and the existing codebase patterns.