/**
 * Generated from api-spec/oam-swagger.json by scripts/gen-api-types.mjs — DO NOT EDIT.
 * Regenerate with: npm run gen:api
 */


export interface paths {
  "/oam/admin/reset": {
    /**
     * Reset admin account to defaults
     * @description Reset admin account to default username (admin), password (AdminNetlox132!), and email. Useful for recovery or testing.
     */
    post: {
      /** @description Admin reset confirmation request */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.AdminResetRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.AdminResetResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/alerts": {
    /**
     * Get active alerts
     * @description Retrieves all active alerts from the database with pagination (always returns paginated response)
     */
    get: {
      parameters: {
        query?: {
          /** @description Page number (default: 1) */
          page?: number;
          /** @description Number of items per page (default: 20, max: 100) */
          limit?: number;
        };
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.PaginatedAlertsResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Create alert
     * @description Creates a new alert in the system
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      /** @description Alert data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.CreateAlertRequest"];
        };
      };
      responses: {
        /** @description Created */
        201: {
          content: {
            "application/json": components["schemas"]["models.CreateAlertResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/alerts/history": {
    /**
     * Get alert history
     * @description Retrieves alert history within a specified time range with pagination (always returns paginated response)
     */
    get: {
      parameters: {
        query?: {
          /** @description Start time (RFC3339 format) */
          start?: string;
          /** @description End time (RFC3339 format) */
          end?: string;
          /** @description Page number (default: 1) */
          page?: number;
          /** @description Number of items per page (default: 20, max: 100) */
          limit?: number;
        };
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.PaginatedAlertsResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/alerts/{id}/acknowledge": {
    /**
     * Acknowledge alert
     * @description Acknowledges an alert by ID
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description Alert ID */
          id: number;
        };
      };
      /** @description Acknowledgement data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.AcknowledgeRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.AcknowledgeResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/config/download/{id}": {
    /**
     * Download exported configuration file
     * @description Downloads a previously exported configuration file by export ID
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description Export ID */
          id: string;
        };
      };
      responses: {
        /** @description Configuration file download */
        200: {
          content: {
            "application/octet-stream": string;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/octet-stream": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/octet-stream": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/octet-stream": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/octet-stream": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/config/export": {
    /**
     * Export system configuration
     * @description Exports the current OAM system configuration including users, instances, and settings to a downloadable file
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      /** @description Export request with optional description */
      requestBody: {
        content: {
          "application/json": {
            description?: string;
          };
        };
      };
      responses: {
        /** @description Configuration exported successfully */
        200: {
          content: {
            "application/json": {
              export_data?: components["schemas"]["models.ConfigExport"];
              export_id?: string;
              message?: string;
            };
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/config/exports": {
    /**
     * List configuration exports
     * @description Retrieves a list of all available configuration exports with basic metadata
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description Exports retrieved successfully */
        200: {
          content: {
            "application/json": {
              count?: number;
              exports?: components["schemas"]["models.ConfigExport"][];
              message?: string;
            };
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/config/files": {
    /**
     * Get downloadable configuration files
     * @description Retrieves a detailed list of downloadable configuration files with enhanced metadata, pagination, and filtering
     */
    get: {
      parameters: {
        query?: {
          /** @description Filter by user who exported the configuration */
          exported_by?: string;
          /** @description Maximum number of files to return (1-100, default: 50) */
          limit?: number;
          /** @description Number of files to skip for pagination (default: 0) */
          offset?: number;
        };
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description Downloadable files retrieved successfully */
        200: {
          content: {
            "application/json": {
              files?: Record<string, never>[];
              filters?: Record<string, never>;
              message?: string;
              pagination?: Record<string, never>;
            };
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/config/import": {
    /**
     * Import system configuration
     * @description Imports system configuration from uploaded JSON file with mandatory backup creation
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      requestBody: {
        content: {
          "multipart/form-data": {
            /**
             * Format: binary
             * @description Configuration JSON file to import
             */
            file: string;
          };
        };
      };
      responses: {
        /** @description Configuration imported successfully */
        200: {
          content: {
            "application/json": {
              message?: string;
              result?: components["schemas"]["models.ConfigImportResponseOAM"];
            };
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/config/import/dry-run": {
    /**
     * Dry-run configuration import
     * @description Validates configuration import data without making changes to the system
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      requestBody: {
        content: {
          "multipart/form-data": {
            /**
             * Format: binary
             * @description Configuration JSON file to validate
             */
            file: string;
          };
        };
      };
      responses: {
        /** @description Dry-run validation completed */
        200: {
          content: {
            "application/json": {
              message?: string;
              result?: components["schemas"]["models.ConfigImportResponseOAM"];
            };
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/health": {
    /**
     * Health check
     * @description Checks the health of the application and database connection.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.HealthCheckResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.HealthCheckResponse"];
          };
        };
      };
    };
  };
  "/oam/license/feature-access": {
    /**
     * Check feature access
     * @description Checks if the authenticated user's license allows access to a specific feature
     */
    get: {
      parameters: {
        query: {
          /** @description Feature name to check (e.g., 'export', 'custom_integration', 'unlimited_users') */
          feature: string;
        };
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "*/*": components["schemas"]["models.SuccessResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Forbidden */
        403: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/license/install": {
    /**
     * Install license
     * @description Installs a new license key for the authenticated user
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      /** @description License installation data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.InstallLicenseRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/license/validate": {
    /**
     * Validate license key
     * @description Validates a license key format and expiration without installing it
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      /** @description License validation data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.InstallLicenseRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.LicensePayload"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/login": {
    /**
     * User login
     * @description Authenticates a user and returns a JWT token with comprehensive license information if the credentials are valid.
     */
    post: {
      /** @description User credentials */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.LoginRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.EnhancedLoginResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Too many failed login attempts */
        429: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/logout": {
    /**
     * User logout
     * @description Invalidates the user's token and logs them out.
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.MessageResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/logs": {
    /**
     * Fetch logs
     * @description Retrieves logs from the log file within the specified time range.
     */
    get: {
      parameters: {
        query?: {
          /** @description Number of lines */
          lines?: number;
          /** @description Log level */
          level?: string;
          /** @description Start time */
          startTime?: string;
        };
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.LogResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/logs/archives": {
    /**
     * List log archives
     * @description List available log archives
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.LogArchivesResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/logs/archives/{filename}": {
    /**
     * Download log archive
     * @description Download a log archive by filename
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description Log archive filename */
          filename: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/octet-stream": string;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/octet-stream": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/octet-stream": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/loxilbs": {
    /**
     * Fetch LoxiLB instances
     * @description Retrieves LoxiLB instances and returns them as JSON.
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.LoxiLBInstance"][];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Create a new LoxiLB instance
     * @description Create a new LoxiLB instance.
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      /** @description LoxiLB Instance */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.LoxiLBInstanceRequest"];
        };
      };
      responses: {
        /** @description Created */
        201: {
          content: {
            "application/json": components["schemas"]["models.LoxiLBInstance"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/loxilbs/{id}": {
    /**
     * Fetch LoxiLB instance by ID
     * @description Retrieves a LoxiLB instance by ID.
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.LoxiLBInstance"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Update LoxiLB instance
     * @description Updates an existing LoxiLB instance with the provided JSON payload
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      /** @description LoxiLB instance data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.LoxiLBInstance"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.LoxiLBInstance"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Delete a LoxiLB instance
     * @description Deletes a LoxiLB instance by ID
     */
    delete: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.MessageResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/loxilbs/{id}/firmware": {
    /**
     * Update LoxiLB instance firmware
     * @description Updates the firmware of a LoxiLB instance image.
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      /** @description Firmware update data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.UpdateFirmwareRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/loxilbs/{id}/firmware/start": {
    /**
     * Start LoxiLB instance firmware
     * @description Starts the firmware of a LoxiLB instance image using the instance ID.
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/loxilbs/{id}/firmware/stop": {
    /**
     * Stop LoxiLB instance firmware
     * @description Stops the firmware of a LoxiLB instance image using the instance ID.
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/loxilbs/{id}/netlox/": {
    /**
     * Proxy request to LoxiLB instance
     * @description Forwards HTTP requests to the specified LoxiLB instance
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description Successful response from LoxiLB */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessPostResponse"];
          };
        };
        /** @description Successful response from LoxiLB */
        204: {
          content: {
            "application/json": unknown;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Forbidden */
        403: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Conflict */
        409: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Service Unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Proxy request to LoxiLB instance
     * @description Forwards HTTP requests to the specified LoxiLB instance
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description Successful response from LoxiLB */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessPostResponse"];
          };
        };
        /** @description Successful response from LoxiLB */
        204: {
          content: {
            "application/json": unknown;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Forbidden */
        403: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Conflict */
        409: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Service Unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Proxy request to LoxiLB instance
     * @description Forwards HTTP requests to the specified LoxiLB instance
     */
    post: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description Successful response from LoxiLB */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessPostResponse"];
          };
        };
        /** @description Successful response from LoxiLB */
        204: {
          content: {
            "application/json": unknown;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Forbidden */
        403: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Conflict */
        409: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Service Unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Proxy request to LoxiLB instance
     * @description Forwards HTTP requests to the specified LoxiLB instance
     */
    delete: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description Successful response from LoxiLB */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessPostResponse"];
          };
        };
        /** @description Successful response from LoxiLB */
        204: {
          content: {
            "application/json": unknown;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Forbidden */
        403: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Conflict */
        409: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Service Unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Proxy request to LoxiLB instance
     * @description Forwards HTTP requests to the specified LoxiLB instance
     */
    patch: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description LoxiLB Instance ID */
          id: number;
        };
      };
      responses: {
        /** @description Successful response from LoxiLB */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessPostResponse"];
          };
        };
        /** @description Successful response from LoxiLB */
        204: {
          content: {
            "application/json": unknown;
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Forbidden */
        403: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Conflict */
        409: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Service Unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/oauth/{provider}": {
    /**
     * OAuth login
     * @description Initiates the OAuth login flow for the specified provider.
     */
    get: {
      parameters: {
        path: {
          /** @description OAuth provider */
          provider: string;
        };
      };
      responses: {
        /** @description Found */
        302: {
          content: {
            "*/*": components["schemas"]["models.MessageResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/oauth/{provider}/callback": {
    /**
     * OAuth callback
     * @description Handles the OAuth callback flow for the specified provider and returns enhanced login response with license information.
     */
    get: {
      parameters: {
        query: {
          /** @description OAuth code */
          code: string;
          /** @description OAuth state */
          state: string;
        };
        path: {
          /** @description OAuth provider */
          provider: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "*/*": components["schemas"]["models.EnhancedLoginResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "*/*": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/setup/status": {
    /**
     * Get admin credential setup status
     * @description Check if admin credentials need to be updated from defaults
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.SetupStatusResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/setup/update-admin": {
    /**
     * Update admin credentials
     * @description Update admin credentials from default username/password to user-defined values
     */
    post: {
      /** @description Admin credential update request */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.AdminUpdateRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.AdminUpdateResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/users": {
    /**
     * Fetch all users
     * @description Retrieves all users from the database and returns them as a JSON response.
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.User"][];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Create a new user
     * @description Creates a new user in the system with optional license key and role
     */
    post: {
      /** @description User data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.CreateUserRequest"];
        };
      };
      responses: {
        /** @description Created */
        201: {
          content: {
            "application/json": components["schemas"]["models.UserIdResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/users/licenses": {
    /**
     * Get user's valid licenses
     * @description Retrieves all active and non-expired licenses for the authenticated user
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.UserLicensesResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/users/licenses/{license_id}": {
    /**
     * Update specific license
     * @description Updates a specific license key by license ID for the authenticated user
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description License ID to update */
          license_id: number;
        };
      };
      /** @description License update data */
      requestBody: {
        content: {
          "application/json": components["schemas"]["models.UpdateLicenseRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.SuccessResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Deactivate a user license
     * @description Deactivates a specific license by ID for the authenticated user
     */
    delete: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description License ID */
          license_id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.MessageResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/users/licenses/{license_id}/status": {
    /**
     * Get specific license status
     * @description Retrieves status and information for a specific license by ID for the authenticated user
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description License ID */
          license_id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.ActiveLicense"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/users/me": {
    /**
     * Get current user profile
     * @description Retrieves the authenticated user's profile information based on the JWT token
     */
    get: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.User"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
  "/oam/users/{id}": {
    /**
     * Update user fields
     * @description Updates specific user fields (username, email, role, password) based on provided JSON payload. Only non-empty fields are updated.
     */
    put: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description User ID */
          id: number;
        };
      };
      /** @description Fields to update (username, email, role, password) */
      requestBody: {
        content: {
          "application/json": {
            [key: string]: unknown;
          };
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.MessageResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Not Found */
        404: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
    /**
     * Delete user
     * @description Deletes a user by its ID
     */
    delete: {
      parameters: {
        header: {
          /** @description Bearer token */
          Authorization: string;
        };
        path: {
          /** @description User ID */
          id: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["models.MessageResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["models.ErrorResponse"];
          };
        };
      };
    };
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    "models.AcknowledgeRequest": {
      user_id: number;
    };
    "models.AcknowledgeResponse": {
      ack_time?: string;
      alert_id?: number;
      status?: string;
    };
    "models.ActiveLicense": {
      expires_at?: string;
      id?: number;
      installed_at?: string;
      is_active?: boolean;
      license_key_hash?: string;
      license_type?: components["schemas"]["models.LicenseType"];
      user_id?: number;
      username?: string;
    };
    "models.AdminResetRequest": {
      /** @description Must be true to proceed */
      confirm: boolean;
    };
    "models.AdminResetResponse": {
      adminInfo?: components["schemas"]["models.DefaultAdminInfo"];
      message?: string;
      success?: boolean;
      warning?: string;
    };
    "models.AdminUpdateRequest": {
      confirmPassword: string;
      currentPassword: string;
      currentUsername: string;
      newEmail: string;
      newPassword: string;
      newUsername: string;
    };
    "models.AdminUpdateResponse": {
      message?: string;
      newAccessToken?: string;
      success?: boolean;
    };
    "models.Alert": {
      created_at?: string;
      id?: number;
      instance_id?: number;
      message?: string;
      /** @description Nullable if not resolved */
      resolved_at?: string;
      /** @description INFO, WARNING, CRITICAL */
      severity?: string;
      /** @description DB_DISCONNECT, API_UNREACHABLE, HIGH_CPU, MEMORY_LEAK. */
      type?: string;
    };
    "models.ConfigExport": {
      checksum?: string;
      description?: string;
      download_count?: number;
      expires_at?: string;
      export_type?: string;
      exported_at?: string;
      exported_by?: string;
      file_path?: string;
      file_size?: number;
      id?: string;
      last_downloaded_at?: string;
    };
    "models.ConfigImportResponseOAM": {
      backup_id?: string;
      dry_run?: boolean;
      errors?: components["schemas"]["models.ImportError"][];
      import_summary?: components["schemas"]["models.ConfigImportSummaryOAM"];
      message?: string;
      success?: boolean;
    };
    "models.ConfigImportSummaryOAM": {
      instances_imported?: number;
      instances_skipped?: number;
      settings_updated?: number;
      trial_history_imported?: number;
      trial_history_skipped?: number;
      users_imported?: number;
      users_skipped?: number;
    };
    "models.CreateAlertRequest": {
      instance_id: number;
      message: string;
      severity: string;
      type: string;
    };
    "models.CreateAlertResponse": {
      alert_id?: number;
      status?: string;
    };
    "models.CreateUserRequest": {
      email: string;
      /** @description Optional: Admin can provide license key during creation */
      license_key?: string;
      password: string;
      /** @description Optional: Admin can set role (defaults to "user") */
      role?: string;
      username: string;
    };
    "models.DefaultAdminInfo": {
      email?: string;
      password?: string;
      userId?: number;
      username?: string;
    };
    "models.EnhancedLoginResponse": {
      days_left?: number;
      has_valid_license?: boolean;
      id?: number;
      license_expiring?: boolean;
      license_status?: components["schemas"]["models.LicenseStatusResponse"];
      token?: string;
    };
    "models.ErrorResponse": {
      /** @description code */
      code?: number;
      /** @description details */
      details?: string;
      /** @description fields */
      fields?: string[];
      /** @description message */
      message?: string;
      /** @description result */
      result?: string;
      /** @description sub code */
      "sub-code"?: number;
    };
    "models.HealthCheckResponse": {
      status?: string;
    };
    "models.ImportError": {
      field?: string;
      message?: string;
      record?: string;
      record_index?: number;
      type?: string;
    };
    "models.InstallLicenseRequest": {
      license_key: string;
    };
    "models.LicensePayload": {
      expiry?: string;
      features?: string[];
      issued_at?: string;
      license_type?: string;
      /** @description Enterprise license specific fields (optional) */
      system_installation_id?: string;
      user_id?: number;
      /** @description Common fields for all license types */
      username?: string;
    };
    "models.LicenseStatusResponse": {
      days_left?: number;
      /** @description < 7 days */
      is_expiring?: boolean;
      is_valid?: boolean;
      license?: components["schemas"]["models.ActiveLicense"];
      message?: string;
      upgrade_url?: string;
    };
    /** @enum {string} */
    "models.LicenseType": "trial" | "enterprise";
    "models.LogArchivesResponse": {
      /** @description List of log archive filenames. */
      archives?: string[];
    };
    "models.LogResponse": {
      logs?: string[];
    };
    "models.LoginRequest": {
      password: string;
      username: string;
    };
    "models.LoxiLBInstance": {
      api_endpoint?: string;
      cimage?: string;
      created_at?: string;
      ctag?: string;
      description?: string;
      host?: string;
      id?: number;
      is_active?: boolean;
      name?: string;
      port?: string;
      protocol?: string;
      version?: string;
    };
    "models.LoxiLBInstanceRequest": {
      cimage: string;
      ctag: string;
      description?: string;
      host: string;
      /** @description Optional, defaults to true */
      is_active?: boolean;
      name: string;
      port: string;
      /** @description "http" or "https" */
      protocol: string;
      version?: string;
    };
    "models.MessageResponse": {
      message?: string;
    };
    "models.PaginatedAlertsResponse": {
      /** @description The alert data */
      data?: components["schemas"]["models.Alert"][];
      /** @description Pagination metadata */
      pagination?: components["schemas"]["models.PaginationMeta"];
    };
    "models.PaginationMeta": {
      /** @description Whether there's a next page */
      has_next?: boolean;
      /** @description Whether there's a previous page */
      has_prev?: boolean;
      /** @description Number of items per page */
      limit?: number;
      /** @description Current page number */
      page?: number;
      /** @description Total number of items */
      total_count?: number;
      /** @description Total number of pages */
      total_pages?: number;
    };
    "models.SetupStatusResponse": {
      adminExists?: boolean;
      credentialsUpdated?: boolean;
      hasDefaultCredentials?: boolean;
      needsCredentialUpdate?: boolean;
      systemInfo?: components["schemas"]["models.SystemInfo"];
    };
    "models.SuccessPostResponse": {
      /** @description code */
      code?: number;
      /** @description message */
      message?: string;
    };
    "models.SuccessResponse": {
      message?: string;
    };
    "models.SystemInfo": {
      adminUserId?: number;
      installationId?: string;
      version?: string;
    };
    "models.UpdateFirmwareRequest": {
      /** @example ghcr.io/loxilb-io/loxilb */
      cimage: string;
      /** @example v0.9.8 */
      ctag: string;
      /**
       * @description Optional fields
       * @example Updated firmware description
       */
      description?: string;
      /** @example v0.9.8 */
      version?: string;
    };
    "models.UpdateLicenseRequest": {
      license_key: string;
    };
    "models.User": {
      created_at?: string;
      email?: string;
      id?: number;
      /** @description ID provided by the OAuth provider */
      oauth_id?: string;
      /** @description e.g., "google", "facebook" */
      oauth_provider?: string;
      /** @description Access token from the OAuth provider */
      oauth_token?: string;
      password?: string;
      /** @description e.g., "admin", "user" */
      role?: string;
      username?: string;
    };
    "models.UserIdResponse": {
      id?: number;
    };
    "models.UserLicensesResponse": {
      expired_count?: number;
      licenses?: components["schemas"]["models.ActiveLicense"][];
      total_count?: number;
      valid_count?: number;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export type operations = Record<string, never>;
