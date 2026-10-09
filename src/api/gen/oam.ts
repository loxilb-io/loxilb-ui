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
         * @description Forwards HTTP requests to the specified LoxiLB instance. Authorization depends on the method and on the Gateway path: see docs/proxy-functionality.md. A path with dot segments, empty segments or an encoded separator is refused with 400.
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
                /** @description The proxy does not forward this method */
                405: {
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
                /** @description LoxiLB instance unreachable, reset, unresolvable, or TLS-rejected */
                502: {
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
                /** @description The instance did not answer within the proxy timeout */
                504: {
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
         * @description Forwards HTTP requests to the specified LoxiLB instance. Authorization depends on the method and on the Gateway path: see docs/proxy-functionality.md. A path with dot segments, empty segments or an encoded separator is refused with 400.
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
                /** @description The proxy does not forward this method */
                405: {
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
                /** @description LoxiLB instance unreachable, reset, unresolvable, or TLS-rejected */
                502: {
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
                /** @description The instance did not answer within the proxy timeout */
                504: {
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
         * @description Forwards HTTP requests to the specified LoxiLB instance. Authorization depends on the method and on the Gateway path: see docs/proxy-functionality.md. A path with dot segments, empty segments or an encoded separator is refused with 400.
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
                /** @description The proxy does not forward this method */
                405: {
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
                /** @description LoxiLB instance unreachable, reset, unresolvable, or TLS-rejected */
                502: {
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
                /** @description The instance did not answer within the proxy timeout */
                504: {
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
         * @description Forwards HTTP requests to the specified LoxiLB instance. Authorization depends on the method and on the Gateway path: see docs/proxy-functionality.md. A path with dot segments, empty segments or an encoded separator is refused with 400.
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
                /** @description The proxy does not forward this method */
                405: {
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
                /** @description LoxiLB instance unreachable, reset, unresolvable, or TLS-rejected */
                502: {
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
                /** @description The instance did not answer within the proxy timeout */
                504: {
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
         * @description Forwards HTTP requests to the specified LoxiLB instance. Authorization depends on the method and on the Gateway path: see docs/proxy-functionality.md. A path with dot segments, empty segments or an encoded separator is refused with 400.
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
                /** @description The proxy does not forward this method */
                405: {
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
                /** @description LoxiLB instance unreachable, reset, unresolvable, or TLS-rejected */
                502: {
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
                /** @description The instance did not answer within the proxy timeout */
                504: {
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
         * @description Default mode is dry-run: the gateway validates and returns its plan without mutating anything. Commit first takes an automatic pre_restore safety snapshot of the target (always a full capture), then applies. Cross-instance restore is allowed and flagged with cross_instance=true.
         *
         *     components limits the restore to the named snapshot domains, which the gateway replaces (it does not merge). Omit it to restore everything the document covers. When present it must name at least one domain; an empty list, a malformed or repeated name, or a domain the document's included_domains does not list is refused with 400 before the gateway is called. Send the same components for the dry-run and for the commit. To undo a selected restore, restore the pre_restore snapshot with the same components.
         *
         *     Reading the answer: 200 means the gateway answered, whatever it said. gateway_status is the gateway's HTTP status and gateway_response its body verbatim, so a refused or rolled-back restore is a 200 here with the refusal inside. For a commit, read gateway_response.result (ok, rolled-back, ROLLBACK-FAILED) and gateway_response.persisted: a restore can be applied and still report persisted=false. Any other status means OAM stopped before or while reaching the gateway. When the gateway sent Retry-After (for example 503 while another restore holds its configuration gate), it is relayed as this response's Retry-After header and as gateway_retry_after.
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
            /** @description mode: dry-run (default) | commit; optional target_instance_id; optional components */
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
                /** @description OAM's gateway service identity is unavailable */
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
    "/oam/v1/appliance/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Appliance capabilities (alpha)
         * @description For each whole-Appliance action, reports three independent facts: whether the host adapter supports it, whether it can run now (and if not, why), and whether the caller's role may request it. A deployment with no host adapter reports every action as unsupported with HOST_NOT_CONFIGURED. Contract appliance-ops/v1alpha1 — subject to change.
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
                        "application/json": components["schemas"]["appliance.Capabilities"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/operations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Appliance operations (alpha)
         * @description Newest first. `items` is always an array. Pass `next_cursor` back as `cursor` for the next page.
         */
        get: {
            parameters: {
                query?: {
                    /** @description Page size, 1-100 (default 20) */
                    limit?: number;
                    /** @description next_cursor of the previous page */
                    cursor?: string;
                    /** @description Only operations in this state */
                    state?: string;
                    /** @description Only operations of this type */
                    type?: string;
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
                        "application/json": components["schemas"]["appliance.OperationList"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Plan an Appliance operation (alpha)
         * @description Validates the request with the host adapter and records the plan. Nothing is executed. Repeating the request with the same Idempotency-Key returns the same operation (200); the same key with a different request is a conflict (409). The caller's role must hold the capability for the operation type. A plan expires 15 minutes after it is made. Contract appliance-ops/v1alpha1 — subject to change.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                    /** @description 16-128 printable ASCII characters, unique per intended operation */
                    "Idempotency-Key": string;
                };
                path?: never;
                cookie?: never;
            };
            /** @description What to plan */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["appliance.PlanRequest"];
                };
            };
            responses: {
                /** @description The operation this key already created */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.Operation"];
                    };
                };
                /** @description Planned */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.Operation"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description The host adapter rejected the request */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description No host adapter in this deployment */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description The host adapter did not answer */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/operations/{operation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read an Appliance operation (alpha)
         * @description Returns one operation. The plan — what it would touch and the artifacts involved — is included only for callers whose role may run that operation type; for others `redacted` is true.
         */
        get: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Operation ID */
                    operation_id: string;
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
                        "application/json": components["schemas"]["appliance.Operation"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/operations/{operation_id}/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Authorize a destructive Appliance operation (alpha)
         * @description Verifies the caller's current password and returns a one-use challenge for submitting this operation. The challenge is bound to the operation, its plan, the installation, the caller and the caller's session; it expires after 5 minutes or with the plan, whichever is sooner, and authorizing again replaces it. The operation moves to AWAITING_AUTHORIZATION and occupies the installation until it is submitted, cancelled or expires. Failed passwords count toward the same lockout as failed logins. Operations that do not require reauthentication (backup) are refused with AUTHORIZATION_NOT_REQUIRED.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Operation ID */
                    operation_id: string;
                };
                cookie?: never;
            };
            /** @description The caller's current password */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["appliance.AuthorizeRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.Challenge"];
                    };
                };
                /** @description Bad Request */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description REAUTHENTICATION_FAILED: wrong password */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description PERMISSION_DENIED, or REAUTHENTICATION_REQUIRED for a session that predates session identifiers */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description OPERATION_CONFLICT, OPERATION_STATE_INVALID or AUTHORIZATION_NOT_REQUIRED */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description PLAN_EXPIRED */
                410: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description TOO_MANY_ATTEMPTS */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/operations/{operation_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an Appliance operation (alpha)
         * @description Before submission cancelling always succeeds. After, the host adapter decides: it refuses once the operation has passed its irreversible phase (`cancellable` false). Cancelling a cancelled operation returns it unchanged.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Operation ID */
                    operation_id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.Operation"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description OPERATION_NOT_CANCELLABLE or OPERATION_STATE_INVALID */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description The host adapter did not answer */
                502: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/operations/{operation_id}/reconcile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Re-read an Appliance operation from the host adapter (alpha)
         * @description OAM follows submitted operations on its own; this asks it to read the host adapter's journal for one operation now and returns the result. It never causes anything to be executed twice. If the adapter does not answer, the operation is returned as last known with `stale` true.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Operation ID */
                    operation_id: string;
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
                        "application/json": components["schemas"]["appliance.Operation"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/operations/{operation_id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit an Appliance operation for execution (alpha)
         * @description Hands a planned operation to the host adapter. `plan_hash` must be the plan the caller reviewed. An operation that requires reauthentication must have been authorized and must present its challenge, which is consumed. Only one operation can be active per installation. The answer is 202 with the operation as it stands; follow it with GET. Submitting an operation that was already submitted returns it unchanged. If the host adapter could not be reached the operation stays QUEUED with `stale` true and OAM delivers it when the adapter answers; it is never executed twice.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    /** @description Bearer token */
                    Authorization: string;
                };
                path: {
                    /** @description Operation ID */
                    operation_id: string;
                };
                cookie?: never;
            };
            /** @description The plan being submitted and, when required, its challenge */
            requestBody: {
                content: {
                    "application/json": components["schemas"]["appliance.SubmitRequest"];
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.Operation"];
                    };
                };
                /** @description INVALID_REQUEST or CHALLENGE_REQUIRED */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description PERMISSION_DENIED, CHALLENGE_MISMATCH or REAUTHENTICATION_REQUIRED */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Not Found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description OPERATION_CONFLICT, OPERATION_STATE_INVALID, PLAN_STALE or CHALLENGE_CONSUMED */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description PLAN_EXPIRED or CHALLENGE_EXPIRED */
                410: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
    "/oam/v1/appliance/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Appliance status (alpha)
         * @description Product identity (from the host adapter, when there is one), each component's version with separately observed liveness and readiness, and OAM's database schema version. A component that could not be observed is "unknown" and stale, never ready. Contract appliance-ops/v1alpha1 — subject to change.
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
                        "application/json": components["schemas"]["appliance.Status"];
                    };
                };
                /** @description Unauthorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
                    };
                };
                /** @description Forbidden */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["appliance.ErrorBody"];
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        "appliance.Action": "backup" | "restore" | "update" | "rollback" | "reset" | "diagnostics";
        "appliance.ActionCapability": {
            action?: components["schemas"]["appliance.Action"];
            /** @description Available: it can be executed now. */
            available?: boolean;
            /** @description Permitted: the caller's role may request it. Independent of the above. */
            permitted?: boolean;
            /** @description RequiresReauthentication: executing it needs a fresh password check. */
            requires_reauthentication?: boolean;
            /**
             * @description Supported: the host adapter implements the action in a contract
             *     version OAM speaks.
             */
            supported?: boolean;
            /** @description UnavailableReason is set exactly when Available is false. */
            unavailable_reason?: components["schemas"]["appliance.UnavailableReason"];
        };
        "appliance.AuthorizeRequest": {
            /**
             * @description Password is the caller's current password. It is verified and
             *     discarded; it is never stored or logged.
             */
            password?: string;
        };
        "appliance.Capabilities": {
            actions?: components["schemas"]["appliance.ActionCapability"][];
            host_configured?: boolean;
            host_contract_versions?: string[];
            /**
             * @description HostFixture is true when the host adapter declares itself a test
             *     fixture. Nothing a fixture reports describes a real installation.
             */
            host_fixture?: boolean;
            observed_at?: string;
            schema_version?: string;
        };
        "appliance.Challenge": {
            challenge?: string;
            expires_at?: string;
            operation_id?: string;
            plan_hash?: string;
        };
        "appliance.Component": {
            digest?: string;
            liveness?: string;
            name?: string;
            observed_at?: string;
            readiness?: string;
            /** @description Stale: the observation could not be refreshed for this response. */
            stale?: boolean;
            version?: string;
        };
        "appliance.DatabaseStatus": {
            adopted?: boolean;
            applied_at?: string;
            latest_migration?: string;
            /**
             * @description SchemaVersion is 0 when the schema is not tracked (OAM_DB_MIGRATE=off
             *     on a database that was never migrated by the server).
             */
            schema_version?: number;
        };
        "appliance.ErrorBody": {
            code?: string;
            error?: string;
            operation_id?: string;
            origin?: string;
            recovery?: components["schemas"]["appliance.Recovery"];
            request_id?: string;
        };
        "appliance.Operation": {
            actor?: string;
            /**
             * @description Cancellable: a cancel request would be accepted now. Decided by OAM
             *     before submission and by the host adapter after.
             */
            cancellable?: boolean;
            created_at?: string;
            error_code?: string;
            error_origin?: string;
            finished_at?: string;
            /**
             * @description HostFixture: the plan came from a fixture host adapter and describes
             *     nothing real.
             */
            host_fixture?: boolean;
            /**
             * @description HostGeneration is the host journal generation this operation reflects;
             *     0 until the host has reported on it.
             */
            host_generation?: number;
            id?: string;
            installation_id?: string;
            model?: string;
            note?: string;
            phase?: string;
            plan?: components["schemas"]["appliance.Plan"];
            plan_expires_at?: string;
            /**
             * @description PlanHash and Plan are present only for callers permitted to run this
             *     type of operation; Redacted is true when they were withheld.
             */
            plan_hash?: string;
            reconciliation?: string;
            redacted?: boolean;
            request_id?: string;
            requires_reauthentication?: boolean;
            schema_version?: string;
            /**
             * @description Stale: the host could not be read at the last attempt, so State may be
             *     out of date.
             */
            stale?: boolean;
            state?: components["schemas"]["appliance.OperationState"];
            submitted_at?: string;
            type?: components["schemas"]["appliance.OperationType"];
            updated_at?: string;
        };
        "appliance.OperationList": {
            items?: components["schemas"]["appliance.Operation"][];
            /**
             * @description NextCursor is passed back as `cursor` for the next page; absent on the
             *     last one.
             */
            next_cursor?: string;
            schema_version?: string;
        };
        /** @enum {string} */
        "appliance.OperationState": "PLANNED" | "AWAITING_AUTHORIZATION" | "QUEUED" | "RUNNING" | "VERIFYING" | "SUCCEEDED" | "FAILED" | "COMPENSATING" | "ROLLED_BACK" | "RECOVERY_REQUIRED" | "CANCELLED";
        /** @enum {string} */
        "appliance.OperationType": "backup" | "restore" | "update" | "rollback" | "reset";
        "appliance.Plan": {
            affected_resources?: string[];
            archive_digest?: string;
            compatibility?: string;
            current_release_digest?: string;
            /** @description IrreversibleAfterPhase is the phase after which cancellation is refused. */
            irreversible_after_phase?: string;
            target_release_digest?: string;
        };
        "appliance.PlanRequest": {
            /**
             * @description ArchiveRef names a backup archive the host has admitted. Required for
             *     restore, refused otherwise.
             */
            archive_ref?: string;
            /** @description Note is free text for the audit trail. */
            note?: string;
            schema_version?: string;
            /**
             * @description TargetReleaseRef names a release the host has admitted. Required for
             *     update, refused otherwise.
             */
            target_release_ref?: string;
            type?: components["schemas"]["appliance.OperationType"];
        };
        "appliance.Product": {
            fixture?: boolean;
            installation_id?: string;
            model?: string;
            release_digest?: string;
            release_version?: string;
        };
        "appliance.Recovery": {
            action?: string;
            /** @description OperationID names the operation to wait for, with WAIT_FOR_OPERATION. */
            operation_id?: string;
        };
        "appliance.Status": {
            components?: components["schemas"]["appliance.Component"][];
            database?: components["schemas"]["appliance.DatabaseStatus"];
            product?: components["schemas"]["appliance.Product"];
            schema_version?: string;
        };
        "appliance.SubmitRequest": {
            /**
             * @description Challenge is the value Authorize returned. Required for an operation
             *     that requires reauthentication, ignored otherwise.
             */
            challenge?: string;
            /** @description PlanHash is the plan the caller reviewed. */
            plan_hash?: string;
        };
        /** @enum {string} */
        "appliance.UnavailableReason": "HOST_NOT_CONFIGURED" | "HOST_UNREACHABLE" | "HOST_UNSUPPORTED" | "SCHEMA_MISMATCH" | "OPERATION_IN_PROGRESS" | "RECOVERY_REQUIRED";
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
            gateway_auth_mode?: string;
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
             * @description LastRestoreComponents is the domain selection of the most recent
             *     restore attempt; absent when it restored the whole document. Like the
             *     response, only populated on the single-snapshot GET.
             */
            last_restore_components?: string[];
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
            /** @description the selection sent to the gateway; absent = whole document */
            components?: string[];
            cross_instance?: boolean;
            gateway_response?: Record<string, never>;
            /**
             * @description GatewayRetryAfter is the gateway's Retry-After header, when it sent
             *     one; the handler relays it as the response's own Retry-After.
             */
            gateway_retry_after?: string;
            gateway_status?: number;
            /** @description restore target */
            instance_id?: number;
            mode?: string;
            pre_restore_snapshot_id?: string;
            snapshot_id?: string;
        };
        "models.RestoreSnapshotRequest": {
            /**
             * @description Components limits the restore to the named snapshot domains (for
             *     example ["auditsink"]). The gateway wipes and applies those domains
             *     only; it replaces their state, it does not merge. Absent restores
             *     everything the document covers. When present it must name at least
             *     one domain: an empty list is refused, never read as "everything".
             */
            components?: string[];
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
            /** @description "admin", "operator" or "viewer" */
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
