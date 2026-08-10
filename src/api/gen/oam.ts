/**
 * Generated from api-spec/oam-swagger.json by scripts/gen-api-types.mjs — DO NOT EDIT.
 * Regenerate with: npm run gen:api
 */

export interface paths {
    "/oam/alerts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.PaginatedAlertsResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create alert
         * @description Creates a new alert in the system
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
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
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.CreateAlertResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/alerts/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.PaginatedAlertsResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/alerts/{id}/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Acknowledge alert
         * @description Acknowledges an alert by ID
         */
        put: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Alert ID */
                    id: number;
                };
                cookie?: never;
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
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.AcknowledgeResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Health check
         * @description Checks the health of the application and database connection.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.HealthCheckResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.HealthCheckResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/instances/{id}/snapshot-schedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read an instance's snapshot schedule
         * @description Returns the scheduled-snapshot/retention settings; defaults (disabled, every 24h, keep 10) when never configured.
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.InstanceSnapshotSchedule"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        /**
         * Update an instance's snapshot schedule
         * @description Enables/disables scheduled snapshots and sets interval and per-instance retention (keep-N unpinned; pre_upgrade and pinned snapshots are exempt).
         */
        put: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            /** @description Schedule settings */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["models.SnapshotScheduleRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.InstanceSnapshotSchedule"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/instances/{id}/snapshots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List snapshots of an instance
         * @description Returns snapshot metadata (never blobs) for one instance, newest first, paginated.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Page number (default 1) */
                    page?: number;
                    /** @description Page size (default 20, max 100) */
                    limit?: number;
                };
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.PaginatedSnapshotsResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Take an instance config snapshot now
         * @description Calls the gateway's GET /config/snapshot on the managed instance and stores the document (gzip, AES-256-GCM at rest when SNAPSHOT_ENC_KEY is set) in the OAM database. Returns metadata only, never the blob.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            /** @description Snapshot name/description/trigger */
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["models.TakeSnapshotRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.InstanceSnapshot"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Request Entity Too Large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Gateway unreachable (connection error passed through verbatim) */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/instances/{id}/snapshots/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Re-import an off-box snapshot archive
         * @description Accepts a previously downloaded snapshot document (multipart field "file"). Only the envelope (schema_version, gateway_version, checksum) is parsed — deep validation stays the gateway's job at restore time.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description Snapshot document JSON
                         */
                        file: string;
                        /** @description Snapshot name */
                        name?: string;
                        /** @description Description */
                        description?: string;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.InstanceSnapshot"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Request Entity Too Large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * User login
         * @description Authenticates a user and returns a JWT token with comprehensive license information if the credentials are valid.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description User credentials */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["models.LoginRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.EnhancedLoginResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Too many failed login attempts */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * User logout
         * @description Invalidates the user's token and logs them out.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.MessageResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.LogResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/logs/archives": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List log archives
         * @description List available log archives
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.LogArchivesResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/logs/archives/{filename}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download log archive
         * @description Download a log archive by filename
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Log archive filename */
                    filename: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": string;
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/loxilbs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fetch LoxiLB instances
         * @description Retrieves LoxiLB instances and returns them as JSON.
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.LoxiLBInstance"][];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a new LoxiLB instance
         * @description Create a new LoxiLB instance.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
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
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.LoxiLBInstance"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/loxilbs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fetch LoxiLB instance by ID
         * @description Retrieves a LoxiLB instance by ID.
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.LoxiLBInstance"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
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
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
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
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.LoxiLBInstance"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        /**
         * Delete a LoxiLB instance
         * @description Deletes a LoxiLB instance by ID
         */
        delete: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.MessageResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/loxilbs/{id}/firmware": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update LoxiLB instance firmware
         * @description Updates the firmware of a LoxiLB instance image.
         */
        put: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
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
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/loxilbs/{id}/firmware/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Start LoxiLB instance firmware
         * @description Starts the firmware of a LoxiLB instance image using the instance ID.
         */
        put: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/loxilbs/{id}/firmware/stop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Stop LoxiLB instance firmware
         * @description Stops the firmware of a LoxiLB instance image using the instance ID.
         */
        put: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/loxilbs/{id}/netlox/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Proxy request to LoxiLB instance
         * @description Forwards HTTP requests to the specified LoxiLB instance
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Successful response from LoxiLB */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessPostResponse"];
                    };
                };
                /** @description Successful response from LoxiLB */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": unknown;
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Service Unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
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
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Successful response from LoxiLB */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessPostResponse"];
                    };
                };
                /** @description Successful response from LoxiLB */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": unknown;
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Service Unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
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
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Successful response from LoxiLB */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessPostResponse"];
                    };
                };
                /** @description Successful response from LoxiLB */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": unknown;
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Service Unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
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
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Successful response from LoxiLB */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessPostResponse"];
                    };
                };
                /** @description Successful response from LoxiLB */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": unknown;
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Service Unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Proxy request to LoxiLB instance
         * @description Forwards HTTP requests to the specified LoxiLB instance
         */
        patch: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description LoxiLB Instance ID */
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Successful response from LoxiLB */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SuccessPostResponse"];
                    };
                };
                /** @description Successful response from LoxiLB */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": unknown;
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Service Unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/oam/oauth/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * OAuth login
         * @description Initiates the OAuth login flow for the specified provider.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description OAuth provider */
                    provider: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Found */
                302: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["models.MessageResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/oauth/{provider}/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
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
                header?: never;
                path: {
                    /** @description OAuth provider */
                    provider: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["models.EnhancedLoginResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "*/*": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/setup/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get admin credential setup status
         * @description Check if admin credentials need to be updated from defaults
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.SetupStatusResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/setup/update-admin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Update admin credentials
         * @description Update admin credentials from default username/password to user-defined values
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description Admin credential update request */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["models.AdminUpdateRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.AdminUpdateResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/snapshots/{sid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get one snapshot's metadata
         * @description Returns snapshot metadata including restore history and the full gateway response of the last restore (the audit record).
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Snapshot ID (UUID) */
                    sid: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.InstanceSnapshot"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /**
         * Delete a snapshot
         * @description Deletes a stored snapshot. Pinned snapshots require force=true.
         */
        delete: {
            parameters: {
                query?: {
                    /** @description Required to delete a pinned snapshot */
                    force?: boolean;
                };
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Snapshot ID (UUID) */
                    sid: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.MessageResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Snapshot is pinned and force was not set */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Update snapshot metadata
         * @description Updates name, description and/or pinned. Pinned snapshots are exempt from retention.
         */
        patch: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Snapshot ID (UUID) */
                    sid: string;
                };
                cookie?: never;
            };
            /** @description Fields to update */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["models.UpdateSnapshotRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.InstanceSnapshot"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/oam/snapshots/{sid}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download a snapshot document
         * @description Streams the decrypted, decompressed snapshot JSON. The document contains IPsec PSKs and certificate private keys, so this is write-gated and audit-logged. X-Snapshot-Checksum carries the gateway's document checksum; X-Content-Checksum is sha256 over the exact bytes served.
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Snapshot ID (UUID) */
                    sid: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description snapshot document JSON */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": string;
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Stored blob failed integrity verification */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/snapshots/{sid}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restore a stored snapshot to a gateway
         * @description Default mode is dry-run: the gateway validates and returns its plan without mutating anything. Commit first takes an automatic pre_restore safety snapshot of the target, then applies. The gateway's response is returned verbatim in gateway_response. Cross-instance restore is allowed and flagged with cross_instance=true.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Snapshot ID (UUID) */
                    sid: string;
                };
                cookie?: never;
            };
            /** @description mode: dry-run (default) | commit; optional target_instance_id */
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["models.RestoreSnapshotRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.RestoreOutcome"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Stored blob failed integrity verification (never sent to the gateway) */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Gateway unreachable (connection error passed through verbatim) */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fetch all users
         * @description Retrieves all users from the database and returns them as a JSON response.
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.User"][];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Create a new user
         * @description Creates a new user in the system with optional license key and role
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description User data */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["models.CreateUserRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.UserIdResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get current user profile
         * @description Retrieves the authenticated user's profile information based on the JWT token
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.User"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oam/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update user fields
         * @description Updates specific user fields (username, email, role, password) based on provided JSON payload. Only non-empty fields are updated.
         */
        put: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description User ID */
                    id: number;
                };
                cookie?: never;
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
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.MessageResponse"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        post?: never;
        /**
         * Delete user
         * @description Deletes a user by its ID
         */
        delete: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description User ID */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.MessageResponse"];
                    };
                };
                /** @description Internal Server Error */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["models.ErrorResponse"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
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
            password: string;
            /** @description Optional: Admin can set role (defaults to "user") */
            role?: string;
            username: string;
        };
        "models.EnhancedLoginResponse": {
            id?: number;
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
        "models.InstanceSnapshot": {
            /** @description "sha256:<hex>", gateway-computed (envelope) */
            checksum?: string;
            /** @description integrity-sweep verdict */
            checksum_ok?: boolean;
            created_at?: string;
            created_by?: string;
            description?: string;
            encrypted?: boolean;
            gateway_version?: string;
            id?: string;
            instance_id?: number;
            /**
             * @description LastRestoreResponse is the full gateway response JSON of the most
             *     recent restore attempt (the audit record). Only populated on the
             *     single-snapshot GET, not in lists.
             */
            last_restore_response?: string;
            last_restore_result?: string;
            last_restored_at?: string;
            name?: string;
            pinned?: boolean;
            restore_count?: number;
            schema_version?: string;
            /** @description uncompressed JSON size */
            size_bytes?: number;
            /** @description "sha256:<hex>" over raw JSON bytes as received, OAM-computed */
            stored_checksum?: string;
            trigger_type?: string;
        };
        "models.InstanceSnapshotSchedule": {
            enabled?: boolean;
            instance_id?: number;
            interval_hours?: number;
            last_run_at?: string;
            last_run_result?: string;
            retain_count?: number;
        };
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
        "models.PaginatedSnapshotsResponse": {
            data?: components["schemas"]["models.InstanceSnapshot"][];
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
        "models.RestoreOutcome": {
            cross_instance?: boolean;
            gateway_response?: Record<string, never>;
            gateway_status?: number;
            /** @description restore target */
            instance_id?: number;
            mode?: string;
            pre_restore_snapshot_id?: string;
            snapshot_id?: string;
        };
        "models.RestoreSnapshotRequest": {
            /** @description "dry-run" (default) | "commit" */
            mode?: string;
            /**
             * @description TargetInstanceID restores the snapshot onto a different instance than
             *     the one it was taken from (cross-instance restore). Defaults to the
             *     snapshot's own instance.
             */
            target_instance_id?: number;
        };
        "models.SetupStatusResponse": {
            adminExists?: boolean;
            credentialsUpdated?: boolean;
            hasDefaultCredentials?: boolean;
            needsCredentialUpdate?: boolean;
            systemInfo?: components["schemas"]["models.SystemInfo"];
        };
        "models.SnapshotScheduleRequest": {
            enabled?: boolean;
            interval_hours?: number;
            retain_count?: number;
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
        "models.TakeSnapshotRequest": {
            description?: string;
            name?: string;
            /** @description defaults to "manual" */
            trigger_type?: string;
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
        "models.UpdateSnapshotRequest": {
            description?: string;
            name?: string;
            pinned?: boolean;
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
            /** @description e.g., "admin", "user" */
            role?: string;
            username?: string;
        };
        "models.UserIdResponse": {
            id?: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
