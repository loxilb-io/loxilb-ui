/**
 * Generated from api-spec/gateway-swagger.yml by scripts/gen-api-types.mjs — DO NOT EDIT.
 * Regenerate with: npm run gen:api
 */


export interface paths {
  "/config/import": {
    /** Import configurations */
    post: {
      requestBody?: {
        content: {
          "multipart/form-data": {
            /**
             * Format: binary
             * @description The configuration file to upload.
             */
            configuration?: string;
          };
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
      };
    };
  };
  "/config/export": {
    /**
     * Export all configurations
     * @description Export cluster, endpoint, firewall, loadbalancer, mirror, and policy configurations as a JSON file.
     */
    get: {
      parameters: {
        query?: {
          /** @description Comma-separated list of components to export (cluster, endpoint, firewall, loadbalancer, mirror, policy). If not specified, all components are exported. */
          components?: string;
        };
      };
      responses: {
        /** @description Configuration JSON file download */
        200: {
          content: {
            "application/json": string;
          };
        };
        /** @description Invalid parameters */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/meta": {
    /**
     * Get metadata for all POST APIs
     * @description Returns metadata about required fields for each POST API.
     */
    get: operations["getMeta"];
  };
  "/auth/login": {
    /**
     * User login
     * @description Authenticates a user and returns a JWT token if the credentials are valid.
     */
    post: {
      /** @description User credentials */
      requestBody: {
        content: {
          "application/json": components["schemas"]["User"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["LoginResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/auth/logout": {
    /**
     * User logout
     * @description Invalidates the user's token and logs them out.
     */
    post: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["MessageResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/auth/users": {
    /**
     * Fetch all users
     * @description Retrieves all users from the database and returns them as a JSON response.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["User"][];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Create a new user
     * @description Creates a new user in the system
     */
    post: {
      requestBody: components["requestBodies"]["User"];
      responses: {
        /** @description Created */
        201: {
          content: {
            "application/json": components["schemas"]["User"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/auth/users/{id}": {
    /**
     * Update user
     * @description Updates an existing user with the provided JSON payload
     */
    put: {
      parameters: {
        path: {
          /** @description User ID */
          id: number;
        };
      };
      requestBody: components["requestBodies"]["User"];
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["User"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
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
        path: {
          /** @description User ID */
          id: number;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["MessageResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/auth/token/upgrade": {
    /**
     * Upgrade token
     * @description Using manual token, It need to upgrade the token.
     */
    post: {
      /** @description license as a token */
      requestBody: {
        content: {
          "application/json": components["schemas"]["UpdateLicenseRequest"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["UpdateLicenseRequest"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Unauthorized */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/loadbalancer": {
    /**
     * Create a new Load balancer service
     * @description Create a new load balancer service with .
     */
    post: {
      /** @description Attributes for load balance service */
      requestBody: {
        content: {
          "application/json": components["schemas"]["LoadbalanceEntry"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/loadbalancer/all": {
    /**
     * Get all of the load balancer services
     * @description Get all of the load balancer services with conntrack infomation.
     */
    get: {
      parameters: {
        query?: {
          /** @description Octavia tenant/project identifier filter. When supplied, only load-balancer services whose serviceArguments.projectId matches are returned. This is a CONVENIENCE filter, NOT a tenant-isolation/authz boundary: an unfiltered GET still returns rules with any projectId. */
          projectId?: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              lbAttr?: components["schemas"]["LoadbalanceEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete all Load balancer services
     * @description Delete all load balancer services.
     */
    delete: {
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/loadbalancer/name/{lb_name}": {
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service with name.
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes for load balance service name */
          lb_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}": {
    /**
     * Get a Load balancer service by composite key
     * @description Returns a single load balancer rule identified by its VIP/port/protocol composite key (Octavia).
     */
    get: operations["getConfigLoadbalancerExternalipaddressIPAddressPortPortProtocolProto"];
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service with .
     */
    delete: {
      parameters: {
        query?: {
          /** @description option for BGP enable */
          bgp?: boolean;
          /** @description block value if any */
          block?: number;
        };
        path: {
          /** @description Attributes for load balance service */
          ip_address: string;
          /** @description Attributes for load balance service */
          port: number;
          /** @description Attributes for load balance service */
          proto: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Patch an existing Load balancer service (RFC 7386 JSON merge-patch)
     * @description Apply an RFC 7386 JSON merge-patch to an existing load balancer rule identified by its VIP/port/protocol composite key (Octavia). Fields present in the body are overwritten, absent fields are left untouched, and an explicit null clears a clearable field. Immutable fields (security, egress, mode, protocol, VIP composite key) are rejected with 400. Returns 200 if the target rule exists, 404 if it is absent. The rule is mutated in place; established connections are not dropped.
     */
    patch: operations["patchConfigLoadbalancerExternalipaddressIPAddressPortPortProtocolProto"];
  };
  "/config/loadbalancer/id/{id}": {
    /**
     * Get a Load balancer service by opaque id
     * @description Returns a single load balancer rule identified by its stable opaque id (Octavia).
     */
    get: operations["getConfigLoadbalancerID"];
  };
  "/config/l7policy": {
    /** Get all L7 content-routing policies */
    get: operations["getConfigL7PolicyAll"];
    /**
     * Create an L7 content-routing policy
     * @description Creates a dedicated L7_POLICY resource (policy + ordered child rules) and attaches it to an existing L4 load-balancer referenced by its stable opaque id. The body is validated server-side with Octavia per-type rules (FILE_TYPE only EQUAL_TO/REGEX; key required for HEADER/COOKIE/QUERY; redirect statusCode allow-list default 302; REJECT default 403; REGEX patterns try-compiled at config time) and translated to the internal route IR, then carried to the running sockproxy by a SEPARATE attach call (proxy_attach_l7_policy) — NEVER inline on the 4096-byte proxy_arg.
     */
    post: operations["postConfigL7Policy"];
  };
  "/config/l7policy/id/{id}": {
    /** Get a single L7 content-routing policy by id */
    get: operations["getConfigL7PolicyID"];
    /**
     * Delete an L7 content-routing policy by id
     * @description Detaches the policy from its load-balancer (proxy_detach_l7_policy regfrees every compiled REGEX) and removes the resource.
     */
    delete: operations["deleteConfigL7PolicyID"];
  };
  "/config/cert": {
    /**
     * Upload a TLS certificate under an opaque certId
     * @description Uploads inline PEM material (cert + key [+ chain]) under an opaque certId — the canonical TLS-material store. The handler persists the PEM to the managed dir (/etc/loxilb/certs/<certId>/, 0700 dir / 0600 key) and registers it via the C certId registry, which auto-derives the hostname(s) from the leaf cert SAN/CN and registers them into the hostname-keyed SNI store. Selection at handshake stays by hostname; certId is the upload/rotate/delete handle. When certId is absent the server mints one. Malformed PEM / missing key is rejected with 400 (never a panic).
     */
    post: operations["postConfigCert"];
  };
  "/config/cert/{certId}": {
    /**
     * Get a certId's metadata
     * @description Returns the certId metadata (id + auto-derived hostnames + public cert/chain). The private key is never returned.
     */
    get: operations["getConfigCertCertId"];
    /**
     * Rotate the material under a stable certId
     * @description Atomic zero-downtime rotation — re-persists the new PEM under the SAME certId and swaps the cert object into the SNI store under lock; in-flight connections keep the old SSL until they close. Unknown certId returns 404; malformed material returns 400.
     */
    put: operations["putConfigCertCertId"];
    /**
     * Delete a certId
     * @description Removes the managed-dir material and unregisters the derived hostnames from the SNI store.
     */
    delete: operations["deleteConfigCertCertId"];
  };
  "/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}/status": {
    /**
     * Get the lifecycle status of a Load balancer service
     * @description Returns the per-LB lifecycle status (adminStateUp, operatingStatus, lastUpdated) for the rule identified by its composite key (Octavia).
     */
    get: operations["getConfigLoadbalancerStatus"];
  };
  "/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}/stats": {
    /**
     * Get per-service statistics of a Load balancer service
     * @description Returns the per-LB statistics quad (activeConnections, bytesIn, bytesOut, totalConnections) for the rule identified by its composite key (Octavia). activeConnections is the same selector-agnostic live concurrent-connection count the connectionLimit gate enforces; bytesIn/bytesOut are the real per-direction CT byte totals; totalConnections is a monotonic cumulative counter reset to zero on restart.
     */
    get: operations["getConfigLoadbalancerStats"];
  };
  "/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/portmax/{portmax}/protocol/{proto}": {
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service with .
     */
    delete: {
      parameters: {
        query?: {
          /** @description option for BGP enable */
          bgp?: boolean;
          /** @description block value if any */
          block?: number;
        };
        path: {
          /** @description Attributes for load balance service */
          ip_address: string;
          /** @description Attributes for load balance service */
          port: number;
          /** @description Attributes for load balance service */
          portmax: number;
          /** @description Attributes for load balance service */
          proto: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/loadbalancer/hosturl/{hosturl}/externalipaddress/{ip_address}/port/{port}/portmax/{portmax}/protocol/{proto}": {
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service with .
     */
    delete: {
      parameters: {
        query?: {
          /** @description option for BGP enable */
          bgp?: boolean;
          /** @description block value if any */
          block?: number;
          /** @description URL path prefix to match for deletion (allows selective deletion of path-based rules) */
          path_prefix?: string;
          /** @description Path matching mode (disabled, prefix, exact) for selective deletion */
          path_match_mode?: string;
        };
        path: {
          /** @description Attributes for load balance service */
          hosturl: string;
          /** @description Attributes for load balance service */
          ip_address: string;
          /** @description Attributes for load balance service */
          port: number;
          /** @description Attributes for load balance service */
          portmax: number;
          /** @description Attributes for load balance service */
          proto: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/loadbalancer/hosturl/{hosturl}/externalipaddress/{ip_address}/port/{port}/protocol/{proto}": {
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service with .
     */
    delete: {
      parameters: {
        query?: {
          /** @description option for BGP enable */
          bgp?: boolean;
          /** @description block value if any */
          block?: number;
          /** @description URL path prefix to match for deletion (allows selective deletion of path-based rules) */
          path_prefix?: string;
          /** @description Path matching mode (disabled, prefix, exact) for selective deletion */
          path_match_mode?: string;
        };
        path: {
          /** @description Attributes for load balance service */
          hosturl: string;
          /** @description Attributes for load balance service */
          ip_address: string;
          /** @description Attributes for load balance service */
          port: number;
          /** @description Attributes for load balance service */
          proto: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/sni/certificates": {
    /**
     * List all global SNI certificates
     * @description Get all SNI certificates in the global certificate store (shared by all proxies)
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              certificates?: {
                  /** @description Hostname (e.g., api.example.com) */
                  hostname?: string;
                  /** @description Certificate directory path */
                  certPath?: string;
                  /** @description Number of proxies using this certificate */
                  refCount?: number;
                }[];
              /** @description Total number of registered certificates */
              totalCertificates?: number;
            };
          };
        };
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
    /**
     * Register SNI certificate globally (shared by all proxies)
     * @description Register an SNI certificate in the global certificate store. Multiple loadbalancer rules can share the same certificate by hostname. The certificate is stored independently and looked up during TLS handshake based on SNI.
     */
    post: {
      /** @description SNI certificate registration parameters */
      requestBody: {
        content: {
          "application/json": components["schemas"]["SNICertificateEntry"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["SuccessResponse"];
          };
        };
        /** @description Bad Request - Certificate load failed or invalid parameters */
        400: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        /** @description Conflict - Certificate already registered for this hostname */
        409: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
    /**
     * Unregister SNI certificate globally
     * @description Remove SNI certificate from global store
     */
    delete: {
      /** @description SNI certificate removal parameters */
      requestBody: {
        content: {
          "application/json": {
            /** @description Hostname to unregister (e.g., api.example.com) */
            hostname: string;
          };
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["SuccessResponse"];
          };
        };
        /** @description Certificate not found */
        404: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
      };
    };
  };
  "/config/trace/enable": {
    /**
     * Enable HTTP/HTTPS protocol tracing
     * @description Enables distributed tracing for all HTTP/HTTPS traffic passing through loxilb proxy. Events are emitted to ring buffers for export to Jaeger/OpenTelemetry.
     */
    post: operations["PostConfigTraceEnable"];
  };
  "/config/trace/disable": {
    /**
     * Disable HTTP/HTTPS protocol tracing
     * @description Disables distributed tracing and stops emitting events to ring buffers.
     */
    post: operations["PostConfigTraceDisable"];
  };
  "/config/trace/status": {
    /**
     * Get HTTP/HTTPS tracing status
     * @description Returns current tracing status, ring buffer statistics, and OTLP endpoint configuration.
     */
    get: operations["GetConfigTraceStatus"];
  };
  "/config/trace/otlp": {
    /**
     * Get OTLP endpoint configuration (with security settings)
     * @description Returns current OTLP endpoint address, protocol, TLS settings, and connection status.
     */
    get: operations["GetConfigTraceOtlp"];
    /**
     * Configure OTLP endpoint for trace export (with TLS security)
     * @description Sets the OpenTelemetry Protocol (OTLP) endpoint address and protocol for exporting distributed traces to Jaeger/Tempo/etc.
     *
     * **Security Features:**
     * - TLS encryption enabled by default (use_tls: true)
     * - TLS certificate verification (tls_skip_verify: false)
     * - Optional authentication headers (API keys, bearer tokens)
     * - Endpoint validation (host:port format, DNS resolution)
     *
     * **Production Recommendations:**
     * - Always use TLS (use_tls: true) to encrypt trace data
     * - Never skip TLS verification (tls_skip_verify: false) in production
     * - Use authentication headers for secured endpoints
     * - Validate endpoint connectivity before deploying
     */
    post: operations["PostConfigTraceOtlp"];
  };
  "/config/trace/catalogs": {
    /**
     * List all loaded trace catalogs
     * @description Returns a list of all tracing catalog templates loaded from YAML files.
     * Catalogs define parser assignments, sampling rates, and tracing behavior for different services.
     *
     * **Catalog Sources:**
     * - Builtin catalogs: /opt/loxilb/trace-catalogs/
     * - User overrides: /etc/loxilb/trace-catalogs/
     *
     * **Response includes:**
     * - Catalog name (from YAML filename)
     * - Parser assignment (parser_type from YAML)
     * - Sample rate (percentage of requests traced)
     * - Enabled status
     * - Version and description
     */
    get: operations["getTraceCatalogs"];
  };
  "/config/trace/parsers": {
    /**
     * List all available trace parsers
     * @description Returns a list of all protocol parsers registered in the tracing system.
     * Parsers analyze HTTP/HTTPS request/response bodies to extract protocol-specific attributes.
     *
     * **Available Parsers:**
     * - **openai**: OpenAI API (GPT models, tokens, streaming)
     * - **mcp**: Model Context Protocol (JSON-RPC tools, prompts, resources)
     * - **mock**: Simple JSON parser for testing
     *
     * Use this endpoint to discover which parsers are available before assigning them to catalogs.
     */
    get: operations["getTraceParsers"];
  };
  "/config/trace/catalog/{catalog_id}/parser": {
    /**
     * Get parser assignment for a catalog
     * @description Returns the parser currently assigned to a specific trace catalog.
     * Shows catalog name, parser name, and parser_type from YAML configuration.
     */
    get: operations["getCatalogParser"];
    /**
     * Update parser assignment for a catalog
     * @description Dynamically changes which parser is used for a specific catalog at runtime.
     * This allows switching parsers without restarting loxilb or reloading YAML files.
     *
     * **Use Cases:**
     * - Switch from mock to production parser after testing
     * - Change parser when service protocol changes
     * - A/B testing different parser implementations
     *
     * **Parser Selection Priority:**
     * 1. Catalog ID → parser mapping (set by this endpoint or YAML)
     * 2. URL path prefix matching (e.g., /v1/chat/completions → openai)
     * 3. Default mock parser
     */
    put: operations["updateCatalogParser"];
    /**
     * Remove parser assignment for a catalog
     * @description Removes the catalog → parser mapping, causing the system to fall back to:
     * 1. URL path-based routing (e.g., /v1/chat/completions → openai)
     * 2. Default mock parser
     *
     * Use this to revert to path-based parser selection or remove custom assignments.
     */
    delete: operations["deleteCatalogParser"];
  };
  "/config/l4trace/enable": {
    /**
     * Enable L4 connection tracing
     * @description Enables distributed tracing for all TCP/SCTP connections passing through loxilb.
     * Events are emitted to eBPF ring buffers for export to OpenTelemetry collectors.
     *
     * **Features:**
     * - Per-connection spans with full lifecycle tracking
     * - Connection state machine visualization
     * - RTT, retransmission, and throughput metrics
     * - Configurable sampling rate (0-100%)
     */
    post: operations["PostConfigL4traceEnable"];
  };
  "/config/l4trace/disable": {
    /**
     * Disable L4 connection tracing
     * @description Disables L4 connection tracing and stops emitting events to ring buffers.
     * In-flight connections will complete their spans before export stops.
     */
    post: operations["PostConfigL4traceDisable"];
  };
  "/config/l4trace/status": {
    /**
     * Get L4 tracing status and statistics
     * @description Returns current L4 tracing configuration, connection statistics, and event counters.
     *
     * **Statistics include:**
     * - Total events emitted (TCP + SCTP state changes)
     * - Connection lifecycle counters (new, established, closed, timeout, reset, error)
     * - Protocol breakdown (TCP vs SCTP events)
     * - Ring buffer health (dropped events)
     */
    get: operations["GetConfigL4traceStatus"];
  };
  "/config/l4trace/sampling": {
    /**
     * Update L4 tracing sampling rate
     * @description Changes the L4 tracing sampling rate without disabling tracing.
     * New connections will use the updated rate immediately.
     *
     * **Sampling behavior:**
     * - 0%: Effectively disables tracing (use /disable endpoint instead)
     * - 1-99%: Hash-based deterministic sampling (same connection always gets same decision)
     * - 100%: Trace all connections (production debugging)
     */
    put: operations["PutConfigL4traceSampling"];
  };
  "/config/l4trace/stats/reset": {
    /**
     * Reset L4 tracing statistics
     * @description Resets all L4 tracing statistics counters to zero.
     * Does not affect current tracing configuration (enabled/disabled state).
     * Useful for baseline measurements and performance testing.
     */
    post: operations["PostConfigL4traceStatsReset"];
  };
  "/config/conntrack/all": {
    /**
     * Get all of the conntrack entries.
     * @description Get all of the conntrack infomation for all of the service.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ctAttr?: components["schemas"]["ConntrackEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/port/all": {
    /**
     * Get all of the port interfaces
     * @description Get all of the port interfaces.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              portAttr?: components["schemas"]["PortEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/route/all": {
    /**
     * Get all route table
     * @description Get all route table
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              routeAttr?: components["schemas"]["RouteGetEntry"][];
            };
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/route": {
    /**
     * Create a new route config
     * @description Create a new route config .
     */
    post: {
      /** @description Attributes for load balance service */
      requestBody: {
        content: {
          "application/json": components["schemas"]["RouteEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/route/destinationIPNet/{ip_address}/{mask}": {
    /**
     * Create a new Load balancer service
     * @description Create a new load balancer service with .
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes for destinaion route address */
          ip_address: string;
          /** @description Attributes for destination route */
          mask: number;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/session/all": {
    /**
     * Get all of the port interfaces
     * @description Get all of the port interfaces.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              sessionAttr?: components["schemas"]["SessionEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/session": {
    /**
     * Create a new session config
     * @description Create a new session config for 5G.
     */
    post: {
      /** @description Attributes for 5G service session */
      requestBody: {
        content: {
          "application/json": components["schemas"]["SessionEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/session/ident/{ident}": {
    /**
     * Create a new Load balancer service
     * @description Create a new load balancer service with .
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes 5G session Ident. */
          ident: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/sessionulcl/all": {
    /**
     * Get
     * @description Get
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ulclAttr?: components["schemas"]["SessionUlClEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/sessionulcl": {
    /**
     * Create a new session config
     * @description Create a new session config for 5G.
     */
    post: {
      /** @description Attributes for 5G service session */
      requestBody: {
        content: {
          "application/json": components["schemas"]["SessionUlClEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/sessionulcl/ident/{ident}/ulclAddress/{ip_address}": {
    /**
     * Create a new Load balancer service
     * @description Create a new load balancer service with .
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes 5G session Ident. */
          ident: string;
          /** @description Attributes for session ulcl address */
          ip_address: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/policy/all": {
    /**
     * Get
     * @description Get
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              polAttr?: components["schemas"]["PolicyEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/policy": {
    /**
     * Create a new Policy QoS config
     * @description Create a new Policy QoS config.
     */
    post: {
      /** @description Attributes for Policy */
      requestBody: {
        content: {
          "application/json": components["schemas"]["PolicyEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/policy/ident/{ident}": {
    /**
     * Delete a Policy QoS service
     * @description Delete a new Create a Policy QoS service.
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes of Policy Ident. */
          ident: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/mirror/all": {
    /**
     * Get
     * @description Get
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              mirrAttr?: components["schemas"]["MirrorGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/mirror": {
    /**
     * Create a new Mirror config
     * @description Create a new Mirror config.
     */
    post: {
      /** @description Attributes for Mirror */
      requestBody: {
        content: {
          "application/json": components["schemas"]["MirrorEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/mirror/ident/{ident}": {
    /**
     * Delete a Mirror service
     * @description Delete a new Create a Mirror service.
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes of Mirror Ident. */
          ident: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipv4address/all": {
    /**
     * Get IPv4 addresses in the device(interface)
     * @description Get IPv4 addresses in the device(interface)
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipAttr?: components["schemas"]["IPv4AddressGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipv4address": {
    /**
     * Assign IPv4 addresses in the device
     * @description Assign IPv4 addresses in the device
     */
    post: {
      /** @description Attributes for IPv4 address */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPv4AddressEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipv4address/{ip_address}/{mask}/dev/{if_name}": {
    /**
     * Delete IPv4 addresses in the device
     * @description Delete IPv4 addresses in the device
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes IPv4 Address in the device */
          ip_address: string;
          /** @description Attributes IPv4 mask in the device */
          mask: string;
          /** @description Attributes of the target device */
          if_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipv6address/all": {
    /**
     * Get IPv6 addresses in the device(interface)
     * @description Get IPv6 addresses in the device(interface)
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipAttr?: components["schemas"]["IPv6AddressGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipv6address": {
    /**
     * Assign IPv6 addresses in the device
     * @description Assign IPv6 addresses in the device
     */
    post: {
      /** @description Attributes for IPv6 address */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPv6AddressEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipv6address/{ip_address}/{mask}/dev/{if_name}": {
    /**
     * Delete IPv6 addresses in the device
     * @description Delete IPv6 addresses in the device
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes IPv6 Address in the device */
          ip_address: string;
          /** @description Attributes IPv6 mask in the device */
          mask: string;
          /** @description Attributes of the target device */
          if_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/neighbor/all": {
    /**
     * Get IPv4 neighbor in the device(interface)
     * @description Get IPv4 neighbor in the device(interface)
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              neighborAttr?: components["schemas"]["NeighborEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/neighbor": {
    /**
     * Assign IPv4 neighbor in the device
     * @description Assign IPv4 neighbor in the device
     */
    post: {
      /** @description Attributes for IPv4 address */
      requestBody: {
        content: {
          "application/json": components["schemas"]["NeighborEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/neighbor/{ip_address}/dev/{if_name}": {
    /**
     * Delete IPv4 neighbor in the device
     * @description Delete IPv4 neighbor in the device
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes IPv4 Address in the device */
          ip_address: string;
          /** @description Attributes of the target device */
          if_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/fdb/all": {
    /**
     * Get FDB in the device(interface)
     * @description Get FDB in the device(interface).
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              fdbAttr?: components["schemas"]["FDBEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/fdb": {
    /**
     * Assign FDB in the device
     * @description Assign FDB in the device
     */
    post: {
      /** @description Attributes for IPv4 address */
      requestBody: {
        content: {
          "application/json": components["schemas"]["FDBEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/fdb/{mac_address}/dev/{if_name}": {
    /**
     * Delete FDB in the device
     * @description Delete FDB in the device
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes IPv4 Address in the device */
          mac_address: string;
          /** @description Attributes of the target device */
          if_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/vlan/all": {
    /**
     * Get vlan in the device
     * @description Get vlan in the device
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              vlanAttr?: components["schemas"]["VlanGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/vlan": {
    /**
     * Create vlan interface in the device
     * @description Create vlan interface in the device
     */
    post: {
      /** @description Attributes for Vlan Interface */
      requestBody: {
        content: {
          "application/json": components["schemas"]["VlanBridgeEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/vlan/{vlan_id}": {
    /**
     * Delete vlan in the device
     * @description Delete vlan in the device
     */
    delete: {
      parameters: {
        path: {
          /** @description Attributes IPv4 Address in the device */
          vlan_id: number;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/vlan/{vlan_id}/member": {
    /**
     * Add a physical port to a vlan interface
     * @description Add a member to interface Vlan{vlan_id}. If the vlan interface does not exist on LoxiLB it returns a '404' error. If such a member is already present on this Vlan interface the API returns '409' sub-code 0. If the vlan_id passed is less than 2 or greater than 4094 the API will respond with error '400'. If attr with tagging mode is provided it will be honored in config, if not, the default tagging mode will be set to 'untagged'. Vlan members may be tagged or untagged, but, the Vlan member port may be untagged in only one Vlan interface, deviations from this will cause the API to return '409' sub-code 0.
     */
    post: {
      parameters: {
        path: {
          /** @description 12 bit vlan_id */
          vlan_id: number;
        };
      };
      /** @description Attributes for Vlan Interface */
      requestBody: {
        content: {
          "application/json": components["schemas"]["VlanMemberEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Vlan interface is not defined */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN member already exists on this VLAN interface OR Vlan member is being added to 2nd Vlan inteface as an untagged member. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/vlan/{vlan_id}/member/{if_name}/tagged/{tagged}": {
    /**
     * Remove a vlan member from a vlan interface
     * @description Remove a vlan member from a vlan interface which is defined by vlan_id. If the Vlan interface does not exist on LoxiLB OR a vlan member 'if_name' is not present on the interface the API will return '404'. If the vlan_id passed is less than 2 or greater than 4094 the API will respond with error '400'.
     */
    delete: {
      parameters: {
        path: {
          /** @description 12 bit vlan_id */
          vlan_id: number;
          /** @description Physical port name */
          if_name: string;
          /** @description Tagged status */
          tagged: boolean;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Vlan interface is not defined/Vlan member is not found on this Vlan interface */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/tunnel/vxlan/all": {
    /**
     * Get a list of vxlan configurations
     * @description Return a list of existing tunnels of a type. If there're no tunnels to return, empty list will be returned.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              vxlanAttr?: components["schemas"]["VxlanEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/tunnel/vxlan": {
    /**
     * Add a one of vxlan configuration
     * @description Return a list of existing tunnels of a type. If there're no tunnels to return, empty list will be returned.
     */
    post: {
      /** @description attributes for vxlan member interface */
      requestBody: {
        content: {
          "application/json": components["schemas"]["VxlanBridgeEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VxLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/tunnel/vxlan/{vxlanID}": {
    /**
     * Delete a one of vxlan configuration
     * @description Return a list of existing tunnels of a type. If there're no tunnels to return, empty list will be returned.
     */
    delete: {
      parameters: {
        path: {
          /** @description vxlan id (24-bit). Allows to remove routes with defined vnid only. Applicable for routes with nexthop_type 'vxlan-tunnel'. Otherwise '400' error will be returned */
          vxlanID: number;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/tunnel/vxlan/{vxlanID}/peer": {
    /**
     * Add a one of vxlan remote(peer) ip address configuration
     * @description Return a list of existing tunnels of a type. If there're no tunnels to return, empty list will be returned.
     */
    post: {
      parameters: {
        path: {
          /** @description vxlan id (24-bit). Allows to remove routes with defined vnid only. Applicable for routes with nexthop_type 'vxlan-tunnel'. Otherwise '400' error will be returned */
          vxlanID: number;
        };
      };
      /** @description attributes for vxlan Peer interface */
      requestBody: {
        content: {
          "application/json": components["schemas"]["VxlanPeerEntry"];
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["VxlanPeerEntry"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/tunnel/vxlan/{vxlanID}/peer/{PeerIP}": {
    /**
     * Remove a one of vxlan remote(peer) ip address configuration
     * @description Return a list of existing tunnels of a type. If there're no tunnels to return, empty list will be returned.
     */
    delete: {
      parameters: {
        path: {
          /** @description vxlan id (24-bit). Allows to remove routes with defined vnid only. Applicable for routes with nexthop_type 'vxlan-tunnel'. Otherwise '400' error will be returned */
          vxlanID: number;
          /** @description attributes for vxlan Peer IP address */
          PeerIP: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["VxlanEntry"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/cistate/all": {
    /**
     * Get Cluster Instance State in the device
     * @description Get Cluster Instance State in the device
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              Attr?: components["schemas"]["CIStatusGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/cistate": {
    /**
     * Informs Current Cluster Instance state in the device
     * @description Informs Current Cluster Instance state in the device
     */
    post: {
      /** @description Attributes for CI State */
      requestBody: {
        content: {
          "application/json": components["schemas"]["CIStatusEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/endpoint/all": {
    /**
     * Get End-Points State in loxilb
     * @description Get End-Points State in loxilb
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              Attr?: components["schemas"]["EndPointGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/endpoint": {
    /**
     * Adds a LB endpoint for monitoring
     * @description Adds a LB endpoint for monitoring
     */
    post: {
      /** @description Attributes of end point */
      requestBody: {
        content: {
          "application/json": components["schemas"]["EndPoint"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/endpointhoststate": {
    /**
     * Sets the state of a host
     * @description Sets the state of a host which can have multiple endpoints
     */
    post: {
      /** @description Attributes of end point */
      requestBody: {
        content: {
          "application/json": components["schemas"]["EndPointHostState"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/endpoint/epipaddress/{ip_address}": {
    /**
     * Delete an LB end-point from monitoring
     * @description Delete an LB end-point from monitoring
     */
    delete: {
      parameters: {
        query?: {
          /** @description Endpoint Identifier */
          name?: string;
          /** @description Probe type */
          probe_type?: string;
          /** @description Probe port */
          probe_port?: number;
        };
        path: {
          /** @description Attributes of end point */
          ip_address: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/firewall/all": {
    /**
     * Get all of the firewall config
     * @description Get all of the firewall configuration.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              fwAttr?: components["schemas"]["FirewallEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/firewall": {
    /**
     * Create a new firewall config
     * @description Create a new firewall config for security.
     */
    post: {
      /** @description Attributes for  firewall sevice */
      requestBody: {
        content: {
          "application/json": components["schemas"]["FirewallEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete of the firewall service
     * @description Delete of the firewall service.
     */
    delete: {
      parameters: {
        query?: {
          /** @description Source IP address */
          sourceIP?: string;
          /** @description Destination IP in CIDR notation */
          destinationIP?: string;
          /** @description Minimum source port range */
          minSourcePort?: number;
          /** @description Maximum source port range */
          maxSourcePort?: number;
          /** @description Minimum destination port range */
          minDestinationPort?: number;
          /** @description Maximum destination port range */
          maxDestinationPort?: number;
          /** @description the protocol */
          protocol?: number;
          /** @description the incoming port */
          portName?: string;
          /** @description User preference for ordering */
          preference?: number;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipfilter/all": {
    /**
     * Get all IP filter rules
     * @description Get all IP whitelist and blacklist rules with statistics.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipFilterAttr?: components["schemas"]["IPFilterEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipfilter": {
    /**
     * Create a new IP filter rule
     * @description Create a new IP whitelist or blacklist rule for DDoS protection.
     */
    post: {
      /** @description Attributes for IP filter rule */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPFilterEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete an IP filter rule
     * @description Delete an IP whitelist or blacklist rule.
     */
    delete: {
      parameters: {
        query: {
          /** @description Filter type (whitelist or blacklist) */
          filterType: string;
          /** @description IP address in CIDR notation */
          cidr: string;
          /** @description Security zone (0 = all zones) */
          zone?: number;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/synflood": {
    /**
     * Enable or configure SYN flood protection
     * @description Enable SYN flood protection with specified thresholds and configuration.
     */
    post: {
      /** @description SYN flood protection configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["SYNFloodConfigMod"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Disable SYN flood protection
     * @description Disable SYN flood protection and clear all tracking state.
     */
    delete: {
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/synflood/all": {
    /**
     * Get SYN flood protection configuration and statistics
     * @description Get current SYN flood protection configuration and statistics.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              synfloodAttr?: components["schemas"]["SYNFloodEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/securityrate": {
    /**
     * Configure unified security rate limiting
     * @description Configure unified SYN flood protection (P0-5) and connection rate limiting (P0-6).
     */
    post: {
      /** @description Unified security rate limiting configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["SecurityRateConfigMod"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Disable unified security rate limiting
     * @description Disable all security rate limiting (SYN flood + connection rate) and clear tracking state.
     */
    delete: {
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/securityrate/all": {
    /**
     * Get unified security rate limiting configuration and statistics
     * @description Get current unified security rate limiting (P0-5 + P0-6 + P0-7) configuration and statistics.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              securityrateAttr?: components["schemas"]["SecurityRateEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/securityrate/reset": {
    /**
     * Reset security rate limiting statistics
     * @description Reset all accumulated statistics counters for security rate limiting (SYN/Conn/UDP) to zero.
     */
    put: {
      responses: {
        /** @description Statistics reset successfully */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/status/process": {
    /**
     * Get a process based on CPU usage info in the device
     * @description Get a process based on high usage CPU(linux command "top") in the device or system.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              processAttr?: components["schemas"]["ProcessInfoEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/status/device": {
    /**
     * Get a basic info in the device
     * @description Get a basic info (linux command "uptime, hostnamectl") in the device or system.
     */
    get: {
      responses: {
        /** @description Device unique informations */
        200: {
          content: {
            "application/json": components["schemas"]["DeviceInfoEntry"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/status/filesystem": {
    /**
     * Get a File System info in the device
     * @description Get a File system infomation (linux command "df") in the device or system.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              filesystemAttr?: components["schemas"]["FileSystemInfoEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/params": {
    /**
     * Get Operational params of LoxiLB
     * @description Get Operational params of LoxiLB
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperParams"];
          };
        };
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Set Operational parameters of LoxiLB
     * @description Set Operational parameters of LoxiLB
     */
    post: {
      /** @description Attributes for setting state */
      requestBody: {
        content: {
          "application/json": components["schemas"]["OperParams"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec": {
    /**
     * Get IPsec configuration
     * @description Get current IPsec global configuration including fast-path and hardware offload settings.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["IPsecConfig"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Update IPsec configuration
     * @description Update IPsec global configuration settings for fast-path, hardware offload, and other parameters.
     */
    post: {
      /** @description IPsec configuration attributes */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPsecConfigMod"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/tunnels/all": {
    /**
     * Get all IPsec tunnels
     * @description Get all configured IPsec tunnels with their current state and statistics.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipsecTunnelAttr?: components["schemas"]["IPsecTunnel"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/tunnels": {
    /**
     * Create an IPsec tunnel
     * @description Create a new IPsec tunnel with strongSwan configuration.
     */
    post: {
      /** @description IPsec tunnel configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPsecTunnelMod"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Tunnel already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/tunnels/{name}": {
    /**
     * Get specific IPsec tunnel
     * @description Get details of a specific IPsec tunnel by name.
     */
    get: {
      parameters: {
        path: {
          /** @description Tunnel name */
          name: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["IPsecTunnel"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Tunnel not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete an IPsec tunnel
     * @description Delete an existing IPsec tunnel and remove associated SAs.
     */
    delete: {
      parameters: {
        path: {
          /** @description Tunnel name */
          name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Tunnel not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/sas/all": {
    /**
     * Get all Security Associations
     * @description Get all active Security Associations (SAs) from kernel XFRM.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipsecSaAttr?: components["schemas"]["IPsecSA"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/stats": {
    /**
     * Get IPsec statistics
     * @description Get aggregated IPsec statistics for all tunnels and SAs.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["IPsecStats"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Reset IPsec statistics
     * @description Reset all IPsec statistics counters to zero.
     */
    delete: {
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/certificates/all": {
    /**
     * Get all certificates
     * @description Get all installed certificates (without private keys).
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipsecCertificateAttr?: components["schemas"]["IPsecCertificate"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/certificates": {
    /**
     * Upload a certificate
     * @description Upload a certificate and private key for IPsec authentication.
     */
    post: {
      /** @description Certificate and private key */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPsecCertificateMod"];
        };
      };
      responses: {
        /** @description Certificate installed */
        201: {
          content: {
            "application/json": components["schemas"]["IPsecCertificate"];
          };
        };
        /** @description Invalid certificate or key */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Certificate already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/certificates/{name}": {
    /**
     * Get certificate details
     * @description Get details of a specific certificate by name.
     */
    get: {
      parameters: {
        path: {
          /** @description Certificate name */
          name: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["IPsecCertificate"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Certificate not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete a certificate
     * @description Delete a certificate and its private key.
     */
    delete: {
      parameters: {
        path: {
          /** @description Certificate name */
          name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Certificate not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Certificate in use by active tunnels */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/certificates/validate": {
    /**
     * Validate certificate
     * @description Validate certificate and private key without installing (dry-run).
     */
    post: {
      /** @description Certificate and key to validate */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPsecCertificateMod"];
        };
      };
      responses: {
        /** @description Validation result */
        200: {
          content: {
            "application/json": components["schemas"]["IPsecCertValidation"];
          };
        };
        /** @description Invalid certificate or key */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/ca-certificates/all": {
    /**
     * Get all CA certificates
     * @description Get all CA certificates from trust store.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              ipsecCACertificateAttr?: components["schemas"]["IPsecCACertificate"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/ca-certificates": {
    /**
     * Upload a CA certificate
     * @description Upload a CA certificate to the trust store.
     */
    post: {
      /** @description CA certificate */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPsecCACertificateMod"];
        };
      };
      responses: {
        /** @description CA certificate installed */
        201: {
          content: {
            "application/json": components["schemas"]["IPsecCACertificate"];
          };
        };
        /** @description Invalid CA certificate */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description CA certificate already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ipsec/ca-certificates/{name}": {
    /**
     * Get CA certificate details
     * @description Get details of a specific CA certificate by name.
     */
    get: {
      parameters: {
        path: {
          /** @description CA certificate name */
          name: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["IPsecCACertificate"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description CA certificate not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete a CA certificate
     * @description Delete a CA certificate from trust store.
     */
    delete: {
      parameters: {
        path: {
          /** @description CA certificate name */
          name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description CA certificate not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description CA certificate in use */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/neigh/all": {
    /**
     * Get the all of BGP Neighbor
     * @description Get the all of BGP Neighbor
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              bgpNeiAttr?: components["schemas"]["BGPNeighGetEntry"][];
            };
          };
        };
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/neigh": {
    /**
     * Adds a BGP Neighbor
     * @description Adds a BGP Neighbor
     */
    post: {
      /** @description Attributes of bgp neighbor */
      requestBody: {
        content: {
          "application/json": components["schemas"]["BGPNeigh"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/neigh/{ip_address}": {
    /**
     * Delete a BGP neighbor
     * @description Delete a BGP Neighbor
     */
    delete: {
      parameters: {
        query?: {
          /** @description Remote ASN number */
          remoteAs?: number;
        };
        path: {
          /** @description Neighbor IP address */
          ip_address: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. Neigh already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/policy/definedsets/{defineset_type}/{type_name}": {
    /**
     * Get the all of BGP definedsets
     * @description Get the all of BGP, prefix/neighbor/community/extcommunity/aspath/largecommunity
     */
    get: {
      parameters: {
        path: {
          /** @description defineset type one of prefix/neighbor/community/extcommunity/aspath/largecommunity */
          defineset_type: string;
          /** @description type name */
          type_name: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              definedsetsAttr?: components["schemas"]["BGPPolicyDefinedSetGetEntry"][];
            };
          };
        };
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. VLAN already exists OR dependency VRF/VNET not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete a BGP definedsets
     * @description Delete a BGP definedsets
     */
    delete: {
      parameters: {
        path: {
          /** @description defineset type one of prefix/neighbor/community/extcommunity/aspath/largecommunity */
          defineset_type: string;
          /** @description type name */
          type_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. Neigh already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/policy/definedsets/{defineset_type}": {
    /**
     * Adds a BGP  definedsets for making Policy
     * @description Adds a BGP definedsets for making Policy
     */
    post: {
      parameters: {
        path: {
          /** @description defineset type one of prefix/neighbor/community/extcommunity/aspath/largecommunity */
          defineset_type: string;
        };
      };
      /** @description Attributes of bgp neighbor */
      requestBody: {
        content: {
          "application/json": components["schemas"]["BGPPolicyDefinedSetsMod"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/policy/definitions/all": {
    /**
     * Get BGP Policy definitions
     * @description Get BGP Policy definitions
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              bgpPolicyAttr?: components["schemas"]["BGPPolicyDefinitionsMod"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/policy/definitions": {
    /**
     * Adds a BGP Policy
     * @description Adds a BGP Policy
     */
    post: {
      /** @description Attributes of bgp neighbor */
      requestBody: {
        content: {
          "application/json": components["schemas"]["BGPPolicyDefinitionsMod"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/policy/definitions/{policy_name}": {
    /**
     * Delete a BGP policy
     * @description Delete a BGP Policy
     */
    delete: {
      parameters: {
        path: {
          /** @description The name of the community */
          policy_name: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. Neigh already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/policy/apply": {
    /**
     * Apply BGP Policy in neighbor
     * @description Apply BGP Policy in neighbor
     */
    post: {
      requestBody: components["requestBodies"]["BGPApplyPolicyToNeighborMod"];
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Delete BGP Policy in neighbor
     * @description Delete BGP Policy in neighbor. It don't need "routeAction" in the attr body
     */
    delete: {
      requestBody: components["requestBodies"]["BGPApplyPolicyToNeighborMod"];
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. Neigh already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bgp/global": {
    /**
     * Adds a BGP global config
     * @description Adds a BGP global config
     */
    post: {
      /** @description Attributes of bgp global config */
      requestBody: {
        content: {
          "application/json": components["schemas"]["BGPGlobalConfig"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics": {
    /** Scrape metrics from the cache */
    get: {
      responses: {
        /** @description Metrics in prometheus text format */
        200: {
          content: {
            "application/json": string;
          };
        };
      };
    };
  };
  "/config/metrics": {
    /** Get prometheus config value */
    get: {
      responses: {
        /** @description prometheus config value */
        200: {
          content: {
            "application/json": components["schemas"]["MetricsConfig"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /** turn on prometheus option */
    post: {
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /** turn off prometheus option */
    delete: {
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/gpu/enable": {
    /**
     * Enable GPU-aware load balancing
     * @description Activates GPU-aware routing mode and starts conversation cleanup thread
     */
    post: {
      responses: {
        /** @description GPU monitoring enabled successfully */
        200: {
          content: {
            "application/json": components["schemas"]["GPUEnableResponse"];
          };
        };
        /** @description GPU monitoring already enabled */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Failed to enable GPU monitoring */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/gpu/disable": {
    /**
     * Disable GPU-aware load balancing
     * @description Deactivates GPU-aware routing and reverts to standard CHWBL
     */
    post: {
      responses: {
        /** @description GPU monitoring disabled successfully */
        200: {
          content: {
            "application/json": components["schemas"]["GPUEnableResponse"];
          };
        };
        /** @description GPU monitoring already disabled */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Failed to disable GPU monitoring */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/gpu/status": {
    /**
     * Get GPU monitoring status
     * @description Returns current GPU monitoring state and statistics
     */
    get: {
      responses: {
        /** @description GPU monitoring status */
        200: {
          content: {
            "application/json": components["schemas"]["GPUMonitoringStatus"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/gpu/conversations/cleanup": {
    /**
     * Manual conversation cleanup
     * @description Removes stale conversation mappings older than specified age
     */
    post: {
      parameters: {
        query?: {
          /** @description Maximum age in hours for conversations to keep (older ones deleted) */
          max_age_hours?: number;
        };
      };
      responses: {
        /** @description Cleanup completed successfully */
        200: {
          content: {
            "application/json": components["schemas"]["ConversationCleanupResponse"];
          };
        };
        /** @description GPU monitoring disabled or invalid parameters */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Cleanup operation failed */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/worker/metrics": {
    /**
     * Get all worker metrics
     * @description Returns current GPU metrics for all tracked workers
     */
    get: {
      responses: {
        /** @description Worker metrics retrieved successfully */
        200: {
          content: {
            "application/json": components["schemas"]["WorkerMetricsResponse"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Update worker GPU metrics
     * @description Receives GPU metrics from metrics agent and updates routing decisions
     */
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["WorkerMetricsEntry"];
        };
      };
      responses: {
        /** @description Metrics updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["WorkerMetricsUpdateResponse"];
          };
        };
        /** @description GPU monitoring disabled or invalid request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Failed to update metrics */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/pii/enable": {
    /**
     * Enable or disable PII detection
     * @description Toggle PII detection on or off for HTTP/HTTPS traffic
     */
    post: {
      /** @description Enable/disable flag */
      requestBody: {
        content: {
          "application/json": {
            /** @description Enable (true) or disable (false) PII detection */
            enabled: boolean;
          };
        };
      };
      responses: {
        /** @description PII detection status updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/pii/configure": {
    /**
     * Configure PII detection settings
     * @description Update PII detection configuration (mode, thresholds, URLs, circuit breaker)
     */
    post: {
      /** @description PII detection configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["PIIConfigEntry"];
        };
      };
      responses: {
        /** @description PII configuration updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/pii/url-patterns": {
    /**
     * Add or update URL patterns for PII scanning
     * @description Configure URL patterns (include/exclude) for selective PII scanning
     */
    post: {
      /** @description URL pattern configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["PIIURLPatternsEntry"];
        };
      };
      responses: {
        /** @description URL patterns updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/pii/status": {
    /**
     * Get current PII detection configuration
     * @description Retrieve current PII detection settings and status
     */
    get: {
      responses: {
        /** @description PII configuration retrieved successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PIIStatusResponse"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/pii/stats": {
    /**
     * Get PII detection statistics
     * @description Retrieve PII detection statistics (scans, detections, blocks, errors)
     */
    get: {
      responses: {
        /** @description PII statistics retrieved successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PIIStatsResponse"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/llamafirewall/enable": {
    /**
     * Enable or disable LlamaFirewall AI security scanning
     * @description Toggle LlamaFirewall security scanning on or off for API traffic
     */
    post: {
      /** @description Enable/disable flag */
      requestBody: {
        content: {
          "application/json": {
            /** @description Enable (true) or disable (false) LlamaFirewall scanning */
            enabled: boolean;
          };
        };
      };
      responses: {
        /** @description LlamaFirewall status updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/llamafirewall/configure": {
    /**
     * Configure LlamaFirewall security scanning settings
     * @description Update LlamaFirewall configuration (server URL, scanners, policy, thresholds)
     */
    post: {
      /** @description LlamaFirewall configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["LlamaFirewallConfigEntry"];
        };
      };
      responses: {
        /** @description LlamaFirewall configuration updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/llamafirewall/scanners": {
    /**
     * Configure individual scanner settings
     * @description Enable/disable specific scanners (PromptGuard, CodeShield, Regex, etc.)
     */
    post: {
      /** @description Scanner configuration */
      requestBody: {
        content: {
          "application/json": components["schemas"]["LlamaFirewallScannersEntry"];
        };
      };
      responses: {
        /** @description Scanner configuration updated successfully */
        200: {
          content: {
            "application/json": components["schemas"]["PostSuccess"];
          };
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/llamafirewall/status": {
    /**
     * Get current LlamaFirewall configuration and status
     * @description Retrieve current LlamaFirewall settings, connection status, and enabled scanners
     */
    get: {
      responses: {
        /** @description LlamaFirewall status retrieved successfully */
        200: {
          content: {
            "application/json": components["schemas"]["LlamaFirewallStatusResponse"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/llamafirewall/stats": {
    /**
     * Get LlamaFirewall security scanning statistics
     * @description Retrieve scanning statistics (scans, blocks, scanner performance, decisions)
     */
    get: {
      responses: {
        /** @description LlamaFirewall statistics retrieved successfully */
        200: {
          content: {
            "application/json": components["schemas"]["LlamaFirewallStatsResponse"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/llamafirewall/health": {
    /**
     * Trigger LlamaFirewall health check
     * @description Check connectivity and health of LlamaFirewall gRPC server
     */
    post: {
      responses: {
        /** @description Health check successful */
        200: {
          content: {
            "application/json": components["schemas"]["LlamaFirewallHealthResponse"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error (health check failed) */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/version": {
    /**
     * Get version information in the device
     * @description Get version information
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["VersionGetEntry"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bfd/all": {
    /**
     * Get BFD session inforrmation in the device
     * @description Get BFD session inforrmation
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": {
              Attr?: components["schemas"]["BfdGetEntry"][];
            };
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bfd": {
    /**
     * Create vlan interface in the device
     * @description Create vlan interface in the device
     */
    post: {
      /** @description Attributes for Vlan Interface */
      requestBody: {
        content: {
          "application/json": components["schemas"]["BfdEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. BFD session not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/bfd/remoteIP/{remote_ip}": {
    /**
     * Delete a BFD session
     * @description Delete a BFD session
     */
    delete: {
      parameters: {
        query?: {
          /** @description Cluster instance name */
          instance?: string;
        };
        path: {
          /** @description Remote IP address */
          remote_ip: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. BFD session already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/flowcount": {
    /**
     * Get flow count metrics
     * @description Get metrics related to flow counts.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["FlowCountMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/hostcount": {
    /**
     * Get host count metrics
     * @description Get metrics related to host counts.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["HostCountMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/lbrulecount": {
    /**
     * Get load balancer rule count metrics
     * @description Get metrics related to load balancer rule counts.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["LbRuleCountMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/newflowcount": {
    /**
     * Get new flow count metrics
     * @description Get metrics related to new flow counts.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["NewFlowCountMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/requestcount": {
    /**
     * Get request count metrics
     * @description Get metrics related to request counts.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["RequestCountMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/errorcount": {
    /**
     * Get error count metrics
     * @description Get metrics related to error counts.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ErrorCountMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/processedtraffic": {
    /**
     * Get processed traffic metrics
     * @description Get metrics related to processed traffic.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ProcessedTrafficMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/lbprocessedtraffic": {
    /**
     * Get load balancer processed traffic metrics
     * @description Get metrics related to load balancer processed traffic.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["LbProcessedTrafficMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/epdisttraffic": {
    /**
     * Get endpoint distribution traffic metrics
     * @description Get metrics related to endpoint distribution traffic per service. The additionalProp is service name.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["EpDistTrafficMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/servicedisttraffic": {
    /**
     * Get service distribution traffic metrics
     * @description Get metrics related to service distribution traffic. The additionalProp is service name.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ServiceDistTrafficMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/fwdrops": {
    /**
     * Get firewall drops metrics
     * @description Get metrics related to firewall drops.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["FwDropsMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/metrics/reqcountperclient": {
    /**
     * Get request count per client metrics
     * @description Get metrics related to request counts per client. The additionalProp is client IP address.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ReqCountPerClientMetrics"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/logs": {
    /**
     * Fetch logs with optional filtering
     * @description Fetch the latest logs from the system with optional filtering by number of lines, log level, or keyword.
     */
    get: {
      parameters: {
        query?: {
          /** @description Number of log lines to fetch (default is 100). */
          lines?: string;
          /** @description Filter logs by level (e.g., INFO, ERROR, DEBUG). */
          level?: string;
          /** @description Filter logs containing a specific keyword or phrase. */
          keyword?: string;
          /** @description Opaque pagination cursor from a previous response's next_cursor; fetches the next page. */
          cursor?: string;
          /** @description Specific log file to read (default is the current log file). */
          file?: string;
        };
      };
      responses: {
        /** @description Logs fetched successfully */
        200: {
          content: {
            "application/json": components["schemas"]["Logs"];
          };
        };
        /** @description Invalid query parameters */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/log-archives": {
    /**
     * List available log archives
     * @description Retrieve a list of all rotated log archive files available for download.
     */
    get: {
      responses: {
        /** @description List of log archive files */
        200: {
          content: {
            "application/json": components["schemas"]["LogArchives"];
          };
        };
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/log-archives/{filename}": {
    /**
     * Download a specific log archive
     * @description Download a log archive file by its name.
     */
    get: {
      parameters: {
        path: {
          /** @description Name of the log archive file to download. */
          filename: string;
        };
      };
      responses: {
        /** @description Log archive file download */
        200: {
          content: {
            "application/octet-stream": string;
          };
        };
        /** @description Missing or invalid filename */
        400: {
          content: {
            "application/octet-stream": components["schemas"]["Error"];
          };
        };
        /** @description File not found */
        404: {
          content: {
            "application/octet-stream": components["schemas"]["Error"];
          };
        };
        /** @description Internal server error */
        500: {
          content: {
            "application/octet-stream": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/nodegraph/all": {
    /**
     * List current topology
     * @description Retrieve a list of all nodes and edges in the current topology.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["NodeGraphShcmea"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/nodegraph/{service}": {
    /**
     * List current topology for a specific service
     * @description Retrieve a list of all nodes and edges in the current topology for a specific service.
     */
    get: {
      parameters: {
        path: {
          /** @description Name of the service to filter the topology by. */
          service: string;
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["NodeGraphShcmea"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/oauth/{provider}": {
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
            "application/json": components["schemas"]["OauthMessageResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["OauthErrorResponse"];
          };
        };
      };
    };
  };
  "/oauth/{provider}/callback": {
    /**
     * OAuth callback
     * @description Handles the OAuth callback flow for the specified provider.
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
            "application/json": components["schemas"]["OauthLoginResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["OauthErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["OauthErrorResponse"];
          };
        };
      };
    };
  };
  "/oauth/{provider}/token": {
    /**
     * OAuth callback
     * @description Handles the OAuth token refresh workflow for the specified provider.
     */
    get: {
      parameters: {
        query: {
          /** @description OAuth access token */
          token: string;
          /** @description OAuth refresh token */
          refreshtoken: string;
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
            "application/json": components["schemas"]["OauthTokenResponse"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["OauthErrorResponse"];
          };
        };
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["OauthErrorResponse"];
          };
        };
      };
    };
  };
  "/config/cors/all": {
    /** Get all related K8s metadata (Pod, Service, Endpoint, Node, Namespace) */
    get: {
      responses: {
        /** @description get cors list */
        200: {
          content: {
            "application/json": {
              corsAttr?: string[];
            };
          };
        };
      };
    };
  };
  "/config/cors": {
    /**
     * Post full K8s metadata set (Pod, Service, Endpoint, Node, Namespace)
     * @description Post full K8s metadata set (Pod, Service, Endpoint, Node, Namespace)
     */
    post: {
      /** @description Attributes for Vlan Interface */
      requestBody: {
        content: {
          "application/json": components["schemas"]["CorsEntry"];
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. BFD session not found */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/cors/{cors_url}": {
    /**
     * Delete a BFD session
     * @description Delete a BFD session
     */
    delete: {
      parameters: {
        path: {
          /** @description cors url ex) http://localhost:3000 */
          cors_url: string;
        };
      };
      responses: {
        /** @description OK */
        204: {
          content: never;
        };
        /** @description Malformed arguments for API call */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Capacity insufficient */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource not found */
        404: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Resource Conflict. BFD session already exists */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Maintenance mode */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/config/ai/apikey": {
    /**
     * List API keys for a tenant
     * @description Returns all API keys belonging to the specified tenant.
     */
    get: operations["getConfigAiApikey"];
    /**
     * Create a new API key
     * @description Creates a new API key for a tenant. The raw key is returned ONLY in this response.
     */
    post: operations["postConfigAiApikey"];
  };
  "/config/ai/apikey/{key_id}": {
    /**
     * Get a specific API key
     * @description Returns the summary of a single API key by its ID.
     */
    get: operations["getConfigAiApikeyKeyID"];
    /**
     * Delete an API key
     * @description Permanently deletes the specified API key.
     */
    delete: operations["deleteConfigAiApikeyKeyID"];
  };
  "/config/ai/tenant/ratelimit": {
    /**
     * Set or update tenant rate limit
     * @description Creates or updates the rate limit configuration for a tenant.
     */
    post: operations["postConfigAiTenantRatelimit"];
  };
  "/config/ai/tenant/ratelimit/{tenant_id}": {
    /**
     * Get tenant rate limit configuration
     * @description Returns the current rate limit configuration for the specified tenant.
     */
    get: operations["getConfigAiTenantRatelimitTenantID"];
  };
  "/config/opa/watcher": {
    /**
     * Get OPA L4 policy watcher status
     * @description Returns current configuration and operational status of the OPA watcher.
     */
    get: operations["getConfigOpaWatcher"];
    /**
     * Configure OPA L4 policy watcher
     * @description Start or reconfigure the OPA L4 policy watcher. Stops any existing watcher before starting a new one.
     */
    post: operations["postConfigOpaWatcher"];
    /**
     * Stop and remove OPA L4 policy watcher
     * @description Stops the running OPA watcher and removes its configuration.
     */
    delete: operations["deleteConfigOpaWatcher"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    Error: {
      /** Format: int32 */
      code?: number;
      /** Format: int32 */
      "sub-code"?: number;
      message?: string;
      fields?: string[];
      details?: string;
      result?: string;
    };
    PostSuccess: {
      code?: number;
      message?: string;
    };
    /** @description Per-LB lifecycle status (Octavia). */
    LoadbalanceStatus: {
      /** @description Octavia admin_state_up — true = enabled, false = paused. */
      adminStateUp?: boolean;
      /**
       * @description Aggregated operating status derived from endpoint health.
       * @enum {string}
       */
      operatingStatus?: "ONLINE" | "OFFLINE" | "DEGRADED" | "ERROR" | "NO_MONITOR";
      /**
       * Format: date-time
       * @description In-memory last-mutation timestamp (RFC3339). Reset-to-now on restart, never persisted.
       */
      lastUpdated?: string;
    };
    /** @description Per-LB statistics quad (Octavia). */
    LoadbalanceStats: {
      /**
       * Format: uint64
       * @description Live concurrent-connection count for the rule — the same selector-agnostic live count the connectionLimit gate enforces. Recomputed from the conntrack walk; reset to zero on restart.
       */
      activeConnections?: number;
      /**
       * Format: uint64
       * @description Real per-direction byte total for the forward CT_DIR_IN (client to VIP request) entries of the rule. NOT a 50/50 heuristic. Reset to zero on restart.
       */
      bytesIn?: number;
      /**
       * Format: uint64
       * @description Real per-direction byte total for the reverse CT_DIR_OUT (VIP to client response) entries of the rule. Reset to zero on restart.
       */
      bytesOut?: number;
      /**
       * Format: uint64
       * @description Monotonic cumulative connection count (incremented on first-seen CT for the rule, never decremented). In-memory only, reset to zero on restart.
       */
      totalConnections?: number;
    };
    /** @description One L7 routing rule: an ordered route with OR-of-AND match sets and a single tagged-union action (FORWARD / REDIRECT / REJECT). The translation-neutral superset of an OpenStack Octavia l7policy+l7rules group AND a Kubernetes Gateway API HTTPRoute rule. Routes are evaluated FIRST-MATCH-WINS in ascending `position`. */
    L7Rule: {
      /** @description Explicit precedence; routes are evaluated in ascending position order. */
      position?: number;
      /** @description OR across sets; AND within a set. Each element is a list of conditions. */
      matchSets?: {
          conditions?: components["schemas"]["L7Condition"][];
        }[];
      action?: components["schemas"]["L7Action"];
      /** @description bounded request-header insertion filter — a tagged op {SET|ADD|REMOVE} + name(+value). A faithful superset of BOTH Octavia insert_headers (SET/ADD) AND Gateway API RequestHeaderModifier (set/add/remove). Optional/additive — omit for no header insertion. Bounded server-side (DoS guard). */
      insertHeaders?: ({
          /** @enum {string} */
          op?: "SET" | "ADD" | "REMOVE";
          name?: string;
          /** @description Header value; ignored for REMOVE. */
          value?: string;
        })[];
      /**
       * @description session-persistence mode for this route. HTTP_COOKIE enables LB-generated Set-Cookie + read-back affinity; omit for off. Mutually exclusive with APP_COOKIE/SOURCE_IP per pool (Octavia semantics). Optional/additive.
       * @enum {string}
       */
      sessionPersistence?: "HTTP_COOKIE";
    };
    /** @description One predicate, AND-combined within a match set. */
    L7Condition: {
      /**
       * @description Request field to match. HOST/PATH/HEADER/COOKIE/FILE_TYPE are the Octavia l7rule types; METHOD/QUERY are Gateway API additions. The SSL_* field range is reserved for is NOT accepted here.
       * @enum {string}
       */
      field: "HOST" | "PATH" | "HEADER" | "COOKIE" | "FILE_TYPE" | "METHOD" | "QUERY";
      /**
       * @description Compare op. FILE_TYPE accepts ONLY EQUAL_TO or REGEX (Octavia constraint — server-side validated, 400 otherwise).
       * @enum {string}
       */
      op: "EQUAL_TO" | "STARTS_WITH" | "SEGMENT_PREFIX" | "ENDS_WITH" | "CONTAINS" | "REGEX";
      /** @description Header/cookie/query NAME. REQUIRED for HEADER, COOKIE, and QUERY (400 if absent). */
      key?: string;
      /** @description Operand the request field is compared against. A REGEX value is try-compiled at config time (400 on a malformed pattern) and recompiled once at attach. */
      value?: string;
      /** @description Negate this condition's result (Octavia invert semantics). NOT representable on Gateway API — a policy carrying invert is a HARD ERROR on Gateway export, never silently dropped. */
      invert?: boolean;
    };
    /** @description The single tagged-union action for a route. */
    L7Action: {
      /**
       * @description FORWARD to a (weighted) pool; REDIRECT (synthetic 3xx); REJECT (synthetic 4xx, terminal). REJECT is NOT representable on Gateway API — a HARD ERROR on export.
       * @enum {string}
       */
      kind: "FORWARD" | "REDIRECT" | "REJECT";
      /** @description FORWARD target (re-enters the existing intra-pool EP-select, never the AI engine). */
      forward?: {
        /** Format: uint32 */
        poolId?: number;
        backendRefs?: {
            /** Format: uint32 */
            ep?: number;
            weight?: number;
          }[];
      };
      /** @description REDIRECT target. statusCode is restricted to {301,302,303,307,308} (default 302). */
      redirect?: {
        scheme?: string;
        host?: string;
        port?: number;
        /** @enum {string} */
        pathOp?: "NONE" | "REPLACE_FULL" | "REPLACE_PREFIX";
        value?: string;
        /** @description One of 301/302/303/307/308; 0 or absent defaults to 302 (server-side allow-list, 400 otherwise). */
        statusCode?: number;
      };
      /** @description REJECT target. statusCode defaults to 403. */
      reject?: {
        /** @description A 4xx; 0 or absent defaults to 403. */
        statusCode?: number;
      };
    };
    /** @description A dedicated L7_POLICY resource: a named ordered set of L7 routing rules attached to an existing L4 load-balancer, referenced by the LB's stable opaque `id`. CRUD'd independently of the LB and carried to the running sockproxy by a SEPARATE attach call (never inline on the 4096-byte proxy_arg).: L7_POLICY is a dedicated resource (asymmetric with the inline AI_POLICY). */
    L7Policy: {
      /** @description Stable opaque identifier for this L7 policy. Client-supplied is stored verbatim; when absent one is minted control-plane side. */
      id?: string;
      /** @description Human-readable policy name. */
      name?: string;
      /** @description The stable opaque id of the L4 load-balancer this policy attaches to (GET /config/loadbalancer/id/{id}). 404 if no such LB exists. */
      lbId: string;
      /** @description Ordered L7 routes (FIRST-MATCH-WINS by ascending position). */
      rules: components["schemas"]["L7Rule"][];
    };
    /** @description GET wrapper for the L7_POLICY collection. */
    L7PolicyGetEntry: {
      l7policyAttr?: components["schemas"]["L7Policy"][];
    };
    LoadbalanceEntry: {
      serviceArguments?: {
        /** @description Stable opaque identifier for the LB rule (Octavia). Client-supplied verbatim or minted (UUIDv4) when absent. */
        id?: string;
        /** @description Octavia admin_state_up lifecycle flag. Absent/true = enabled; false = paused. */
        adminStateUp?: boolean;
        /** @description Octavia tenant/project identifier. Opaque store-verbatim string, filtered on GET /all. NOT a tenant-isolation boundary. */
        projectId?: string;
        /**
         * Format: uint32
         * @description Octavia per-service concurrent-connection ceiling. Per-rule max simultaneous connections across all endpoints. 0/absent = unlimited (legacy). eBPF-CT enforced (SYN refused at sel=-1 -> pm.nf=0 when live count >= limit). DISTINCT from the SecurityRateConfig per-SOURCE-IP concurrentLimit (P0-6); not per-EP.
         */
        connectionLimit?: number;
        /** @description Opaque key/value map round-tripping octaviaProtocol and any future Octavia field verbatim. Store-as-given, return-as-stored; never interpreted. */
        annotations?: {
          [key: string]: string;
        };
        /** @description IP address for external access */
        externalIP?: string | null;
        /** @description private IP (NAT'd) address for external access */
        privateIP?: string;
        /** @description (Min) port number for the access */
        port?: number | null;
        /** @description Max port number(range) for the access */
        portMax?: number;
        /**
         * @description value for access protocol
         * @enum {string}
         */
        protocol?: "tcp" | "udp" | "sctp" | "icmp";
        /**
         * @description value for load balance algorithim(0-rr, 1-hash, 2-priority/wrr, 3-persist, 4-lc, 5-n2, 6-n3, 7-reserved, 8-chwbl, 9-gpuaware, 10-wrr-hash, 0-default)
         * @enum {integer}
         */
        sel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        /** @description value for BGP enable or not */
        bgp?: boolean;
        /** @description value for monitoring enabled or not */
        monitor?: boolean;
        /**
         * @description probe type for any end-point of this entry
         * @enum {string}
         */
        probetype?: "tcp" | "udp" | "sctp" | "http" | "https" | "ping" | "none";
        /**
         * Format: uint16
         * @description probe port if probetype is tcp/udp/sctp
         */
        probeport?: number;
        /** @description probe request string */
        probereq?: string;
        /** @description probe response string */
        proberesp?: string;
        /** @description externally managed rule or not */
        managed?: boolean;
        /**
         * Format: int32
         * @description value for NAT mode (0-DNAT,1-onearm, 2-fullnat, 3-dsr, 4-fullproxy, 5-hostonearm, 6-aigw, 0-default)
         * @enum {integer}
         */
        mode?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
        /**
         * Format: int32
         * @description value for Security mode (0-Plain, 1-https, 1-tls, 2-e2ehttps, 0-default)
         * @enum {integer}
         */
        security?: 0 | 1 | 2;
        /**
         * Format: uint32
         * @description block-number if any of this LB entry
         */
        block?: number;
        /**
         * Format: int32
         * @description value for inactivity timeout (in seconds)
         */
        inactiveTimeOut?: number;
        /**
         * Format: uint32
         * @description value for probe timer (in seconds)
         */
        probeTimeout?: number;
        /**
         * Format: int32
         * @description value for probe retries
         */
        probeRetries?: number;
        /**
         * Format: uint32
         * @description backend connect timeout in MILLISECONDS (Octavia native unit). Optional/additive — 0/absent preserves today's 500ms default (NOT Octavia's 5000ms). Enforced only on the L7_Proxy peer (has_l7_policy==1).
         */
        timeoutMemberConnect?: number;
        /**
         * Format: uint32
         * @description member-side relay idle timeout in MILLISECONDS. Optional/additive — 0/absent preserves the existing client-idle value.
         */
        timeoutMemberData?: number;
        /**
         * Format: uint32
         * @description header-accumulation deadline in MILLISECONDS (slowloris protection). Optional/additive — 0/absent uses a sane bounded default. NO Gateway-API equivalent — Octavia-only; a future Gateway controller MUST hard-error, never silent-drop.
         */
        timeoutTcpInspect?: number;
        /** @description service name */
        name?: string;
        /** @description snat rule */
        snat?: boolean;
        /**
         * Format: int32
         * @description end-point specific op (0-create, 1-attachEP, 2-detachEP)
         * @enum {integer}
         */
        oper?: 0 | 1 | 2;
        /** @description Ingress specific host URL path */
        host?: string;
        /** @description URL path prefix for L7 routing (e.g., /v1/users). Optional - empty means hostname-only matching (backward compatible) */
        path_prefix?: string;
        /**
         * @description Path matching mode - disabled (hostname-only, backward compat), prefix (longest prefix match), exact (exact path match)
         * @default disabled
         * @enum {string}
         */
        path_match_mode?: "disabled" | "prefix" | "exact";
        /** @description flag to enable proxy protocol v2 */
        proxyprotocolv2?: boolean;
        /** @description flag to indicate an egress rule */
        egress?: boolean;
        /** @description Tracing catalog name for deep inspection and protocol analysis (e.g., v1, anthropic, default). Enables body capture and parser invocation for observability. */
        trace_type?: string;
        /**
         * @description Backend protocol capability for ALPN negotiation - http1 (HTTP/1.1 only, safest default), http2 (HTTP/2 only), both (supports both HTTP/1.1 and HTTP/2)
         * @default http1
         * @enum {string}
         */
        backend_protocol?: "http1" | "http2" | "both";
        /** @description LB endpoint pool selection key for AI model routing (e.g. "llama-70b"); empty = wildcard pool (backward compatible) */
        model_name?: string;
        /**
         * @description Enable SSE (Server-Sent Events) streaming mode. When true, idle-timeout is suppressed while a streaming LLM response is active (Content-Type text/event-stream detected). Required for OpenAI-compatible streaming endpoints.
         * @default false
         */
        sse_mode?: boolean;
        /**
         * Format: int32
         * @description Absolute wall-clock cap for SSE streams in seconds. 0 = use system hard cap (86400s / 24h). Set to a lower value (e.g. 300) to bound runaway streams.
         * @default 0
         */
        max_stream_duration_sec?: number;
        /**
         * Format: int32
         * @description Sets SO_KEEPALIVE + TCP_KEEPIDLE on backend socket in seconds. Keeps TCP CT entries alive through cloud NAT during long SSE streams. 0 = disabled. Recommended value 60 for most cloud environments.
         * @default 0
         */
        backend_keepalive_interval_sec?: number;
        /**
         * @description Enable vLLM prefill/decode disaggregation mode. When true, the proxy orchestrates a two-phase flow - prefill request to a prefill endpoint, then decode request to a decode endpoint using KV transfer parameters from the prefill response.
         * @default false
         */
        pd_disagg_mode?: boolean;
        /**
         * @description Enable P/D cache-aware routing. When true, uses session stickiness, radix trie prefix matching, and min-load balancing for endpoint selection. Requires pd_disagg_mode=true.
         * @default false
         */
        pd_cache_aware_mode?: boolean;
        /**
         * Format: int32
         * @description Session stickiness TTL in seconds for P/D cache-aware routing. 0 = no automatic expiry. Only used when pd_cache_aware_mode is true.
         * @default 0
         */
        pd_session_ttl_sec?: number;
        /**
         * Format: int32
         * @description Cache match threshold (0-100) for P/D cache-aware routing. Lower values make cache routing more aggressive.
         * @default 20
         */
        pd_cache_threshold?: number;
        /**
         * Format: int32
         * @description Load imbalance threshold for P/D cache-aware routing. If max-min active connections exceeds this, bypass cache affinity.
         * @default 3
         */
        pd_balance_abs_threshold?: number;
        /**
         * Format: int64
         * @description KV-cache exact routing mode: 0=off, 1=zmq (P/D role-partitioned), 2=nats(reserved), 3=zmq single-role (— all EPs subscribed, no P/D role split). Enables Tier 1.5 block-hash routing between Tier 1 (trie) and Tier 2 (min-load).
         * @default 0
         */
        kvExactMode?: number;
        /**
         * Format: int64
         * @description Token block size for KV hash computation. Must match vLLM's block_size configuration.
         * @default 16
         */
        kvBlockSize?: number;
        /**
         * @description Hash algorithm for KV block matching. Must match vLLM's configured hash algorithm.
         * @default sha256_cbor
         * @enum {string}
         */
        kvHashAlgo?: "sha256_cbor" | "xxhash_cbor";
        /**
         * Format: int64
         * @description ZMQ PUB socket port on vLLM prefill endpoints for KV cache events.
         * @default 5557
         */
        kvZmqPort?: number;
        /**
         * Format: int64
         * @description Seconds to wait after ZMQ subscriber connects before activating Tier 1.5 routing. Allows inventory to populate.
         * @default 30
         */
        kvWarmupSec?: number;
        /**
         * @description KV-event engine behind this rule. One framework per VIP; immutable after create (delete+recreate to change). Drives hash-algo default: sglang => sha256_sglang. NOTE: LOXILB_KV_* env knobs (unified mode, eps/lambda, cap-sum, max-blocks) are process-global and shared across all KV VIPs (accepted limitation).
         * @default vllm
         * @enum {string}
         */
        kvEngineType?: "vllm" | "sglang";
        /**
         * Format: int32
         * @description SGLang data-parallel rank count. Rank N publishes KV events at kvZmqPort+N; all ranks union into one per-EP inventory.
         * @default 1
         */
        kvDpRankCount?: number;
        /**
         * @description Session affinity configuration for persist mode (sel=3). Supports multiple methods:
         *
         * **Regular Header** (full value extraction):
         * - "X-Session-ID" - Extracts full header value
         * - "mcp-session-id" - Custom application header
         * - "authorization" - Full Authorization header
         *
         * **Cookie-based** (specific cookie extraction):
         * - "cookie:JSESSIONID" - Java/Tomcat session cookie
         * - "cookie:PHPSESSID" - PHP session cookie
         * - "cookie:ASP.NET_SessionId" - ASP.NET session
         * - "cookie:connect.sid" - Node.js/Express session
         * - "cookie:SESSION_TOKEN" - Custom cookie name
         *
         * **Query Parameter** (URL parameter extraction):
         * - "query:sessionid" - Extract from ?sessionid=value
         * - "query:token" - Extract from ?token=value
         * - "query:jsessionid" - Common Java fallback
         *
         * **Basic Authentication** (username extraction):
         * - "basic-auth" - Extract username from Authorization: Basic header
         *
         * If empty and sel=3, falls back to IP-based persistence.
         * Cookie/query methods ignore other cookies/parameters, ensuring consistent routing.
         */
        session_header_name?: string;
        /**
         * @description Prefix hash level for CHWBL/WRR_HASH modes (sel=8 or sel=10) - 1=Level1 only (system prompt+model), 2=Level1+Level2 (session context), 3=Level1+Level2+Level3 (RAG). Only used when sel=8 or sel=10. Optional - defaults to 1 for backward compatibility
         * @default 1
         * @enum {integer}
         */
        chwbl_prefix_hash_level?: 1 | 2 | 3;
        /**
         * @description Optional field inclusion flags for CHWBL/WRR_HASH (sel=8 or sel=10) - Bit 0=LoRA, Bit 1=image, Bit 2=audio, Bit 3=cache_salt, Bit 4=tools, Bit 5=session, Bit 6=RAG template, Bit 7=RAG docs. 0=auto-detect. Only used when sel=8 or sel=10
         * @default 0
         */
        chwbl_prefix_hash_flags?: number;
        /**
         * @description Maximum load factor percentage for CHWBL/WRR_HASH (sel=8 or sel=10) - max_load = avg_load × factor / 100. Range 100-300, default 125 (allows 25% overload). Only used when sel=8 or sel=10
         * @default 125
         */
        chwbl_mean_load_factor?: number;
        /**
         * @description Virtual nodes per physical endpoint for CHWBL/WRR_HASH (sel=8 or sel=10) - higher values improve distribution but use more memory. Range 1-1024, default 100. For WRR_HASH, this is the total vnode count distributed proportionally by weight. Only used when sel=8 or sel=10
         * @default 100
         */
        chwbl_replication?: number;
        /**
         * @description Require cache_salt field in requests for CHWBL/WRR_HASH (sel=8 or sel=10) - enforces strict multi-tenant isolation. If false, cache_salt is optional. Only used when sel=8 or sel=10
         * @default false
         */
        chwbl_enable_cache_salt?: boolean;
        /** @description Frontend mTLS configuration for client certificate verification. Only valid with security=1 (HTTPS) or security=2 (E2E HTTPS) and mode=4 (FullProxy) */
        mtls_frontend?: {
          /**
           * @description Client certificate requirement - disabled (no verification, default), optional (accept with/without cert), required (reject without valid cert)
           * @default disabled
           * @enum {string}
           */
          client_cert_mode?: "disabled" | "optional" | "required";
          /** @description Path to client CA certificate bundle (PEM format). Example /opt/loxilb/cert/client_ca_bundle.crt */
          client_ca_path?: string;
          /** @description Inline CA certificate data (base64-encoded PEM). Alternative to client_ca_path for Kubernetes secrets */
          client_ca_cert_data?: string;
          /**
           * @description Require specific CN pattern in client certificate for additional security
           * @default false
           */
          require_client_cn?: boolean;
          /** @description Required CN pattern (e.g., *.corp.example.com). Supports wildcard matching. Only used if require_client_cn is true */
          client_cn_pattern?: string;
          /** @description (08) operator-supplied static CRL file (PEM) loaded into the verify X509_STORE with leaf-only X509_V_FLAG_CRL_CHECK. A revoked client LEAF cert is rejected; a valid one passes. Optional/additive — empty preserves today's behaviour (the 77-04 sibling crl.pem convention). */
          client_crl_path?: string;
        };
        /** @description Backend mTLS configuration for server certificate verification and client certificate presentation. Only valid with security=2 (E2E HTTPS) and mode=4 (FullProxy) */
        mtls_backend?: {
          /**
           * @description Enable backend server certificate verification (SSL_VERIFY_PEER). False skips verification (SSL_VERIFY_NONE, default for backward compatibility)
           * @default false
           */
          verify_server_cert?: boolean;
          /** @description Path to backend CA bundle (PEM format). Empty uses system CA store (/etc/ssl/certs/). Example /opt/loxilb/cert/backend_ca.crt */
          backend_ca_path?: string;
          /** @description Path to loxilb's client certificate for backend mTLS. Example /opt/loxilb/cert/loxilb_client.crt */
          client_cert_path?: string;
          /** @description Path to loxilb's private key for backend mTLS. Example /opt/loxilb/cert/loxilb_client.key */
          client_key_path?: string;
          /** @description Inline client certificate (base64-encoded PEM). Alternative to client_cert_path */
          client_cert_data?: string;
          /** @description Inline client key (base64-encoded PEM). Alternative to client_key_path */
          client_key_data?: string;
        };
        /** @description references an EXISTING loxilb /config/policy ident (pre-created by the external Octavia driver). On create, when non-empty, loxilb ASSOCIATES that policy to the VIP rule (policer association). Optional/additive — empty/absent leaves the rule unchanged. An unresolvable ident is an error (no silent-drop). */
        vip_qos_policy_id?: string;
        /** @description Octavia alpn_protocols list (e.g. ["h2","http/1.1"]). Mapped to the existing backend_protocol_cap enum ([h2,http/1.1]=2, [h2]=1, [http/1.1]=0). Advertised on listener + pool. Optional/additive — empty preserves the backendProtocol-driven value. */
        alpn_protocols?: string[];
        /** @description OpenSSL cipher string, applied to BOTH SSL_CTX_set_cipher_list (TLS1.2) and SSL_CTX_set_ciphersuites (TLS1.3) on listener + pool. Optional/additive — empty preserves today's hardcoded ciphers. */
        tls_ciphers?: string;
        /** @description Octavia tls_versions list (e.g. ["TLSv1.2","TLSv1.3"]). Collapsed to a minmax protocol-version range. Optional/additive — empty preserves today's TLS1.21.3. */
        tls_versions?: string[];
        /**
         * Format: uint32
         * @description Strict-Transport-Security max-age (seconds). The data plane synthesizes the header and injects it on HTTPS listeners only (L7-gated). Optional/additive — 0/absent = no HSTS injection.
         */
        hsts_max_age?: number;
        /** @description append "; includeSubDomains" to the HSTS header. Only meaningful when hsts_max_age > 0. */
        hsts_include_subdomains?: boolean;
        /** @description append "; preload" to the HSTS header. Only meaningful when hsts_max_age > 0. */
        hsts_preload?: boolean;
        /** @description (16) certId of the backend re-encryption CA bundle (resolved by the certId registry to the managed-dir ca.crt at backend SSL_CTX build). Optional/additive — empty = system default. */
        backend_ca_cert_id?: string;
        /** @description (16) certId of loxilb's backend client cert+key. Optional/additive — empty = no backend client cert (today's behaviour). */
        backend_client_cert_id?: string;
      };
      /** @description values of End point servers */
      endpoints?: {
          /** @description IP address for external access */
          endpointIP: string;
          /** @description Weight for the load balancing */
          weight: number;
          /** @description port number for access service */
          targetPort: number;
          /**
           * Format: int32
           * @description Endpoint role for P/D disaggregation - 0=normal (no role), 1=prefill, 2=decode. Only used when pd_disagg_mode is true.
           * @default 0
           */
          ep_role?: number;
          /**
           * Format: int32
           * @description NIXL side-channel port for KV cache transfer. 0=use targetPort (backward compatible). Only meaningful when pd_disagg_mode is true.
           * @default 0
           */
          nixl_port?: number;
          /**
           * @description Octavia standby member flag. A backup endpoint carries traffic only when all primaries are unavailable. Absent/false = primary (today's behavior).
           * @default false
           */
          backup?: boolean;
          /** @description Octavia member subnet identifier. Opaque store-verbatim round-trip field; not interpreted (no routing effect this phase). */
          subnetId?: string;
          /** @description Octavia per-member health-probe address. When set, the health probe targets this address instead of the traffic IP; absent = probe the traffic IP. */
          monitorAddress?: string;
          /** @description HTTP(S) health-monitor method (e.g. GET, HEAD). Optional/additive — empty defaults to GET. Control-plane only (probeReq/probeResp retained as the escape hatch). */
          httpMethod?: string;
          /** @description HM request path (e.g. /healthz). Optional/additive — empty falls back to probeReq or "/". */
          urlPath?: string;
          /** @description Octavia expected_codes — single "200", list "200,202", or range "200-204". Optional/additive — empty defaults to "200". */
          expectedCodes?: string;
          /** @description HM HTTP version "1.0" or "1.1". When "1.1" a Host header is sent (domainName, else the member address). Optional/additive. */
          httpVersion?: string;
          /** @description doubles as TLS SNI for HTTPS monitors AND the Host header. Optional/additive. */
          domainName?: string;
          /** @description state of the endpoint */
          state?: string;
          /** @description traffic counters of the endpoint */
          counter?: string;
        }[];
      /** @description values of Secondary IPs */
      secondaryIPs?: {
          /** @description IP address for secondary access */
          secondaryIP?: string;
        }[];
      /** @description Structured secondary VIPs (Octavia additional_vips). Additive ALONGSIDE the flat secondaryIPs (kept unchanged). Stored and round-tripped for all protocols; only SCTP consumes them at the dataplane. All fields opaque. */
      secondaryVIPs?: {
          /** @description secondary VIP address */
          address?: string;
          /** @description opaque Octavia subnet identifier for this VIP (round-trip only) */
          subnetId?: string;
          /** @description opaque Octavia port identifier for this VIP (round-trip only) */
          portId?: string;
          /** @description opaque protocol hint for this VIP (round-trip only) */
          proto?: string;
        }[];
      /** @description values of allowed source IP */
      allowedSources?: {
          /** @description IP address for allowed source access */
          prefix?: string;
        }[];
      /** @description aggregate DOCA HW offload state for this LB service ("none", "hw"), derived from the dominant CT offload state across active flows. Absent when no DOCA plugin is active (omitempty). Generated Go field OffloadState (camelCase alias offloadState). */
      offload_state?: string;
      /**
       * Format: uint64
       * @description aggregate DOCA hardware packet count for this LB service (omitempty). Generated Go field HwPkts (camelCase alias hwPkts).
       */
      hw_pkts?: number;
      /**
       * Format: uint64
       * @description aggregate DOCA hardware byte count for this LB service (omitempty). Generated Go field HwBytes (camelCase alias hwBytes).
       */
      hw_bytes?: number;
    };
    RouteEntry: {
      /** @description IP address and netmask */
      destinationIPNet: string;
      /** @description IP address for nexthop */
      gateway: string;
      /** @description Protocol type of the route like "static" */
      protocol?: string;
    };
    RouteGetEntry: {
      /** @description IP address and netmask */
      destinationIPNet?: string;
      /** @description IP address for nexthop */
      gateway?: string;
      /** @description index of the route */
      hardwareMark?: number;
      /** @description Route protocol */
      protocol?: string;
      /** @description Route flags */
      flags?: string;
      sync?: number;
      statistic?: {
        /** @description Statistic of the ingress port bytes. */
        bytes: number;
        /** @description Statistic of the egress port bytes. */
        packets: number;
      };
    };
    K8sConntrackEntry: {
      /** @description Pod name of the destination */
      destinationPod?: string;
      /** @description Pod name of the soruce */
      sourcePod?: string;
      /** @description Namespace of the destination */
      destinationNamespace?: string;
      /** @description Namespace of the source */
      sourceNamespace?: string;
      /** @description Node of the destination */
      destinationNode?: string;
      /** @description Node of the source */
      sourceNode?: string;
      /** @description K8s service name */
      k8sservName?: string;
      /** @description IP address for externel access */
      destinationIP?: string;
      /** @description IP address for externel access */
      sourceIP?: string;
      /** @description port number for the access */
      destinationPort?: number;
      /** @description port number for the access */
      sourcePort?: number;
      /** @description value for access protocol */
      protocol?: string;
      /** @description value for Conntrack state */
      conntrackState?: string;
      /** @description value for Conntrack ident */
      ident?: string;
      /** @description value for Conntrack Act */
      conntrackAct?: string;
      /** @description Packet counts of the conntrack */
      packets?: number;
      /** @description Packet bytes of the conntrack */
      bytes?: number;
      /** @description Connection's Service Name */
      servName?: string;
    };
    ConntrackEntry: {
      /** @description IP address for externel access */
      destinationIP?: string;
      /** @description IP address for externel access */
      sourceIP?: string;
      /** @description port number for the access */
      destinationPort?: number;
      /** @description port number for the access */
      sourcePort?: number;
      /** @description value for access protocol */
      protocol?: string;
      /** @description value for Conntrack state */
      conntrackState?: string;
      /** @description value for Conntrack ident */
      ident?: string;
      /** @description value for Conntrack Act */
      conntrackAct?: string;
      /** @description Packet counts of the conntrack */
      packets?: number;
      /** @description Packet bytes of the conntrack */
      bytes?: number;
      /** @description Connection's Service Name */
      servName?: string;
      /** @description HW offload state of the conntrack flow ("none", "hw"). Absent when none. */
      offload_state?: string;
      /**
       * Format: uint64
       * @description Packet count served by the HW fast-path for this flow
       */
      hw_pkts?: number;
      /**
       * Format: uint64
       * @description Byte count served by the HW fast-path for this flow
       */
      hw_bytes?: number;
      /**
       * Format: uint64
       * @description DOCA detail: age of this conntrack/offload flow in milliseconds (age-query estimate; 0 when unavailable). Declared so a `swagger generate server` reproduces the hand-maintained DOCA age field instead of clobbering it. Additive/optional.
       */
      ageMs?: number;
    };
    PortEntry: {
      /** @description The name of the Port interface */
      portName?: string;
      /** @description Index of the Port */
      portNo?: number;
      /** @description network zone */
      zone?: string;
      portSoftwareInformation?: {
        /** @description The ID of the Port in the software(OS) */
        osId?: number;
        /** @description port type */
        portType?: number;
        /** @description Priority of the port */
        portProp?: number;
        /** @description Activation status of the port */
        portActive?: boolean;
        /** @description The status of the eBPF loaded */
        bpfLoaded?: boolean;
      };
      portHardwareInformation?: {
        /** @description MAC address written by byte array */
        rawMacAddress?: number[];
        /** @description MAC address of the port */
        macAddress?: string;
        /** @description MTU of the port */
        mtu?: number;
        /** @description link status */
        link?: boolean;
        /** @description state... */
        state?: boolean;
        /** @description Port's mater */
        master?: string;
        /** @description real port.. */
        real?: string;
        /** @description Tunnel Id such as VxLAN. */
        tunnelId?: number;
      };
      portStatisticInformation?: {
        /** @description Statistic of the ingress port bytes. */
        rxBytes?: number;
        /** @description Statistic of the egress port bytes. */
        txBytes?: number;
        /** @description Statistic of the number of ingress packets. */
        rxPackets?: number;
        /** @description Statistic of the number of egress packets. */
        txPackets?: number;
        /** @description Statistic of the number of ingress Error packets. */
        rxErrors?: number;
        /** @description Statistic of the number of egress Error packets. */
        txErrors?: number;
      };
      portL3Information?: {
        /** @description Is routed or not */
        routed?: boolean;
        /** @description List of IP address v4 */
        IPv4Address?: string[];
        /** @description List of the IP address v6 */
        IPv6Address?: string[];
      };
      portL2Information?: {
        /** @description Is PVID config or not */
        isPvid?: boolean;
        /** @description virtual lan id(VLAN ID) */
        vid?: number;
      };
      /** @description Dataplan Sync check */
      DataplaneSync?: number;
    };
    SessionEntry: {
      /** @description IP address and netmask */
      ident: string;
      /** @description IP address for nexthop */
      sessionIP?: string;
      accessNetworkTunnel?: {
        /** @description ID of the tunnel */
        TeID?: number;
        /** @description Access network IP address */
        tunnelIP?: string;
      };
      coreNetworkTunnel?: {
        /** @description ID of the tunnel */
        teID?: number;
        /** @description Connection network IP address */
        tunnelIP?: string;
      };
    };
    SessionUlClEntry: {
      /** @description IP address and netmask */
      ulclIdent: string;
      ulclArgument?: {
        /** @description QFI number */
        qfi?: number;
        /** @description Access network IP address */
        ulclIP?: string;
      };
    };
    PolicyEntry: {
      /** @description Policy name */
      policyIdent: string;
      policyInfo?: {
        /**
         * @description policy type(0-TrTCM, 1-SrTCM)
         * @enum {integer}
         */
        type?: 0 | 1;
        /** @description Policy color for QoS */
        colorAware?: boolean;
        /** @description policy type */
        committedInfoRate?: number;
        /** @description policy type */
        peakInfoRate?: number;
        /** @description policy type */
        committedBlkSize?: number;
        /** @description policy type */
        excessBlkSize?: number;
      };
      targetObject: {
        /**
         * @description Target Attachment(0-RuleName, 1-PortName)
         * @enum {integer}
         */
        attachment: 0 | 1;
        /** @description Target Names */
        polObjName: string;
      };
    };
    MirrorEntry: {
      /** @description Mirror name */
      mirrorIdent: string;
      mirrorInfo?: {
        /**
         * @description One of MirrTypeSpan, MirrTypeRspan or MirrTypeErspan(0-MirrTypeSpan, 1-MirrTypeRspan, 2-MirrTypeErspan)
         * @enum {integer}
         */
        type?: 0 | 1 | 2;
        /** @description Port where mirrored traffic needs to be sent */
        port?: string;
        /** @description For RSPAN we may need to send tagged mirror traffic */
        vlan?: number;
        /** @description For ERSPAN we may need to send tunnelled mirror traffic */
        remoteIP?: string;
        /** @description For ERSPAN we may need to send tunnelled mirror traffic */
        sourceIP?: string;
        /** @description mirror tunnel-id. For ERSPAN we may need to send tunnelled mirror traffic */
        tunnelID?: number;
      };
      targetObject: {
        /**
         * @description Target Attachment(0-RuleName, 1-PortName)
         * @enum {integer}
         */
        attachment: 0 | 1;
        /** @description Target Names */
        mirrObjName: string;
      };
    };
    MirrorGetEntry: {
      /** @description Mirror name */
      mirrorIdent?: string;
      mirrorInfo?: {
        /** @description One of MirrTypeSpan, MirrTypeRspan or MirrTypeErspan */
        type?: number;
        /** @description Port where mirrored traffic needs to be sent */
        port?: string;
        /** @description For RSPAN we may need to send tagged mirror traffic */
        vlan?: number;
        /** @description For ERSPAN we may need to send tunnelled mirror traffic */
        remoteIP?: string;
        /** @description For ERSPAN we may need to send tunnelled mirror traffic */
        sourceIP?: string;
        /** @description mirror tunnel-id. For ERSPAN we may need to send tunnelled mirror traffic */
        tunnelID?: number;
      };
      targetObject?: {
        /** @description Target Attachment */
        attachment?: number;
        /** @description Target Names */
        mirrObjName?: string;
      };
      /** @description Sync - sync state */
      sync: number;
    };
    VlanBridgeEntry: {
      /** @description Vlan ID */
      vid: number;
    };
    VlanGetEntry: {
      /** @description Vlan ID */
      vid?: number;
      /** @description Interface device name */
      dev?: string;
      member?: components["schemas"]["VlanMemberEntry"][];
      vlanStatistic?: {
        inBytes?: number;
        inPackets?: number;
        outBytes?: number;
        outPackets?: number;
      };
    };
    VlanMemberEntry: {
      /** @description Interface device name */
      dev?: string;
      /** @description Tagged status added */
      tagged?: boolean;
    };
    IPv4AddressEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev: string;
      /** @description IP address to modify. */
      ipAddress: string;
    };
    IPv4AddressGetEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev?: string;
      ipAddress?: string[];
      /** @description Sync - sync state */
      sync: number;
    };
    IPv6AddressEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev: string;
      /** @description IP address to modify. */
      ipAddress: string;
    };
    IPv6AddressGetEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev?: string;
      ipAddress?: string[];
      /** @description Sync - sync state */
      sync: number;
    };
    NeighborEntry: {
      /** @description IP address to neighbor */
      ipAddress: string;
      /** @description Name of the interface device to which you want to add neighbor */
      dev: string;
      /** @description MAC address to neighbor */
      macAddress: string;
    };
    FDBEntry: {
      /** @description Name of the interface device to which you want to modify FDB */
      dev: string;
      /** @description MAC address to FDB */
      macAddress: string;
    };
    ProcessInfoEntry: {
      /** @description process ID */
      pid?: string;
      /** @description User name that start the process */
      user?: string;
      /** @description process priority */
      priority?: string;
      /** @description process nice value */
      nice?: string;
      /** @description virtual memory usage */
      virtMemory?: string;
      /** @description Physical memory usage */
      residentSize?: string;
      /** @description Shared memory usage */
      sharedMemory?: string;
      /** @description process status */
      status?: string;
      /** @description CPU usage of the process */
      CPUUsage?: string;
      /** @description Memory usage of the process */
      MemoryUsage?: string;
      /** @description Executation time */
      time?: string;
      /** @description process command */
      command?: string;
    };
    DeviceInfoEntry: {
      /** @description Device host name */
      hostName?: string;
      /** @description Device machine ID */
      machineID?: string;
      /** @description Boot ID in the linux */
      bootID?: string;
      /** @description Operation System of the device */
      OS?: string;
      /** @description Kernel version of the device */
      kernel?: string;
      /** @description CPU architecture of the device */
      architecture?: string;
      /** @description system uptime */
      uptime?: string;
    };
    FileSystemInfoEntry: {
      /** @description File system name mounted on this device */
      fileSystem?: string;
      /** @description File type (ex. nfs, ext4..) */
      type?: string;
      /** @description Boot ID in the linux */
      size?: string;
      /** @description size of used the disk */
      used?: string;
      /** @description size of remain the disk */
      avail?: string;
      /** @description usage per total size */
      usePercent?: string;
      /** @description path of the mounted on */
      mountedOn?: string;
    };
    VxlanEntry: {
      vxlanName: string;
      epIntf: string;
      vxlanID: number;
      peerIP: string[];
    };
    VxlanBridgeEntry: {
      epIntf: string;
      vxlanID: number;
    };
    VxlanPeerEntry: {
      peerIP: string;
    };
    CIStatusEntry: {
      /** @description Instance name */
      instance?: string;
      /** @description Current Cluster Instance State */
      state?: string;
      /** @description Instance Virtual IP address */
      vip?: string;
    };
    CIStatusGetEntry: {
      /** @description Instance name */
      instance?: string;
      /** @description Current Cluster Instance State */
      state?: string;
      /** @description Instance Virtual IP address */
      vip?: string;
      /** @description Sync - sync state */
      sync: number;
    };
    EndPointGetEntry: {
      /** @description Host name */
      hostName?: string;
      /** @description Endpoint Identifier */
      name?: string;
      /** @description Number of inactive retries */
      inactiveReTries?: number;
      /** @description Type of probe used */
      probeType?: string;
      /** @description URI for http/https probes */
      probeReq?: string;
      /** @description Response for http/https probes */
      probeResp?: string;
      /** @description How frequently to probe in seconds */
      probeDuration?: number;
      /** @description The l4port to probe on */
      probePort?: number;
      /** @description Minimum delay seen for endpoint */
      minDelay?: string;
      /** @description Average delay seen for endpoint */
      avgDelay?: string;
      /** @description Maximum delay seen for endpoint */
      maxDelay?: string;
      /** @description Current state of this endpoint */
      currState?: string;
    };
    EndPoint: {
      /** @description Host name in CIDR */
      hostName: string;
      /** @description Endpoint Identifier */
      name?: string;
      /** @description Number of inactive retries */
      inactiveReTries?: number;
      /**
       * @description Type of probe used (tls-hello = handshake-only TLS liveness probe)
       * @enum {string}
       */
      probeType?: "tcp" | "udp" | "sctp" | "ping" | "http" | "https" | "none" | "tls-hello";
      /** @description URI for http/https probes */
      probeReq?: string;
      /** @description Response for http/https probes */
      probeResp?: string;
      /** @description How frequently to probe in seconds */
      probeDuration?: number;
      /** @description The l4port to probe on */
      probePort?: number;
      /** @description HTTP(S) health-monitor method (e.g. GET, HEAD). Optional/additive — empty defaults to GET. Control-plane only (probeReq/probeResp retained as the escape hatch). */
      httpMethod?: string;
      /** @description HM request path (e.g. /healthz). Optional/additive — empty falls back to probeReq or "/". */
      urlPath?: string;
      /** @description Octavia expected_codes — single "200", list "200,202", or range "200-204". Optional/additive — empty defaults to "200". */
      expectedCodes?: string;
      /** @description HM HTTP version "1.0" or "1.1". When "1.1" a Host header is sent (domainName, else the member address). Optional/additive. */
      httpVersion?: string;
      /** @description doubles as TLS SNI for HTTPS monitors AND the Host header. Optional/additive. */
      domainName?: string;
    };
    EndPointHostState: {
      /** @description Host name in CIDR */
      hostName?: string;
      /** @description The end-point port (0 if not applicable) */
      epPort?: number;
      /** @description The end-point prototype (tcp,udp,sctp,icmp,http(s), empty if not applicable) */
      epProto?: string;
      /** @description Host state string ("green", "yellow", "red" ) */
      state?: string;
    };
    FirewallOptionEntry: {
      /** @description Drop any matching rule */
      drop?: boolean;
      /** @description Trap anything matching rule */
      trap?: boolean;
      /** @description Redirect any matching rule */
      redirect?: boolean;
      /** @description Allow any matching rule */
      allow?: boolean;
      /** @description Record or dump for matching rule */
      record?: boolean;
      /** @description Redirect any matching rule */
      redirectPortName?: string;
      /** @description Set a fwmark for any matching rule */
      fwMark?: number;
      /** @description Do SNAT on matching rule */
      doSnat?: boolean;
      /** @description Modify to given IP in CIDR notation */
      toIP?: string;
      /** @description Modify to given Port (Zero if port is not to be modified) */
      toPort?: number;
      /** @description Trigger only on default cases */
      onDefault?: boolean;
      /** @description traffic counters */
      counter?: string;
    };
    FirewallRuleEntry: {
      /** @description Source IP in CIDR notation */
      sourceIP?: string;
      /** @description Destination IP in CIDR notation */
      destinationIP?: string;
      /** @description Minimum source port range */
      minSourcePort?: number;
      /** @description Maximum  source port range */
      maxSourcePort?: number;
      /** @description Minimum destination port range */
      minDestinationPort?: number;
      /** @description Maximum  destination port range */
      maxDestinationPort?: number;
      /** @description the protocol */
      protocol?: number;
      /** @description the incoming port */
      portName?: string;
      /** @description User preference for ordering */
      preference?: number;
      /**
       * @description opt-IN per-rule HW offload flag. When true, the rule is mirrored into the DOCA ingress ACL pipeline (DENY_PIPE / ALLOW_PIPE) in addition to the eBPF firewall fallback. The rule MUST be expressible in HW (IPv4, single-port, no proto-specific match) — non-expressible rules are hard-rejected at AddFwRule. Default false preserves existing eBPF-only behaviour for all deployments.
       *
       * @default false
       */
      hwOffload?: boolean;
    };
    FirewallEntry: {
      ruleArguments: components["schemas"]["FirewallRuleEntry"];
      opts: components["schemas"]["FirewallOptionEntry"];
    };
    IPFilterEntry: {
      /**
       * @description Filter type (whitelist or blacklist)
       * @enum {string}
       */
      filterType: "whitelist" | "blacklist";
      /** @description IP address in CIDR notation (e.g., 192.168.1.0/24) */
      cidr: string;
      /**
       * Format: int64
       * @description Security zone (0 = all zones)
       * @default 0
       */
      zone?: number;
      /**
       * Format: int64
       * @description Rule priority (higher = more important)
       * @default 100
       */
      priority?: number;
      /**
       * @description Action to take (allow or drop)
       * @enum {string}
       */
      action: "allow" | "drop";
      /**
       * Format: int64
       * @description Packet counter (read-only)
       */
      packets?: number;
      /**
       * Format: int64
       * @description Byte counter (read-only)
       */
      bytes?: number;
    };
    SYNFloodConfigMod: {
      /** @description Enable/disable SYN flood protection */
      enabled: boolean;
      /**
       * Format: int64
       * @description Maximum SYNs per second per IP (hard drop threshold)
       * @default 100
       */
      synThreshold: number;
      /**
       * Format: int64
       * @description Enable SYN cookies above this rate (must be < synThreshold)
       * @default 50
       */
      cookieThreshold: number;
      /** @description IP addresses to bypass SYN flood protection */
      whitelistIps?: string[];
    };
    SYNFloodEntry: {
      /** @description Whether SYN flood protection is enabled */
      enabled?: boolean;
      /**
       * Format: int64
       * @description Maximum SYNs per second per IP
       */
      synThreshold?: number;
      /**
       * Format: int64
       * @description SYN cookie activation threshold
       */
      cookieThreshold?: number;
      /** @description Whitelisted IPs */
      whitelistIps?: string[];
      /**
       * Format: int64
       * @description Total SYN packets processed (read-only)
       */
      totalSyns?: number;
      /**
       * Format: int64
       * @description SYN packets blocked (read-only)
       */
      blockedSyns?: number;
      /**
       * Format: int64
       * @description SYN packets passed (read-only)
       */
      passedSyns?: number;
      /**
       * Format: int64
       * @description Times SYN cookies were enabled (read-only)
       */
      cookieActivations?: number;
      /**
       * Format: int64
       * @description Number of unique source IPs tracked (read-only)
       */
      uniqueIps?: number;
    };
    SecurityRateConfigMod: {
      /** @description Enable/disable SYN flood protection (P0-5) */
      synEnabled: boolean;
      /**
       * Format: int64
       * @description Maximum SYNs per second per IP (hard drop threshold)
       * @default 100
       */
      synThreshold: number;
      /**
       * Format: int64
       * @description Enable SYN cookies above this rate (must be < synThreshold)
       * @default 50
       */
      cookieThreshold: number;
      /** @description Enable/disable connection rate limiting (P0-6) */
      connRateEnabled: boolean;
      /**
       * Format: int64
       * @description Maximum new connections per second per IP
       * @default 50
       */
      ratePerSec: number;
      /**
       * Format: int64
       * @description Maximum concurrent connections per IP
       * @default 200
       */
      concurrentLimit: number;
      /** @description Enable/disable UDP flood protection (P0-7) */
      udpEnabled: boolean;
      /**
       * Format: int64
       * @description Maximum UDP packets per second per IP
       * @default 1000
       */
      udpPktThreshold: number;
      /**
       * Format: int64
       * @description Maximum UDP bandwidth in MB per second per IP
       * @default 100
       */
      udpBandwidthMB: number;
      /** @description IP addresses to bypass all rate limiting */
      whitelistIps?: string[];
    };
    SecurityRateEntry: {
      /** @description Whether SYN flood protection is enabled */
      synEnabled?: boolean;
      /**
       * Format: int64
       * @description Maximum SYNs per second per IP
       */
      synThreshold?: number;
      /**
       * Format: int64
       * @description SYN cookie activation threshold
       */
      cookieThreshold?: number;
      /** @description Whether connection rate limiting is enabled */
      connRateEnabled?: boolean;
      /**
       * Format: int64
       * @description Maximum new connections per second per IP
       */
      ratePerSec?: number;
      /**
       * Format: int64
       * @description Maximum concurrent connections per IP
       */
      concurrentLimit?: number;
      /** @description Whether UDP flood protection is enabled */
      udpEnabled?: boolean;
      /**
       * Format: int64
       * @description Maximum UDP packets per second per IP
       */
      udpPktThreshold?: number;
      /**
       * Format: int64
       * @description Maximum UDP bandwidth in MB per second per IP
       */
      udpBandwidthMB?: number;
      /** @description Whitelisted IPs */
      whitelistIps?: string[];
      /**
       * Format: int64
       * @description SYN packets blocked (read-only)
       */
      synBlocked?: number;
      /**
       * Format: int64
       * @description SYN packets passed (read-only)
       */
      synPassed?: number;
      /**
       * Format: int64
       * @description SYN cookie activations (read-only)
       */
      synCookies?: number;
      /**
       * Format: int64
       * @description Connections blocked by rate limit (read-only)
       */
      connBlocked?: number;
      /**
       * Format: int64
       * @description Connections passed (read-only)
       */
      connPassed?: number;
      /**
       * Format: int64
       * @description Connections blocked by concurrent limit (read-only)
       */
      concurrentBlocked?: number;
      /**
       * Format: int64
       * @description UDP packets blocked (read-only)
       */
      udpBlocked?: number;
      /**
       * Format: int64
       * @description UDP packets passed (read-only)
       */
      udpPassed?: number;
      /**
       * Format: int64
       * @description UDP bytes blocked (read-only)
       */
      udpBytesBlocked?: number;
      /**
       * Format: int64
       * @description UDP bytes passed (read-only)
       */
      udpBytesPassed?: number;
      /**
       * Format: int64
       * @description Number of unique source IPs tracked (read-only)
       */
      uniqueIps?: number;
    };
    IPsecConfig: {
      /** @description Enable eBPF fast-path bypass for established SAs */
      fastPathEnabled?: boolean;
      /** @description Enable hardware crypto offload (QAT/DPAA2) */
      hwOffloadEnabled?: boolean;
      /**
       * @description Hardware offload type
       * @enum {string}
       */
      hwOffloadType?: "none" | "qat" | "dpaa2" | "inline";
      /** @description Enable anti-replay protection */
      antiReplayEnabled?: boolean;
      /**
       * Format: uint32
       * @description Warn before SA expiration (seconds)
       */
      saLifetimeWarnSeconds?: number;
      /**
       * @description Action on sequence number overflow
       * @enum {string}
       */
      seqOverflowAction?: "rekey" | "drop" | "continue";
      /**
       * Format: uint16
       * @description Maximum transmission unit for IPsec packets
       */
      mtu?: number;
      /** @description List of supported crypto algorithms */
      supportedAlgorithms?: string[];
      hwCapabilities?: {
        qatAvailable?: boolean;
        qatDevices?: number;
        dpaa2Available?: boolean;
      };
    };
    IPsecConfigMod: {
      /** @description Enable eBPF fast-path bypass */
      fastPathEnabled?: boolean;
      /** @description Enable hardware crypto offload */
      hwOffloadEnabled?: boolean;
      /**
       * @description Hardware offload type
       * @enum {string}
       */
      hwOffloadType?: "none" | "qat" | "dpaa2" | "inline";
      /** @description Enable anti-replay protection */
      antiReplayEnabled?: boolean;
      /**
       * Format: uint32
       * @description Warn before SA expiration (seconds)
       */
      saLifetimeWarnSeconds?: number;
      /**
       * @description Action on sequence number overflow
       * @enum {string}
       */
      seqOverflowAction?: "rekey" | "drop" | "continue";
      /**
       * Format: uint16
       * @description Maximum transmission unit
       */
      mtu?: number;
    };
    IPsecSelector: {
      /** @description Source CIDR (e.g., 10.0.0.0/24) */
      srcCidr?: string;
      /** @description Destination CIDR (e.g., 10.1.0.0/24) */
      dstCidr?: string;
      /**
       * Format: uint8
       * @description IP protocol (132 for SCTP, 0 for any)
       */
      protocol?: number;
      /**
       * Format: uint16
       * @description Source port (0 for any)
       */
      srcPort?: number;
      /**
       * Format: uint16
       * @description Destination port (0 for any)
       */
      dstPort?: number;
    };
    IPsecDPD: {
      /**
       * @description Dead Peer Detection action
       * @default restart
       * @enum {string}
       */
      action?: "restart" | "clear" | "hold";
      /**
       * Format: uint32
       * @description Seconds between DPD checks
       * @default 30
       */
      delay?: number;
      /**
       * Format: uint32
       * @description Timeout for DPD response
       * @default 150
       */
      timeout?: number;
    };
    IPsecTunnelMod: {
      /** @description Tunnel name (unique identifier) */
      name: string;
      /** @description Local gateway IP address */
      localIp: string;
      /** @description Remote gateway IP address */
      remoteIp: string;
      /**
       * @description Authentication mode (PSK or certificate)
       * @enum {string}
       */
      authMode: "psk" | "cert";
      /** @description Pre-shared key (required for PSK mode) */
      psk?: string;
      /** @description IKE local identifier */
      localId?: string;
      /** @description IKE remote identifier */
      remoteId?: string;
      /** @description Certificate name (required for cert mode) */
      certName?: string;
      /** @description CA certificate name (required for cert mode) */
      caCertName?: string;
      /**
       * @description IKE version
       * @default ikev2
       * @enum {string}
       */
      ikeVersion?: "ikev1" | "ikev2";
      /**
       * @description IKE encryption algorithm
       * @default aes256-sha256-modp2048
       */
      ikeEncryption?: string;
      /**
       * @description IKE integrity algorithm
       * @default sha256
       */
      ikeIntegrity?: string;
      /**
       * @description IKE DH group
       * @default modp2048
       */
      ikeDhGroup?: string;
      /**
       * Format: uint32
       * @description IKE lifetime in seconds
       * @default 28800
       */
      ikeLifetime?: number;
      /**
       * @description ESP encryption algorithm
       * @default aes256-sha256
       */
      espEncryption?: string;
      /**
       * @description ESP integrity algorithm
       * @default sha256
       */
      espIntegrity?: string;
      /**
       * @description ESP PFS DH group
       * @default modp2048
       */
      espDhGroup?: string;
      /**
       * Format: uint32
       * @description ESP lifetime in seconds
       * @default 3600
       */
      espLifetime?: number;
      /**
       * Format: uint32
       * @description Netfilter mark for VTI routing (0 = no mark)
       * @default 100
       */
      mark?: number;
      /**
       * @description IPsec mode (tunnel or transport)
       * @default tunnel
       * @enum {string}
       */
      tunnelMode?: "tunnel" | "transport";
      /**
       * @description Automatically install XFRM policies
       * @default true
       */
      installPolicy?: boolean;
      /**
       * @description Enable IP compression
       * @default false
       */
      compress?: boolean;
      /**
       * @description Enable MOBIKE (IKEv2 mobility)
       * @default false
       */
      mobike?: boolean;
      /**
       * @description Enable automatic rekeying
       * @default true
       */
      rekey?: boolean;
      /**
       * @description Re-authenticate on rekey (vs just rekey)
       * @default false
       */
      reauth?: boolean;
      /**
       * @description Connection startup mode - start (initiator/client), add (responder/server), route (on-demand)
       * @default start
       * @enum {string}
       */
      auto?: "start" | "add" | "route";
      selector?: components["schemas"]["IPsecSelector"];
      dpd?: components["schemas"]["IPsecDPD"];
    };
    IPsecTunnel: {
      name?: string;
      localIp?: string;
      remoteIp?: string;
      authMode?: string;
      localId?: string;
      remoteId?: string;
      certName?: string;
      caCertName?: string;
      ikeVersion?: string;
      ikeEncryption?: string;
      ikeIntegrity?: string;
      ikeDhGroup?: string;
      ikeLifetime?: number;
      espEncryption?: string;
      espIntegrity?: string;
      espDhGroup?: string;
      espLifetime?: number;
      /**
       * Format: uint32
       * @description Netfilter mark for VTI routing
       */
      mark?: number;
      /** @description IPsec mode (tunnel or transport) */
      tunnelMode?: string;
      /** @description Automatically install XFRM policies */
      installPolicy?: boolean;
      /** @description IP compression enabled */
      compress?: boolean;
      /** @description MOBIKE enabled */
      mobike?: boolean;
      /** @description Automatic rekeying enabled */
      rekey?: boolean;
      /** @description Re-authentication on rekey */
      reauth?: boolean;
      /**
       * @description Connection startup mode - start (initiator/client), add (responder/server), route (on-demand)
       * @enum {string}
       */
      auto?: "start" | "add" | "route";
      selector?: components["schemas"]["IPsecSelector"];
      dpd?: components["schemas"]["IPsecDPD"];
      /**
       * @description Tunnel state
       * @enum {string}
       */
      state?: "down" | "connecting" | "up";
      /**
       * Format: date-time
       * @description When tunnel was created
       */
      installedAt?: string;
      /**
       * Format: uint64
       * @description Bytes received
       */
      bytesIn?: number;
      /**
       * Format: uint64
       * @description Bytes transmitted
       */
      bytesOut?: number;
      /**
       * Format: uint64
       * @description Packets received
       */
      packetsIn?: number;
      /**
       * Format: uint64
       * @description Packets transmitted
       */
      packetsOut?: number;
      /**
       * Format: date-time
       * @description Last rekey time
       */
      lastRekeyAt?: string;
      /** @description Number of SAs installed */
      sasInstalled?: number;
    };
    IPsecSA: {
      /** @description Security Parameter Index */
      spi?: string;
      /** @description Associated tunnel name */
      tunnelName?: string;
      /**
       * @description SA direction
       * @enum {string}
       */
      direction?: "in" | "out";
      /** @description Local IP address */
      localIp?: string;
      /** @description Remote IP address */
      remoteIp?: string;
      /** @description Encryption algorithm */
      encryption?: string;
      /** @description Integrity algorithm */
      integrity?: string;
      /**
       * @description SA state
       * @enum {string}
       */
      state?: "active" | "expired" | "rekeying";
      /** Format: uint64 */
      bytesIn?: number;
      /** Format: uint64 */
      bytesOut?: number;
      /** Format: uint64 */
      packetsIn?: number;
      /** Format: uint64 */
      packetsOut?: number;
      /** Format: date-time */
      createdAt?: string;
      /** Format: date-time */
      expiresAt?: string;
      /** Format: uint64 */
      sequenceNumber?: number;
      /** Format: uint32 */
      replayWindow?: number;
    };
    IPsecStats: {
      totalTunnels?: number;
      tunnelsUp?: number;
      tunnelsDown?: number;
      totalSas?: number;
      /** Format: uint64 */
      totalBytesIn?: number;
      /** Format: uint64 */
      totalBytesOut?: number;
      /** Format: uint64 */
      totalPacketsIn?: number;
      /** Format: uint64 */
      totalPacketsOut?: number;
      /** Format: uint64 */
      encryptErrors?: number;
      /** Format: uint64 */
      decryptErrors?: number;
      /** Format: uint64 */
      authErrors?: number;
      /** Format: uint64 */
      replayErrors?: number;
      /** Format: uint64 */
      seqOverflows?: number;
      /** Format: date-time */
      lastUpdated?: string;
    };
    IPsecCertificateMod: {
      /** @description Certificate name (unique identifier) */
      name: string;
      /** @description PEM-encoded X.509 certificate */
      certificate: string;
      /** @description PEM-encoded private key */
      privateKey: string;
      /** @description Optional passphrase for encrypted private key */
      passphrase?: string;
      /** @description Optional description */
      description?: string;
    };
    IPsecCertificate: {
      name?: string;
      subject?: string;
      issuer?: string;
      serial?: string;
      /** Format: date-time */
      notBefore?: string;
      /** Format: date-time */
      notAfter?: string;
      /** @description Subject Alternative Names */
      san?: string[];
      /** @description Key usage extensions */
      keyUsage?: string[];
      /** Format: date-time */
      installedAt?: string;
      description?: string;
    };
    IPsecCertValidation: {
      valid?: boolean;
      errors?: string[];
      warnings?: string[];
      subject?: string;
      issuer?: string;
      /** Format: date-time */
      notBefore?: string;
      /** Format: date-time */
      notAfter?: string;
      keyAlgorithm?: string;
      keySize?: number;
    };
    IPsecCACertificateMod: {
      /** @description CA certificate name */
      name: string;
      /** @description PEM-encoded X.509 CA certificate */
      certificate: string;
      /** @description Optional description */
      description?: string;
    };
    IPsecCACertificate: {
      name?: string;
      subject?: string;
      issuer?: string;
      serial?: string;
      /** Format: date-time */
      notBefore?: string;
      /** Format: date-time */
      notAfter?: string;
      /** Format: date-time */
      installedAt?: string;
      description?: string;
    };
    OperParams: {
      /**
       * @description Set level to trace,debug,info,error,warning,notice,critical,emergency,alert
       * @enum {string}
       */
      logLevel: "trace" | "debug" | "info" | "error" | "warning" | "notice" | "critical" | "emergency" | "alert";
    };
    BGPNeigh: {
      /** @description BGP Neighbor IP address */
      ipAddress: string;
      /** @description Remote AS number */
      remoteAs: number;
      /** @description Remote Connect Port (default 179) */
      remotePort?: number;
      /** @description Enable multi-hop peering (if needed) */
      setMultiHop?: boolean;
    };
    BGPPolicyDefinedSetGetEntry: {
      /** @description BGP Defined set Entries */
      name: string;
      prefixList?: components["schemas"]["BGPPolicyPrefix"][];
      list?: string[];
    };
    BGPPolicyDefinedSetsMod: {
      /** @description BGP Neighbor IP address */
      name: string;
      List?: string[];
      prefixList?: components["schemas"]["BGPPolicyPrefix"][];
    };
    BGPPolicyPrefix: {
      /** @description BGP Neighbor IP address */
      ipPrefix?: string;
      /** @description Remote AS number */
      masklengthRange?: string;
    };
    BGPPolicyDefinitionsMod: {
      /** @description BGP Neighbor IP address */
      name?: string;
      statements?: components["schemas"]["BGPPolicyDefinitionsStatement"][];
    };
    BGPPolicyDefinitionsStatement: {
      name?: string;
      conditions?: {
        bgpConditions?: {
          afiSafiIn?: string[];
          asPathLength?: {
            operator?: string;
            value?: number;
          };
          matchAsPathSet?: {
            asPathSet?: string;
            matchSetOptions?: string;
          };
          matchCommunitySet?: {
            communitySet?: string;
            matchSetOptions?: string;
          };
          matchExtCommunitySet?: {
            communitySet?: string;
            matchSetOptions?: string;
          };
          matchLargeCommunitySet?: {
            communitySet?: string;
            matchSetOptions?: string;
          };
          nextHopInList?: string[];
          rpki?: string;
          routeType?: string;
        };
        matchNeighborSet?: {
          matchSetOption?: string;
          neighborSet?: string;
        };
        matchPrefixSet?: {
          matchSetOption?: string;
          prefixSet?: string;
        };
      };
      actions?: {
        routeDisposition?: string;
        bgpActions?: {
          setMed?: string;
          setNextHop?: string;
          setLocalPerf?: number;
          setCommunity?: {
            options?: string;
            setCommunityMethod?: string[];
          };
          setExtCommunity?: {
            options?: string;
            setCommunityMethod?: string[];
          };
          setLargeCommunity?: {
            options?: string;
            setCommunityMethod?: string[];
          };
          setAsPathPrepend?: {
            as?: string;
            repeatN?: number;
          };
        };
      };
    };
    BGPApplyPolicyToNeighborMod: {
      /** @description BGP Neighbor IP address */
      ipAddress: string;
      /** @enum {string} */
      policyType: "import" | "export";
      policies?: string[];
      /** @enum {string} */
      routeAction: "accept" | "reject";
    };
    BGPNeighGetEntry: {
      /** @description BGP Neighbor IP address */
      ipAddress?: string;
      /** @description Remote AS number */
      remoteAs?: number;
      /** @description Current state */
      state?: string;
      /** @description Current uptime */
      updowntime?: string;
    };
    BGPGlobalConfig: {
      /** @description BGP Router ID */
      routerId: string;
      /** @description Local AS number */
      localAs: number;
      /** @description Adds policy to set next hop as self, if enabled */
      SetNextHopSelf?: boolean;
      /** @description Listen port (default 179) */
      listenPort?: number;
    };
    BfdGetEntry: {
      /** @description Instance name */
      instance?: string;
      /** @description Remote IP */
      remoteIp?: string;
      /** @description Source IP to be used for BFD session */
      sourceIP?: string;
      /**
       * Format: uint16
       * @description port number to be used for BFD session
       */
      port?: number;
      /**
       * Format: uint64
       * @description Tx interval between BFD packets(in microseconds)
       */
      interval?: number;
      /**
       * Format: uint8
       * @description Retry Count to detect failure
       */
      retryCount?: number;
      /** @description Current state for BFD session */
      state?: string;
    };
    VersionGetEntry: {
      /** @description Instance name */
      version?: string;
      /** @description build info */
      buildInfo?: string;
    };
    BfdEntry: {
      /** @description Instance name running BFD session */
      instance?: string;
      /** @description Remote IP */
      remoteIp?: string;
      /** @description Remote IP */
      sourceIp?: string;
      /**
       * Format: uint64
       * @description Tx interval between BFD packets(in microseconds)
       */
      interval?: number;
      /**
       * Format: uint8
       * @description Retry Count to detect failure
       */
      retryCount?: number;
    };
    MetricsConfig: {
      /** @description value for prometheus enable or not */
      prometheus: boolean;
    };
    MetricEntity: {
      /** @description Metric Name */
      name?: string;
      /**
       * Format: uint64
       * @description Metric Value
       */
      value?: number;
      /** @description Load Balancer Service Name */
      service?: string;
    };
    ErrorResponse: {
      message?: string;
    };
    HealthCheckResponse: {
      status?: string;
    };
    LoginResponse: {
      token?: string;
    };
    MessageResponse: {
      message?: string;
    };
    SuccessResponse: {
      message?: string;
    };
    User: {
      created_at?: string;
      id?: number;
      password: string;
      username: string;
      /** @enum {string} */
      role?: "admin" | "viewer";
    };
    FlowCountMetrics: {
      active_conntrack_count?: number;
      active_flow_count_tcp?: number;
      active_flow_count_udp?: number;
      active_flow_count_sctp?: number;
      inactive_flow_count?: number;
    };
    HostCountMetrics: {
      healthy_host_count?: number;
      unhealthy_host_count?: number;
    };
    LbRuleCountMetrics: {
      lb_rule_count?: number;
    };
    NewFlowCountMetrics: {
      new_flow_count?: number;
    };
    RequestCountMetrics: {
      total_requests?: number;
      total_requests_per_service?: {
          name?: string;
          value?: number;
        }[];
    };
    ErrorCountMetrics: {
      total_errors?: number;
      total_errors_per_service?: {
          name?: string;
          value?: number;
        }[];
    };
    ProcessedTrafficMetrics: {
      processed_bytes?: number;
      processed_tcp_bytes?: number;
      processed_sctp_bytes?: number;
      processed_udp_bytes?: number;
      processed_packets?: number;
    };
    LbProcessedTrafficMetrics: {
      lb_rule_interaction_bytes?: {
          service?: string;
          sip?: string;
          dip?: string;
          value?: number;
        }[];
      lb_rule_interaction_packets?: {
          service?: string;
          sip?: string;
          dip?: string;
          value?: number;
        }[];
    };
    EpDistTrafficMetrics: {
      [key: string]: {
          dip?: string;
          value?: number;
          ratio?: number;
        }[];
    };
    ServiceDistTrafficMetrics: {
      [key: string]: {
        value?: number;
        ratio?: number;
      };
    };
    FwDropsMetrics: {
      total_fw_drops?: number;
      total_fw_drops_per_rule?: {
          fw_rule?: string;
          value?: number;
        }[];
    };
    ReqCountPerClientMetrics: {
      [key: string]: number;
    };
    Logs: {
      /** @description List of filtered logs. */
      logs?: string[];
      /** @description Name of the log file the lines were read from. */
      log_file?: string;
      /** @description Number of log lines returned in this page. */
      log_count?: number;
      /**
       * Format: int64
       * @description Total size of the log file in bytes.
       */
      total_size?: number;
      /** @description Whether more log lines are available (pass next_cursor to fetch them). */
      has_more?: boolean;
      /** @description Opaque cursor for the next page; present only when has_more is true. */
      next_cursor?: string;
    };
    LogArchives: {
      /** @description List of log archive filenames. */
      archives?: string[];
    };
    NodeGraphShcmea: {
      schemaVersion?: number;
      meta?: {
        preferredVisualisationType?: string;
      };
      nodes?: components["schemas"]["Node"][];
      edges?: components["schemas"]["Edge"][];
    };
    Node: {
      id?: string;
      title?: string;
      subtitle?: string;
      mainstat?: number;
      secondarystat?: number;
      color?: string;
      icon?: string;
      nodeRadius?: number;
    };
    Edge: {
      id?: string;
      source?: string;
      target?: string;
      mainstat?: number;
      secondarystat?: number;
      thickness?: number;
      color?: string;
    };
    OauthMessageResponse: {
      message?: string;
    };
    OauthErrorResponse: {
      message?: string;
    };
    OauthLoginResponse: {
      /** @description The unique identifier for the authenticated user (e.g., Google user ID). */
      id?: string;
      /** @description The access token used for API requests. Typically expires after a short duration. */
      token?: string;
      /** @description The refresh token used to obtain new access tokens once the current one expires. */
      refreshtoken?: string;
      /** @description The duration in seconds that the access token is valid for. */
      expiresin?: number;
    };
    OauthTokenResponse: {
      /** @description The access token used for API requests. Typically expires after a short duration. */
      token?: string;
      /** @description The duration in seconds that the access token is valid for. */
      expiresin?: number;
    };
    CorsEntry: {
      /** @description Interface device name */
      cors?: string[];
    };
    UpdateLicenseRequest: {
      license_key: string;
    };
    GPUMonitoringStatus: {
      /** @description Whether GPU monitoring is currently active */
      enabled?: boolean;
      /** @description Current routing mode (standard_chwbl or gpu_aware) */
      routing_mode?: string;
      /** @description Number of workers being tracked */
      worker_count?: number;
      /**
       * Format: date-time
       * @description Timestamp of last metrics update
       */
      last_metrics_update?: string;
      /** @description Whether eBPF maps are loaded */
      ebpf_map_loaded?: boolean;
    };
    WorkerMetricsEntry: {
      /** @description Worker endpoint IP:port (e.g., "192.168.1.10:8000") */
      endpoint_ip: string;
      /** @description vllm:num_requests_running + vllm:num_requests_waiting (total queue depth) */
      queued_requests: number;
      /** @description Delta of vllm:num_preemptions_total since last update */
      swapped_requests?: number;
      /** @description vllm:gpu_cache_usage_perc * 100 (0-100 scale) */
      kv_cache_usage_perc: number;
      /** @description Static config from vllm:cache_config_info{num_gpu_blocks} */
      num_gpu_blocks?: number;
      /**
       * Format: date-time
       * @description Timestamp of metrics collection
       */
      timestamp?: string;
    };
    WorkerMetricsResponse: {
      workers?: components["schemas"]["WorkerMetricsEntry"][];
      /** @description Whether GPU monitoring is enabled */
      monitoring_enabled?: boolean;
    };
    GPUEnableResponse: {
      /** @description Whether GPU monitoring is now enabled */
      enabled: boolean;
      /** @description Current routing mode (gpu_aware or standard_chwbl) */
      routing_mode: string;
      /** @description Status message */
      message: string;
    };
    WorkerMetricsUpdateResponse: {
      /** @description Worker endpoint that was updated */
      endpoint_ip: string;
      /** @description Number of queued requests (for confirmation) */
      queued_requests: number;
      /** @description Status message */
      message: string;
    };
    ConversationCleanupResponse: {
      /** @description Number of conversations deleted */
      deleted_count: number;
      /**
       * Format: float
       * @description Age in hours of oldest remaining conversation
       */
      oldest_remaining_hours: number;
      /** @description Status message */
      message: string;
    };
    SNICertificateEntry: {
      /** @description Hostname for SNI certificate (e.g., api.example.com). This certificate will be automatically used by all loadbalancer rules that have matching 'host' field. */
      hostname: string;
      /** @description Optional certificate directory path (defaults to /opt/loxilb/cert/{hostname}). Directory must contain server.crt, server.key, and optionally rootCA.crt for mTLS. */
      certPath?: string;
    };
    Cert: {
      /** @description Opaque certificate management handle. Client-supplied verbatim or server-minted when absent. Stable across rotation (PUT). Max 63 chars; no path separators. */
      certId?: string | null;
      /** @description Leaf (server) certificate in PEM. Required on POST/PUT. Try-parsed as X.509 — malformed PEM is rejected with 400. */
      certPem: string | null;
      /** @description Private key in PEM. Required on POST/PUT. Persisted 0600 (key-at-rest). Never returned on GET. */
      keyPem: string | null;
      /** @description Optional intermediate-chain PEM appended after the leaf. */
      chainPem?: string;
      /** @description Output-only. SAN-DNS/CN auto-derived hostnames the certId registered into the SNI store. Ignored on POST/PUT. */
      hostnames?: string[];
    };
    TraceCatalogEntry: {
      /**
       * @description Catalog name (from YAML filename without .yaml extension)
       * @example openai
       */
      name: string;
      /**
       * @description Parser assigned to this catalog
       * @example openai
       */
      parser_type: string;
      /**
       * Format: int32
       * @description Percentage of requests to trace (0-100)
       * @example 100
       */
      sample_rate: number;
      /**
       * Format: int32
       * @description Maximum request/response body size to capture (bytes, 0=unlimited)
       * @example 65536
       */
      max_body_size?: number;
      /**
       * @description Whether this catalog is currently active
       * @example true
       */
      enabled: boolean;
      /**
       * @description Catalog version for compatibility
       * @example 1.0
       */
      version?: string;
      /**
       * @description Human-readable description
       * @example OpenAI API tracing catalog
       */
      description?: string;
    };
    TraceParserInfo: {
      /**
       * @description Parser identifier (e.g., "openai", "mcp", "mock")
       * @example openai
       */
      name: string;
      /**
       * @description Parser version
       * @example 1.0.0
       */
      version: string;
      /**
       * @description Protocol handled by parser
       * @example OpenAI API v1
       */
      protocol: string;
      /**
       * @description URL paths this parser handles
       * @example [
       *   "/v1/chat/completions",
       *   "/v1/completions",
       *   "/v1/embeddings"
       * ]
       */
      supported_paths?: string[];
      /**
       * @description Human-readable description
       * @example Parses OpenAI API requests including GPT models, token usage, and streaming responses
       */
      description?: string;
      /**
       * @description Supported features
       * @example [
       *   "streaming",
       *   "cost_estimation",
       *   "tool_calls"
       * ]
       */
      capabilities?: string[];
    };
    CatalogParserMapping: {
      /**
       * @description Catalog ID
       * @example 1
       */
      catalog_id: number;
      /**
       * @description Catalog name from YAML
       * @example v1
       */
      catalog_name?: string;
      /**
       * @description Currently assigned parser
       * @example openai
       */
      parser_name?: string;
      /**
       * @description Parser type from YAML configuration
       * @example openai
       */
      parser_type?: string;
    };
    TraceParserUpdate: {
      /**
       * @description Parser to assign to catalog (must match registered parser name)
       * @example openai
       * @enum {string}
       */
      parser_name: "openai" | "mcp" | "mock";
    };
    L4TraceStats: {
      /**
       * Format: int64
       * @description Total L4 events emitted
       * @example 15234
       */
      total_events?: number;
      /**
       * Format: int64
       * @description Events that passed sampling
       * @example 15234
       */
      sampled_events?: number;
      /**
       * Format: int64
       * @description Ring buffer overflows
       * @example 12
       */
      dropped_events?: number;
      /**
       * Format: int64
       * @description TCP state changes
       * @example 12500
       */
      tcp_events?: number;
      /**
       * Format: int64
       * @description SCTP state changes
       * @example 2734
       */
      sctp_events?: number;
      /**
       * Format: int64
       * @description UDP state changes
       * @example 5678
       */
      udp_events?: number;
      /**
       * Format: int64
       * @description New connections
       * @example 1523
       */
      conn_new?: number;
      /**
       * Format: int64
       * @description Established connections
       * @example 1520
       */
      conn_established?: number;
      /**
       * Format: int64
       * @description Clean closes
       * @example 1450
       */
      conn_closed?: number;
      /**
       * Format: int64
       * @description Timeout closes
       * @example 45
       */
      conn_timeout?: number;
      /**
       * Format: int64
       * @description RST/ABORT closes
       * @example 28
       */
      conn_reset?: number;
      /**
       * Format: int64
       * @description Error events
       * @example 2
       */
      conn_error?: number;
    };
    L4TraceStatusResponse: {
      /**
       * @description Whether L4 tracing is enabled
       * @example true
       */
      enabled?: boolean;
      /**
       * Format: int64
       * @description Current sampling rate (0-100)
       * @example 100
       */
      sampling_rate?: number;
      /**
       * Format: int64
       * @description Configuration version number
       * @example 5
       */
      config_version?: number;
      stats?: components["schemas"]["L4TraceStats"];
    };
    PIIConfigEntry: {
      /**
       * @description Detection mode (detect, mask, redact, anonymize)
       * @example mask
       * @enum {string}
       */
      mode?: "detect" | "mask" | "redact" | "anonymize";
      /**
       * @description Scan direction (both, request, response)
       * @example both
       * @enum {string}
       */
      direction?: "both" | "request" | "response";
      /**
       * @description Behavior when Presidio is unavailable (open, closed)
       * @example open
       * @enum {string}
       */
      fail_mode?: "open" | "closed";
      /**
       * @description Large body handling (full=skip if too large, truncate=scan first 64KB)
       * @example truncate
       * @enum {string}
       */
      scan_mode?: "full" | "truncate";
      /**
       * @description Presidio analyzer gRPC endpoint
       * @example localhost:50051
       */
      analyzer_url?: string;
      /**
       * @description Presidio anonymizer gRPC endpoint (optional)
       * @example localhost:50051
       */
      anonymizer_url?: string;
      /**
       * Format: float
       * @description Minimum confidence score for PII detection (0.0-1.0)
       * @example 0.7
       */
      score_threshold?: number;
      /**
       * Format: int64
       * @description Presidio request timeout in milliseconds
       * @example 100
       */
      timeout_ms?: number;
      /**
       * Format: int64
       * @description Maximum HTTP body size to scan (bytes)
       * @example 65536
       */
      max_body_size?: number;
      /**
       * Format: int64
       * @description Minimum HTTP body size to scan (bytes)
       * @example 100
       */
      min_body_size?: number;
      circuit_breaker?: components["schemas"]["PIICircuitBreaker"];
      retry?: components["schemas"]["PIIRetry"];
      /**
       * @description Enable Presidio v2 API (combined analyze+anonymize, 40% faster)
       * @example true
       */
      enable_v2?: boolean;
      /**
       * @description Default anonymization operator for v2
       * @example encrypt
       * @enum {string}
       */
      default_operator?: "replace" | "redact" | "hash" | "mask" | "encrypt";
      /**
       * @description Base64-encoded encryption key for v2 (AES-256, 32 bytes)
       * @example YourBase64EncodedKey32BytesLong=
       */
      encryption_key?: string;
      /**
       * Format: int64
       * @description Batch size for v2 streaming API
       * @example 10
       */
      batch_size?: number;
    };
    PIICircuitBreaker: {
      /**
       * Format: int64
       * @description Number of failures before opening circuit
       * @example 5
       */
      threshold?: number;
      /**
       * Format: int64
       * @description Time to wait before attempting half-open (seconds)
       * @example 60
       */
      timeout_sec?: number;
      /**
       * Format: int64
       * @description Number of successes needed to close circuit
       * @example 3
       */
      success_threshold?: number;
    };
    PIIRetry: {
      /**
       * Format: int64
       * @description Maximum number of retry attempts
       * @example 1
       */
      max_retries?: number;
      /**
       * Format: int64
       * @description Backoff time between retries (milliseconds)
       * @example 100
       */
      backoff_ms?: number;
    };
    PIIURLPatternsEntry: {
      /**
       * @description Pattern update mode (add, replace, clear)
       * @example replace
       * @enum {string}
       */
      mode: "add" | "replace" | "clear";
      /** @description List of URL patterns (max 64) */
      patterns?: components["schemas"]["PIIURLPattern"][];
    };
    PIIURLPattern: {
      /**
       * @description URL pattern with wildcards (e.g., /v1/chat/*, /api/*)
       * @example /v1/chat/*
       */
      pattern: string;
      /**
       * @description Exclude pattern (true) or include pattern (false)
       * @example false
       */
      is_exclude?: boolean;
    };
    PIIStatusResponse: {
      /**
       * @description Whether PII detection is enabled
       * @example true
       */
      enabled?: boolean;
      /**
       * @description Current detection mode
       * @example mask
       */
      mode?: string;
      /**
       * @description Current scan direction
       * @example both
       */
      direction?: string;
      /**
       * @description Current fail mode
       * @example open
       */
      fail_mode?: string;
      /**
       * @description Current large body handling mode
       * @example truncate
       */
      scan_mode?: string;
      /**
       * @description Analyzer endpoint
       * @example localhost:50051
       */
      analyzer_url?: string;
      /**
       * @description Anonymizer endpoint
       * @example localhost:50051
       */
      anonymizer_url?: string;
      /**
       * Format: float
       * @description Current confidence threshold
       * @example 0.7
       */
      score_threshold?: number;
      /**
       * Format: int64
       * @description Request timeout
       * @example 100
       */
      timeout_ms?: number;
      /**
       * Format: int64
       * @description Maximum body size to scan
       * @example 65536
       */
      max_body_size?: number;
      /**
       * Format: int64
       * @description Minimum body size to scan
       * @example 100
       */
      min_body_size?: number;
      circuit_breaker?: components["schemas"]["PIICircuitBreaker"];
      retry?: components["schemas"]["PIIRetry"];
      /** @description Current URL patterns */
      url_patterns?: components["schemas"]["PIIURLPattern"][];
      /**
       * Format: int64
       * @description Number of configured URL patterns
       * @example 3
       */
      url_pattern_count?: number;
    };
    PIIStatsResponse: {
      /**
       * Format: int64
       * @description Total number of PII scans performed
       * @example 1523
       */
      total_scans?: number;
      /**
       * Format: int64
       * @description Number of requests with PII detected
       * @example 245
       */
      pii_detected?: number;
      /**
       * Format: int64
       * @description Number of requests blocked due to PII
       * @example 12
       */
      pii_blocked?: number;
      /**
       * Format: int64
       * @description Number of scan errors
       * @example 8
       */
      errors?: number;
    };
    LlamaFirewallConfigEntry: {
      /**
       * @description LlamaFirewall gRPC server URL
       * @example localhost:50052
       */
      server_url?: string;
      /**
       * Format: int64
       * @description Request timeout in seconds (for ML models)
       * @example 15
       */
      timeout_sec?: number | null;
      /**
       * @description Fail-closed (true=block on error) vs fail-open (false=allow on error)
       * @example false
       */
      fail_closed?: boolean | null;
      /**
       * Format: float
       * @description Minimum confidence score to block (0.0-1.0)
       * @example 0.9
       */
      block_threshold?: number | null;
      /**
       * @description Enable response caching for identical requests
       * @example true
       */
      cache_enabled?: boolean | null;
      /**
       * Format: int64
       * @description Cache TTL in seconds
       * @example 300
       */
      cache_ttl_sec?: number | null;
      /**
       * Format: int64
       * @description Number of reusable gRPC connections
       * @example 10
       */
      connection_pool_size?: number | null;
      /**
       * @description URL patterns to scan (empty = scan all)
       * @example [
       *   "/api/v1/chat*",
       *   "/api/*\/code"
       * ]
       */
      scan_patterns?: string[];
      /**
       * @description URL patterns to skip scanning
       * @example [
       *   "/health",
       *   "/metrics"
       * ]
       */
      skip_patterns?: string[];
    };
    LlamaFirewallScannersEntry: {
      /**
       * @description Enable PromptGuard (ML-based prompt injection detection)
       * @example true
       */
      prompt_guard?: boolean | null;
      /**
       * @description Enable CodeShield (insecure code pattern detection)
       * @example true
       */
      code_shield?: boolean | null;
      /**
       * @description Enable Regex (credential/API key leak detection)
       * @example true
       */
      regex?: boolean | null;
      /**
       * @description Enable HiddenASCII (zero-width/invisible character detection)
       * @example true
       */
      hidden_ascii?: boolean | null;
      /**
       * @description Enable AgentAlignment (AI agent misalignment detection)
       * @example false
       */
      agent_alignment?: boolean | null;
      /**
       * @description Enable PII Detection (complementary to Presidio)
       * @example false
       */
      pii_detection?: boolean | null;
    };
    LlamaFirewallStatusResponse: {
      /**
       * @description Whether LlamaFirewall scanning is enabled
       * @example true
       */
      enabled?: boolean;
      /**
       * @description Configured server URL
       * @example localhost:50052
       */
      server_url?: string;
      /**
       * @description Connection status to gRPC server
       * @example true
       */
      connected?: boolean;
      /**
       * @description Current fail policy
       * @example false
       */
      fail_closed?: boolean;
      /**
       * Format: float
       * @description Current block threshold
       * @example 0.9
       */
      block_threshold?: number;
      scanners?: components["schemas"]["LlamaFirewallScannersStatus"];
      /**
       * @description Cache status
       * @example true
       */
      cache_enabled?: boolean;
      /**
       * Format: int64
       * @description Cache TTL
       * @example 300
       */
      cache_ttl_sec?: number;
      /** @description Active scan patterns */
      scan_patterns?: string[];
      /** @description Active skip patterns */
      skip_patterns?: string[];
      /**
       * @description Last health check timestamp (RFC3339)
       * @example 2025-01-10T10:30:00Z
       */
      last_health_check?: string;
    };
    LlamaFirewallScannersStatus: {
      /**
       * @description PromptGuard enabled
       * @example true
       */
      prompt_guard?: boolean;
      /**
       * @description CodeShield enabled
       * @example true
       */
      code_shield?: boolean;
      /**
       * @description Regex enabled
       * @example true
       */
      regex?: boolean;
      /**
       * @description HiddenASCII enabled
       * @example true
       */
      hidden_ascii?: boolean;
      /**
       * @description AgentAlignment enabled
       * @example false
       */
      agent_alignment?: boolean;
      /**
       * @description PII Detection enabled
       * @example false
       */
      pii_detection?: boolean;
    };
    LlamaFirewallStatsResponse: {
      /**
       * Format: int64
       * @description Total number of scans performed
       * @example 2456
       */
      total_scans?: number;
      /**
       * Format: int64
       * @description User requests scanned (PromptGuard+Regex)
       * @example 1523
       */
      requests_scanned?: number;
      /**
       * Format: int64
       * @description AI responses scanned (CodeShield+Regex)
       * @example 933
       */
      responses_scanned?: number;
      /**
       * Format: int64
       * @description Total threats detected across all scanners
       * @example 47
       */
      threats_detected?: number;
      /**
       * Format: int64
       * @description Requests blocked due to threats
       * @example 12
       */
      requests_blocked?: number;
      /**
       * Format: int64
       * @description Number of scan errors
       * @example 3
       */
      scan_errors?: number;
      /**
       * Format: int64
       * @description Average scan latency in milliseconds
       * @example 85
       */
      avg_latency_ms?: number;
      /**
       * Format: int64
       * @description Number of cache hits
       * @example 542
       */
      cache_hits?: number;
      scanner_stats?: components["schemas"]["LlamaFirewallScannerStats"];
      decisions?: components["schemas"]["LlamaFirewallDecisionStats"];
    };
    LlamaFirewallScannerStats: {
      prompt_guard?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      code_shield?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      regex?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      hidden_ascii?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      agent_alignment?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      pii_detection?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
    };
    LlamaFirewallIndividualScannerStats: {
      /**
       * Format: int64
       * @description Number of scans by this scanner
       * @example 1523
       */
      scans?: number;
      /**
       * Format: int64
       * @description Threats detected by this scanner
       * @example 15
       */
      detections?: number;
      /**
       * Format: int64
       * @description Average latency for this scanner
       * @example 45
       */
      avg_latency_ms?: number;
      /**
       * Format: int64
       * @description Errors from this scanner
       * @example 1
       */
      errors?: number;
    };
    LlamaFirewallDecisionStats: {
      /**
       * Format: int64
       * @description Number of ALLOW decisions
       * @example 2397
       */
      allow?: number;
      /**
       * Format: int64
       * @description Number of BLOCK decisions
       * @example 12
       */
      block?: number;
      /**
       * Format: int64
       * @description Number of Human-In-The-Loop decisions
       * @example 47
       */
      hitl?: number;
    };
    LlamaFirewallHealthResponse: {
      /**
       * @description Overall health status
       * @example true
       */
      healthy?: boolean;
      /**
       * @description Server URL checked
       * @example localhost:50052
       */
      server_url?: string;
      /**
       * @description Connection status
       * @example true
       */
      connected?: boolean;
      /**
       * Format: int64
       * @description Health check latency
       * @example 12
       */
      latency_ms?: number;
      /**
       * @description Health check message
       * @example LlamaFirewall server is healthy
       */
      message?: string;
      /**
       * @description Health check timestamp (RFC3339)
       * @example 2025-01-10T10:30:00Z
       */
      timestamp?: string;
    };
    ApiKeyCreateRequest: {
      /** @description Tenant identifier that owns this key */
      tenant_id: string;
      /** @description Human-readable label for the API key */
      name?: string;
      /** @description List of model identifiers this key may access */
      allowed_models?: string[];
      /**
       * Format: int64
       * @description Maximum requests per second allowed for this key
       */
      rate_limit_rps?: number;
      /**
       * Format: int64
       * @description Burst capacity above the steady-state RPS limit
       */
      burst_size?: number;
      /**
       * Format: int64
       * @description Maximum LLM tokens per minute for this key
       */
      tokens_per_min?: number;
      /**
       * Format: date-time
       * @description Optional expiry timestamp (RFC3339)
       */
      expires_at?: string;
      /** @description Whether the API key is active. Absent = enabled (optional, nullable to distinguish unset). */
      enabled?: boolean | null;
    };
    ApiKeyCreateResponse: {
      /** @description The plaintext API key — returned ONLY at creation time */
      raw_key: string;
      /** @description Unique identifier of the created API key */
      key_id?: string;
    };
    ApiKeySummary: {
      /** @description Unique identifier of the API key */
      key_id?: string;
      /** @description Tenant that owns this key */
      tenant_id?: string;
      /** @description Human-readable label for the API key */
      name?: string;
      /** @description List of model identifiers this key may access */
      allowed_models?: string[];
      /**
       * Format: int64
       * @description Maximum requests per second allowed for this key
       */
      rate_limit_rps?: number;
      /**
       * Format: int64
       * @description Burst capacity above the steady-state RPS limit
       */
      burst_size?: number;
      /**
       * Format: int64
       * @description Maximum LLM tokens per minute for this key
       */
      tokens_per_min?: number;
      /**
       * Format: date-time
       * @description Timestamp when the key was created
       */
      created_at?: string;
      /**
       * Format: date-time
       * @description Optional expiry timestamp (RFC3339)
       */
      expires_at?: string;
      /** @description Whether this key is currently active */
      enabled?: boolean;
    };
    TenantRateLimitMod: {
      /** @description Tenant identifier */
      tenant_id: string;
      /**
       * Format: int64
       * @description Maximum requests per second for the tenant
       */
      rps?: number;
      /**
       * Format: int64
       * @description Maximum LLM tokens per minute for the tenant
       */
      tokens_per_min?: number;
    };
    TenantRateLimitEntry: {
      /** @description Tenant identifier */
      tenant_id: string;
      /**
       * Format: int64
       * @description Maximum requests per second for the tenant
       */
      rps?: number;
      /**
       * Format: int64
       * @description Maximum LLM tokens per minute for the tenant
       */
      tokens_per_min?: number;
      /**
       * Format: date-time
       * @description Timestamp of the last rate limit update
       */
      updated_at?: string;
    };
    OPAWatcherConfig: {
      /** @description OPA server URL (e.g. http://opa:8181) */
      opa_url: string;
      /**
       * @description OPA policy path to query
       * @default loxilb/l4
       */
      policy_path?: string;
      /**
       * @description Polling interval in seconds
       * @default 30
       */
      poll_interval_sec?: number;
      /**
       * @description Allow traffic when OPA is unreachable
       * @default false
       */
      fail_open?: boolean;
    };
    OPAWatcherStatus: {
      /** @description Configured OPA server URL */
      opa_url?: string;
      /** @description Configured OPA policy path */
      policy_path?: string;
      /** @description Configured polling interval in seconds */
      poll_interval_sec?: number;
      /** @description Fail-open setting */
      fail_open?: boolean;
      /** @description Current watcher status (running, stopped, not_configured) */
      status?: string;
      /**
       * Format: date-time
       * @description Timestamp of last successful sync
       */
      last_sync_at?: string;
      /** @description Number of active firewall rules */
      rules_count?: number;
      /** @description Circuit breaker state (0=closed, 1=half-open, 2=open) */
      circuit_breaker_state?: number;
      /** @description Last error message if any */
      last_error?: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: {
    /** @description User data */
    User: {
      content: {
        "application/json": components["schemas"]["User"];
      };
    };
    /** @description Attributes of bgp neighbor */
    BGPApplyPolicyToNeighborMod: {
      content: {
        "application/json": components["schemas"]["BGPApplyPolicyToNeighborMod"];
      };
    };
  };
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export interface operations {

  /**
   * Get metadata for all POST APIs
   * @description Returns metadata about required fields for each POST API.
   */
  getMeta: {
    responses: {
      /** @description Successfully retrieved metadata */
      200: {
        content: {
          "application/json": {
            [key: string]: unknown;
          };
        };
      };
      /** @description Internal Server Error */
      500: {
        content: never;
      };
    };
  };
  /**
   * Get a Load balancer service by composite key
   * @description Returns a single load balancer rule identified by its VIP/port/protocol composite key (Octavia).
   */
  getConfigLoadbalancerExternalipaddressIPAddressPortPortProtocolProto: {
    parameters: {
      path: {
        /** @description External (VIP) IP address of the load balancer service */
        ip_address: string;
        /** @description Service port of the load balancer service */
        port: number;
        /** @description Protocol of the load balancer service (tcp/udp/sctp) */
        proto: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["LoadbalanceEntry"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Patch an existing Load balancer service (RFC 7386 JSON merge-patch)
   * @description Apply an RFC 7386 JSON merge-patch to an existing load balancer rule identified by its VIP/port/protocol composite key (Octavia). Fields present in the body are overwritten, absent fields are left untouched, and an explicit null clears a clearable field. Immutable fields (security, egress, mode, protocol, VIP composite key) are rejected with 400. Returns 200 if the target rule exists, 404 if it is absent. The rule is mutated in place; established connections are not dropped.
   */
  patchConfigLoadbalancerExternalipaddressIPAddressPortPortProtocolProto: {
    parameters: {
      path: {
        /** @description External (VIP) IP address of the load balancer service */
        ip_address: string;
        /** @description Service port of the load balancer service */
        port: number;
        /** @description Protocol of the load balancer service (tcp/udp/sctp) */
        proto: string;
      };
    };
    /** @description RFC 7386 merge-patch document over the load balancer service */
    requestBody: {
      content: {
        "application/merge-patch+json": components["schemas"]["LoadbalanceEntry"];
        "application/json": components["schemas"]["LoadbalanceEntry"];
      };
    };
    responses: {
      /** @description Updated */
      200: {
        content: never;
      };
      /** @description Malformed merge-patch body or attempt to modify an immutable field */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get a Load balancer service by opaque id
   * @description Returns a single load balancer rule identified by its stable opaque id (Octavia).
   */
  getConfigLoadbalancerID: {
    parameters: {
      path: {
        /** @description Stable opaque identifier of the load balancer rule */
        id: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["LoadbalanceEntry"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /** Get all L7 content-routing policies */
  getConfigL7PolicyAll: {
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["L7PolicyGetEntry"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Create an L7 content-routing policy
   * @description Creates a dedicated L7_POLICY resource (policy + ordered child rules) and attaches it to an existing L4 load-balancer referenced by its stable opaque id. The body is validated server-side with Octavia per-type rules (FILE_TYPE only EQUAL_TO/REGEX; key required for HEADER/COOKIE/QUERY; redirect statusCode allow-list default 302; REJECT default 403; REGEX patterns try-compiled at config time) and translated to the internal route IR, then carried to the running sockproxy by a SEPARATE attach call (proxy_attach_l7_policy) — NEVER inline on the 4096-byte proxy_arg.
   */
  postConfigL7Policy: {
    /** @description L7 policy attributes */
    requestBody: {
      content: {
        "application/json": components["schemas"]["L7Policy"];
      };
    };
    responses: {
      /** @description OK */
      204: {
        content: never;
      };
      /** @description Malformed arguments (failed Octavia validation or unrepresentable export) */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Referenced load-balancer not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /** Get a single L7 content-routing policy by id */
  getConfigL7PolicyID: {
    parameters: {
      path: {
        /** @description Stable opaque identifier of the L7 policy */
        id: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["L7Policy"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Delete an L7 content-routing policy by id
   * @description Detaches the policy from its load-balancer (proxy_detach_l7_policy regfrees every compiled REGEX) and removes the resource.
   */
  deleteConfigL7PolicyID: {
    parameters: {
      path: {
        /** @description Stable opaque identifier of the L7 policy */
        id: string;
      };
    };
    responses: {
      /** @description OK */
      204: {
        content: never;
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Upload a TLS certificate under an opaque certId
   * @description Uploads inline PEM material (cert + key [+ chain]) under an opaque certId — the canonical TLS-material store. The handler persists the PEM to the managed dir (/etc/loxilb/certs/<certId>/, 0700 dir / 0600 key) and registers it via the C certId registry, which auto-derives the hostname(s) from the leaf cert SAN/CN and registers them into the hostname-keyed SNI store. Selection at handshake stays by hostname; certId is the upload/rotate/delete handle. When certId is absent the server mints one. Malformed PEM / missing key is rejected with 400 (never a panic).
   */
  postConfigCert: {
    /** @description Certificate attributes (certId optional; inline PEM) */
    requestBody: {
      content: {
        "application/json": components["schemas"]["Cert"];
      };
    };
    responses: {
      /** @description Created */
      201: {
        content: never;
      };
      /** @description Malformed PEM / missing material */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get a certId's metadata
   * @description Returns the certId metadata (id + auto-derived hostnames + public cert/chain). The private key is never returned.
   */
  getConfigCertCertId: {
    parameters: {
      path: {
        /** @description Opaque certificate management handle */
        certId: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["Cert"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Certificate not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Rotate the material under a stable certId
   * @description Atomic zero-downtime rotation — re-persists the new PEM under the SAME certId and swaps the cert object into the SNI store under lock; in-flight connections keep the old SSL until they close. Unknown certId returns 404; malformed material returns 400.
   */
  putConfigCertCertId: {
    parameters: {
      path: {
        /** @description Opaque certificate management handle */
        certId: string;
      };
    };
    /** @description New certificate material to rotate in */
    requestBody: {
      content: {
        "application/json": components["schemas"]["Cert"];
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: never;
      };
      /** @description Malformed PEM / missing material */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Certificate not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Delete a certId
   * @description Removes the managed-dir material and unregisters the derived hostnames from the SNI store.
   */
  deleteConfigCertCertId: {
    parameters: {
      path: {
        /** @description Opaque certificate management handle */
        certId: string;
      };
    };
    responses: {
      /** @description OK */
      204: {
        content: never;
      };
      /** @description Invalid certId / delete error */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Certificate not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get the lifecycle status of a Load balancer service
   * @description Returns the per-LB lifecycle status (adminStateUp, operatingStatus, lastUpdated) for the rule identified by its composite key (Octavia).
   */
  getConfigLoadbalancerStatus: {
    parameters: {
      path: {
        /** @description External (VIP) IP address of the load balancer service */
        ip_address: string;
        /** @description Service port of the load balancer service */
        port: number;
        /** @description Protocol of the load balancer service (tcp/udp/sctp) */
        proto: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["LoadbalanceStatus"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get per-service statistics of a Load balancer service
   * @description Returns the per-LB statistics quad (activeConnections, bytesIn, bytesOut, totalConnections) for the rule identified by its composite key (Octavia). activeConnections is the same selector-agnostic live concurrent-connection count the connectionLimit gate enforces; bytesIn/bytesOut are the real per-direction CT byte totals; totalConnections is a monotonic cumulative counter reset to zero on restart.
   */
  getConfigLoadbalancerStats: {
    parameters: {
      path: {
        /** @description External (VIP) IP address of the load balancer service. IPv6 literals may be RFC-bracketed ([2001:db8::1]); brackets are stripped before the lookup. */
        ip_address: string;
        /** @description Service port of the load balancer service */
        port: number;
        /** @description Protocol of the load balancer service (tcp/udp/sctp) */
        proto: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["LoadbalanceStats"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Enable HTTP/HTTPS protocol tracing
   * @description Enables distributed tracing for all HTTP/HTTPS traffic passing through loxilb proxy. Events are emitted to ring buffers for export to Jaeger/OpenTelemetry.
   */
  PostConfigTraceEnable: {
    responses: {
      /** @description Tracing enabled successfully */
      200: {
        content: {
          "application/json": {
            /** @example HTTP/HTTPS tracing enabled */
            result?: string;
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Disable HTTP/HTTPS protocol tracing
   * @description Disables distributed tracing and stops emitting events to ring buffers.
   */
  PostConfigTraceDisable: {
    responses: {
      /** @description Tracing disabled successfully */
      200: {
        content: {
          "application/json": {
            /** @example HTTP/HTTPS tracing disabled */
            result?: string;
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get HTTP/HTTPS tracing status
   * @description Returns current tracing status, ring buffer statistics, and OTLP endpoint configuration.
   */
  GetConfigTraceStatus: {
    responses: {
      /** @description Tracing status retrieved successfully */
      200: {
        content: {
          "application/json": {
            /** @description Whether tracing is currently enabled */
            enabled?: boolean;
            /**
             * Format: int64
             * @description Total number of events emitted across all workers
             */
            total_events?: number;
            /**
             * Format: int64
             * @description Total number of events dropped due to ring buffer full
             */
            dropped_events?: number;
            /** @description Current utilization (pending events) per worker ring buffer */
            ring_utilization?: number[];
            /**
             * @description Currently configured OTLP endpoint address
             * @example localhost:4317
             */
            otlp_endpoint?: string;
            /**
             * @description OTLP protocol (grpc or http)
             * @example grpc
             */
            otlp_protocol?: string;
            /** @description Whether OTLP exporter is currently connected */
            otlp_connected?: boolean;
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get OTLP endpoint configuration (with security settings)
   * @description Returns current OTLP endpoint address, protocol, TLS settings, and connection status.
   */
  GetConfigTraceOtlp: {
    responses: {
      /** @description OTLP configuration retrieved successfully */
      200: {
        content: {
          "application/json": {
            /**
             * @description OTLP endpoint address
             * @example jaeger.example.com:4317
             */
            endpoint?: string;
            /**
             * @description OTLP protocol (grpc or http)
             * @example grpc
             */
            protocol?: string;
            /**
             * @description Whether TLS encryption is enabled
             * @example true
             */
            use_tls?: boolean;
            /**
             * @description Whether TLS certificate verification is skipped (insecure if true)
             * @example false
             */
            tls_skip_verify?: boolean;
            /**
             * @description Configured authentication headers (values redacted for security)
             * @example {
             *   "Authorization": "***REDACTED***",
             *   "X-API-Key": "***REDACTED***"
             * }
             */
            headers?: {
              [key: string]: string;
            };
            /** @description Whether OTLP exporter is currently connected */
            connected?: boolean;
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Configure OTLP endpoint for trace export (with TLS security)
   * @description Sets the OpenTelemetry Protocol (OTLP) endpoint address and protocol for exporting distributed traces to Jaeger/Tempo/etc.
   *
   * **Security Features:**
   * - TLS encryption enabled by default (use_tls: true)
   * - TLS certificate verification (tls_skip_verify: false)
   * - Optional authentication headers (API keys, bearer tokens)
   * - Endpoint validation (host:port format, DNS resolution)
   *
   * **Production Recommendations:**
   * - Always use TLS (use_tls: true) to encrypt trace data
   * - Never skip TLS verification (tls_skip_verify: false) in production
   * - Use authentication headers for secured endpoints
   * - Validate endpoint connectivity before deploying
   */
  PostConfigTraceOtlp: {
    requestBody: {
      content: {
        "application/json": {
          /**
           * @description OTLP endpoint address in host:port format (validated)
           * @example jaeger.example.com:4317
           */
          endpoint: string;
          /**
           * @description OTLP protocol type
           * @example grpc
           * @enum {string}
           */
          protocol: "grpc" | "http";
          /**
           * @description Enable TLS encryption (default=true, RECOMMENDED)
           * @default true
           */
          use_tls?: boolean;
          /**
           * @description Skip TLS certificate verification (default=false, INSECURE if true)
           * @default false
           */
          tls_skip_verify?: boolean;
          /**
           * @description Optional authentication headers (e.g., API keys)
           * @example {
           *   "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
           *   "X-API-Key": "your-api-key-here"
           * }
           */
          headers?: {
            [key: string]: string;
          };
        };
      };
    };
    responses: {
      /** @description OTLP endpoint configured successfully */
      200: {
        content: {
          "application/json": {
            /** @example OTLP endpoint configured successfully */
            result?: string;
          };
        };
      };
      /** @description Invalid request (bad endpoint, protocol, or headers) */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * List all loaded trace catalogs
   * @description Returns a list of all tracing catalog templates loaded from YAML files.
   * Catalogs define parser assignments, sampling rates, and tracing behavior for different services.
   *
   * **Catalog Sources:**
   * - Builtin catalogs: /opt/loxilb/trace-catalogs/
   * - User overrides: /etc/loxilb/trace-catalogs/
   *
   * **Response includes:**
   * - Catalog name (from YAML filename)
   * - Parser assignment (parser_type from YAML)
   * - Sample rate (percentage of requests traced)
   * - Enabled status
   * - Version and description
   */
  getTraceCatalogs: {
    responses: {
      /** @description List of loaded trace catalogs */
      200: {
        content: {
          "application/json": components["schemas"]["TraceCatalogEntry"][];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * List all available trace parsers
   * @description Returns a list of all protocol parsers registered in the tracing system.
   * Parsers analyze HTTP/HTTPS request/response bodies to extract protocol-specific attributes.
   *
   * **Available Parsers:**
   * - **openai**: OpenAI API (GPT models, tokens, streaming)
   * - **mcp**: Model Context Protocol (JSON-RPC tools, prompts, resources)
   * - **mock**: Simple JSON parser for testing
   *
   * Use this endpoint to discover which parsers are available before assigning them to catalogs.
   */
  getTraceParsers: {
    responses: {
      /** @description List of available parsers */
      200: {
        content: {
          "application/json": {
            parsers?: components["schemas"]["TraceParserInfo"][];
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get parser assignment for a catalog
   * @description Returns the parser currently assigned to a specific trace catalog.
   * Shows catalog name, parser name, and parser_type from YAML configuration.
   */
  getCatalogParser: {
    parameters: {
      path: {
        /** @description Catalog ID (1-255) */
        catalog_id: number;
      };
    };
    responses: {
      /** @description Catalog parser mapping */
      200: {
        content: {
          "application/json": components["schemas"]["CatalogParserMapping"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Catalog not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Update parser assignment for a catalog
   * @description Dynamically changes which parser is used for a specific catalog at runtime.
   * This allows switching parsers without restarting loxilb or reloading YAML files.
   *
   * **Use Cases:**
   * - Switch from mock to production parser after testing
   * - Change parser when service protocol changes
   * - A/B testing different parser implementations
   *
   * **Parser Selection Priority:**
   * 1. Catalog ID → parser mapping (set by this endpoint or YAML)
   * 2. URL path prefix matching (e.g., /v1/chat/completions → openai)
   * 3. Default mock parser
   */
  updateCatalogParser: {
    parameters: {
      path: {
        /** @description Catalog ID (1-255) */
        catalog_id: number;
      };
    };
    /** @description Parser assignment */
    requestBody: {
      content: {
        "application/json": components["schemas"]["TraceParserUpdate"];
      };
    };
    responses: {
      /** @description Parser updated successfully */
      200: {
        content: {
          "application/json": components["schemas"]["PostSuccess"];
        };
      };
      /** @description Invalid parser name */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Catalog or parser not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Remove parser assignment for a catalog
   * @description Removes the catalog → parser mapping, causing the system to fall back to:
   * 1. URL path-based routing (e.g., /v1/chat/completions → openai)
   * 2. Default mock parser
   *
   * Use this to revert to path-based parser selection or remove custom assignments.
   */
  deleteCatalogParser: {
    parameters: {
      path: {
        /** @description Catalog ID (1-255) */
        catalog_id: number;
      };
    };
    responses: {
      /** @description Parser mapping removed successfully */
      204: {
        content: never;
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Catalog not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Enable L4 connection tracing
   * @description Enables distributed tracing for all TCP/SCTP connections passing through loxilb.
   * Events are emitted to eBPF ring buffers for export to OpenTelemetry collectors.
   *
   * **Features:**
   * - Per-connection spans with full lifecycle tracking
   * - Connection state machine visualization
   * - RTT, retransmission, and throughput metrics
   * - Configurable sampling rate (0-100%)
   */
  PostConfigL4traceEnable: {
    requestBody?: {
      content: {
        "application/json": {
          /**
           * Format: int64
           * @description Percentage of connections to trace (0-100)
           * @default 100
           * @example 100
           */
          sampling_rate?: number;
        };
      };
    };
    responses: {
      /** @description L4 tracing enabled successfully */
      200: {
        content: {
          "application/json": {
            /** @example L4 connection tracing enabled (sampling: 100%) */
            result?: string;
          };
        };
      };
      /** @description Invalid sampling rate */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Disable L4 connection tracing
   * @description Disables L4 connection tracing and stops emitting events to ring buffers.
   * In-flight connections will complete their spans before export stops.
   */
  PostConfigL4traceDisable: {
    responses: {
      /** @description L4 tracing disabled successfully */
      200: {
        content: {
          "application/json": {
            /** @example L4 connection tracing disabled */
            result?: string;
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get L4 tracing status and statistics
   * @description Returns current L4 tracing configuration, connection statistics, and event counters.
   *
   * **Statistics include:**
   * - Total events emitted (TCP + SCTP state changes)
   * - Connection lifecycle counters (new, established, closed, timeout, reset, error)
   * - Protocol breakdown (TCP vs SCTP events)
   * - Ring buffer health (dropped events)
   */
  GetConfigL4traceStatus: {
    responses: {
      /** @description L4 tracing status retrieved successfully */
      200: {
        content: {
          "application/json": components["schemas"]["L4TraceStatusResponse"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Update L4 tracing sampling rate
   * @description Changes the L4 tracing sampling rate without disabling tracing.
   * New connections will use the updated rate immediately.
   *
   * **Sampling behavior:**
   * - 0%: Effectively disables tracing (use /disable endpoint instead)
   * - 1-99%: Hash-based deterministic sampling (same connection always gets same decision)
   * - 100%: Trace all connections (production debugging)
   */
  PutConfigL4traceSampling: {
    requestBody: {
      content: {
        "application/json": {
          /**
           * Format: int64
           * @description Percentage of connections to trace (0-100)
           * @example 10
           */
          sampling_rate: number;
        };
      };
    };
    responses: {
      /** @description Sampling rate updated successfully */
      200: {
        content: {
          "application/json": {
            /** @example L4 sampling rate updated to 10% */
            result?: string;
          };
        };
      };
      /** @description Invalid sampling rate */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Reset L4 tracing statistics
   * @description Resets all L4 tracing statistics counters to zero.
   * Does not affect current tracing configuration (enabled/disabled state).
   * Useful for baseline measurements and performance testing.
   */
  PostConfigL4traceStatsReset: {
    responses: {
      /** @description Statistics reset successfully */
      200: {
        content: {
          "application/json": {
            /** @example L4 tracing statistics reset successfully */
            result?: string;
          };
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * List API keys for a tenant
   * @description Returns all API keys belonging to the specified tenant.
   */
  getConfigAiApikey: {
    parameters: {
      query?: {
        /** @description Filter by tenant ID */
        tenant_id?: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["ApiKeySummary"][];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Create a new API key
   * @description Creates a new API key for a tenant. The raw key is returned ONLY in this response.
   */
  postConfigAiApikey: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["ApiKeyCreateRequest"];
      };
    };
    responses: {
      /** @description Created */
      201: {
        content: {
          "application/json": components["schemas"]["ApiKeyCreateResponse"];
        };
      };
      /** @description Malformed arguments for API call */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get a specific API key
   * @description Returns the summary of a single API key by its ID.
   */
  getConfigAiApikeyKeyID: {
    parameters: {
      path: {
        /** @description API key identifier */
        key_id: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["ApiKeySummary"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Delete an API key
   * @description Permanently deletes the specified API key.
   */
  deleteConfigAiApikeyKeyID: {
    parameters: {
      path: {
        /** @description API key identifier */
        key_id: string;
      };
    };
    responses: {
      /** @description OK */
      204: {
        content: never;
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Set or update tenant rate limit
   * @description Creates or updates the rate limit configuration for a tenant.
   */
  postConfigAiTenantRatelimit: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["TenantRateLimitMod"];
      };
    };
    responses: {
      /** @description OK */
      204: {
        content: never;
      };
      /** @description Malformed arguments for API call */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get tenant rate limit configuration
   * @description Returns the current rate limit configuration for the specified tenant.
   */
  getConfigAiTenantRatelimitTenantID: {
    parameters: {
      path: {
        /** @description Tenant identifier */
        tenant_id: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["TenantRateLimitEntry"];
        };
      };
      /** @description Invalid authentication credentials */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get OPA L4 policy watcher status
   * @description Returns current configuration and operational status of the OPA watcher.
   */
  getConfigOpaWatcher: {
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["OPAWatcherStatus"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Configure OPA L4 policy watcher
   * @description Start or reconfigure the OPA L4 policy watcher. Stops any existing watcher before starting a new one.
   */
  postConfigOpaWatcher: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["OPAWatcherConfig"];
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["PostSuccess"];
        };
      };
      /** @description Bad Request */
      400: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Stop and remove OPA L4 policy watcher
   * @description Stops the running OPA watcher and removes its configuration.
   */
  deleteConfigOpaWatcher: {
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["PostSuccess"];
        };
      };
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
}
