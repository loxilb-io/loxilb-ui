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
             * @description Required by the handler. Deprecated import immediately attempts a committed replacement; there is no dry-run. Legacy JSON shape validation is incomplete, so empty or unrecognized documents can become empty domains and risk deleting configuration. Prefer POST /config/restore with dry-run first.
             */
            configuration?: string;
          };
        };
      };
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/export": {
    /**
     * Export all configurations
     * @description Deprecated compatibility wrapper for GET /config/snapshot. Downloads a versioned, checksummed snapshot of supported domains, not all runtime state or external secrets. The response carries deprecation and snapshot identity headers.
     */
    get: {
      parameters: {
        query?: {
          /** @description Comma-separated snapshot domains. Omitted or empty selection captures all supported domains. The legacy cluster token is ignored; cluster-only selection consequently widens to all snapshot domains and should not be used. */
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
        403: components["responses"]["ManagementForbidden"];
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
  "/config/snapshot": {
    /**
     * Download a complete instance snapshot
     * @description Returns a versioned, checksummed snapshot document using schema 1.5. Supported snapshot domains exclude some runtime-only state and externally stored secrets. Replaces deprecated /config/export. Response carries Content-Disposition and X-Snapshot-Checksum headers.
     */
    get: {
      parameters: {
        query?: {
          /** @description Comma-separated domains (endpoint, loadbalancer, kvexactbinding, l7policy, firewall, policy, mirror, session, sessionulcl, ipfilter, securityrate, bfd, bgp, ipsec, cors, tracing, cert). Omitted or empty selection captures all supported domains. Inspect included_domains and excluded_domains for actual coverage; certificate material and OTLP header values remain external. */
          components?: string;
        };
      };
      responses: {
        /** @description Snapshot document download */
        200: {
          headers: {
            "Content-Disposition"?: string;
            "X-Snapshot-Checksum"?: string;
          };
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Another snapshot or restore operation is in progress */
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
  "/config/restore": {
    /**
     * Restore an instance snapshot
     * @description Defaults to dry-run, which checks structure, checksum, schema compatibility, coverage and required dependencies and reports a replacement plan without applying it. Dry-run does not execute every domain's apply-time validation or guarantee commit success. Explicit commit replaces selected domains, verifies the result and attempts rollback on failure. Application and write-through persistence are separate outcomes; inspect result, errors and persisted, not HTTP status alone. Replaces deprecated /config/import.
     */
    post: {
      parameters: {
        query?: {
          /** @description dry-run (default) performs pre-apply checks and planning without applying configuration. commit replaces selected domains and attempts rollback if apply or verification fails; rollback itself can fail. A successful commit can return persisted=false when write-through fails without undoing the applied state. */
          mode?: "dry-run" | "commit";
          /** @description Comma-separated snapshot domains to replace, not merge. Omitted or empty selection uses included_domains. Uncovered domains are refused. Required dependencies are checked across the document manifest before component selection. */
          components?: string;
        };
      };
      /** @description The snapshot document, as produced by GET /config/snapshot. */
      requestBody: {
        content: {
          "application/json": Record<string, never>;
        };
      };
      responses: {
        /** @description Restore result (both modes; inspect result and errors fields) */
        200: {
          content: {
            "application/json": components["schemas"]["RestoreResult"];
          };
        };
        /** @description Malformed or incompatible snapshot document */
        400: {
          content: {
            "application/json": components["schemas"]["RestoreResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
        /** @description Another snapshot or restore operation is in progress */
        409: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Restore failed (rolled-back or ROLLBACK-FAILED; see result field) */
        500: {
          content: {
            "application/json": components["schemas"]["RestoreResult"];
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
  "/config/persist": {
    /**
     * Persist the running configuration to disk
     * @description Atomically writes supported snapshot configuration to {config-path}/snapshot.json with mode 0600. Inspect included_domains, excluded_domains, external_dependencies, checksum and generation for coverage and identity. Runtime-only settings and external secrets are not made durable by this operation. Committed restore attempts write-through separately; eligible successful mutations schedule debounced persistence when auto-persist is enabled rather than synchronously saving every mutation.
     */
    post: {
      responses: {
        /** @description Configuration persisted */
        200: {
          content: {
            "application/json": components["schemas"]["PersistResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
        /** @description Another snapshot or restore operation is in progress */
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
  "/meta": {
    /**
     * Get metadata for all POST APIs
     * @description Returns simplified input metadata from embedded main and supplemental Swagger. One operation is selected per path, preferring POST, then PUT, then PATCH; main-document entries win overlaps. Ranges, defaults, patterns, authentication, cross-field rules and vendor extensions, including root relationship metadata, are not passed through. This is advisory field metadata, not a complete UI validator. Extraction errors are currently logged without changing the handler's 200 response.
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
            "application/json": components["schemas"]["UserSummary"][];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Authenticated principal is not authorized to list users */
        403: {
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
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Create a new user
     * @description Creates a new user in the system.
     *
     * Requires an authenticated administrator, with one exception: while no
     * user exists at all, a request from a loopback peer may create the first
     * one, so that the management API can be brought up before any credential
     * exists. That bootstrap closes as soon as the first account is created.
     *
     * The authentication is performed by the handler rather than by the
     * generated security chain, because the chain cannot express a condition
     * that depends on the state of the user table. The security block below is
     * empty for that reason and does not mean the operation is open.
     */
    post: {
      requestBody: components["requestBodies"]["User"];
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Bad Request */
        400: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Unauthorized - not an administrator, and the bootstrap conditions (loopback peer, no user yet) are not met */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Forbidden - authenticated, but the role carries no authority to create users */
        403: {
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
        /** @description Management credential store unavailable */
        503: {
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal Server Error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
          /** @description Model name carried by the rule (the `model_name` given at creation). It is part of the rule key, so a rule that names a model can only be deleted by naming the same model here. Omitting it matches only a rule with no model name: with two rules on one VIP:port, one naming a model and one not, a delete without `model_name` removes the model-less rule and leaves the other serving. */
          model_name?: string;
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
    /**
     * Patch an existing Load balancer service (RFC 7386 JSON merge-patch)
     * @description Updates an existing L4 rule selected by VIP/port/protocol; does not create a missing rule. FullProxy rules are rejected. The handler overlays name, sel, inactiveTimeOut, monitor, probetype, probeport, probereq, proberesp and adminStateUp when present, and replaces endpoints or allowedSources when their collection key is present. Changes to security, egress, mode or the identifying tuple are guarded as immutable. Empty or null endpoints are rejected; serviceArguments:null does not clear the service configuration. Implementation warning: this is a restricted overlay, not general recursive RFC 7386 support for every LoadbalanceEntry field. Other schema fields are not applied by this handler. Canonical probeTimeout/probeRetries updates miss the handler's incorrectly lowercased presence checks; this is a wiring defect, not an alternate spelling of the API. Existing-member metadata updates also have the limitations documented on endpoints. The L4 path uses in-place reconciliation, but source inspection does not establish runtime connection preservation. Returns 200 on successful apply and 404 when absent; errors, including no-change detection, can prevent a successful apply.
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
    /**
     * Get all L7 content-routing policies
     * @description Returns stored policies sorted by policy ID under l7policyAttr. This is registry readback, not an effective dataplane policy or attachment-status query; submitted values can differ from bounded C values.
     */
    get: operations["getConfigL7PolicyAll"];
    /**
     * Create an L7 content-routing policy
     * @description Validates a policy, resolves its load-balancer ID, attaches its routes to an existing sockproxy listener, then stores the policy. The current attachment bridge supports IPv4; an existing LB resource alone does not establish an eligible listener. Success returns 204 without a policy body or generated ID. Duplicate policy IDs, including identical replay, and a second policy for the same LB ID return 409. No update or Gateway API export operation is performed. Implementation warnings on L7Policy, L7Rule and L7Action describe attachment identity, truncation and response-path gaps. A successful attach is source-level configuration evidence, not proof of effective matching, TLS responses or lifecycle safety. Policy ownership across LB resources sharing a listener remains unresolved.
     */
    post: operations["postConfigL7Policy"];
  };
  "/config/l7policy/id/{id}": {
    /**
     * Get a single L7 content-routing policy by id
     * @description Returns the stored policy with this ID, or 404 when absent. Readback does not verify that the listener still carries the policy or that its effective values match the stored document.
     */
    get: operations["getConfigL7PolicyID"];
    /**
     * Delete an L7 content-routing policy by id
     * @description Detaches the policy when its referenced LB still exists, then removes the stored resource. A missing policy returns 404; a detach failure retains the registry entry. Implementation warning: when the LB has disappeared the handler skips detach, although C can retain the listener and attached routes. Successful deletion in that case does not establish dataplane cleanup.
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
  "/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}/kvexactstatus": {
    /**
     * Get the resolved KV-exact composition status of Load balancer rules
     * @description Returns the resolved KV-exact status (model-profile/engine-contract binding identity, binding generation and digest, hash contract, attestation-ladder desired/enforced states with reason codes) for every KV-exact rule on the composite key. A DEDICATED read model - resolved status never rides the GET/POST-shared LoadbalanceEntry, so an echoed GET body can never replay resolved state back as configuration. Every identity field is a scalar by schema.
     */
    get: operations["getConfigLoadbalancerKvExactStatus"];
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
          /** @description Model name carried by the rule (the `model_name` given at creation). It is part of the rule key, so a rule that names a model can only be deleted by naming the same model here. Omitting it matches only a rule with no model name: with two rules on one VIP:port, one naming a model and one not, a delete without `model_name` removes the model-less rule and leaves the other serving. */
          model_name?: string;
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/loadbalancer/hosturl/{hosturl}/externalipaddress/{ip_address}/port/{port}/portmax/{portmax}/protocol/{proto}": {
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service by its full rule key. The key is the VIP, port, protocol and host URL, plus `path_prefix`, `path_match_mode` and `model_name` when the rule was created with them; a delete that omits a key component the rule carries does not match it and returns 404 (no-rule error).
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
          /** @description Model name carried by the rule (the `model_name` given at creation). It is part of the rule key, so a rule that names a model can only be deleted by naming the same model here. Omitting it matches only a rule with no model name: with two rules on one VIP:port, one naming a model and one not, a delete without `model_name` removes the model-less rule and leaves the other serving. */
          model_name?: string;
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/loadbalancer/hosturl/{hosturl}/externalipaddress/{ip_address}/port/{port}/protocol/{proto}": {
    /**
     * Delete an existing Load balancer service
     * @description Delete an existing load balancer service by its full rule key. The key is the VIP, port, protocol and host URL, plus `path_prefix`, `path_match_mode` and `model_name` when the rule was created with them; a delete that omits a key component the rule carries does not match it and returns 404 (no-rule error).
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
          /** @description Model name carried by the rule (the `model_name` given at creation). It is part of the rule key, so a rule that names a model can only be deleted by naming the same model here. Omitting it matches only a rule with no model name: with two rules on one VIP:port, one naming a model and one not, a delete without `model_name` removes the model-less rule and leaves the other serving. */
          model_name?: string;
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["ErrorResponse"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/trace/enable": {
    /**
     * Enable HTTP/HTTPS protocol tracing
     * @description Enables runtime HTTP/HTTPS tracing and attempts to initialize its consumer. Actual capture depends on the proxy path and tracing configuration; enablement does not prove capture or export of all traffic. Some initialization failures currently return an error message with HTTP 200.
     */
    post: operations["PostConfigTraceEnable"];
  };
  "/config/trace/disable": {
    /**
     * Disable HTTP/HTTPS protocol tracing
     * @description Disables runtime HTTP/HTTPS trace emission without itself shutting down the existing consumer or proving buffered events were exported. Some failure branches currently return an error message with HTTP 200.
     */
    post: operations["PostConfigTraceDisable"];
  };
  "/config/trace/status": {
    /**
     * Get HTTP/HTTPS tracing status
     * @description Returns tracing enablement and OTLP configuration. Event totals and ring-utilization reporting currently use placeholder statistics, not measured zero traffic or loss. Connection state reflects recorded export outcomes rather than a fresh reachability probe.
     */
    get: operations["GetConfigTraceStatus"];
  };
  "/config/trace/otlp": {
    /**
     * Get OTLP endpoint configuration (with security settings)
     * @description Returns configured OTLP endpoint, protocol and TLS settings. Header values are redacted or marked for reprovisioning and must not be submitted back as credentials. Connection state reflects recorded export outcomes rather than a fresh connectivity check.
     */
    get: operations["GetConfigTraceOtlp"];
    /**
     * Configure OTLP endpoint for trace export (with TLS security)
     * @description Replaces the OTLP exporter configuration rather than patching individual fields. Endpoint and protocol are required. Omitted TLS fields use their defaults; omitted headers clear the header map. Redacted GET values must not be submitted as credentials. Configuration changes can precede secret persistence or reconnection, leaving partial state on failure; some failures currently return HTTP 200 with an error message.
     *
     * **Security Features:**
     * - TLS encryption enabled by default (use_tls: true)
     * - TLS certificate verification (tls_skip_verify: false)
     * - Optional authentication headers (API keys, bearer tokens)
     * - Endpoint syntax checks (host:port); no DNS lookup or complete numeric port-range validation is performed by this handler
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
     * @description Not implemented by the current router configuration; the generated default handler returns 501. The following catalog shape describes intended data, not an available response.
     * Catalogs define parser assignments, sampling rates, and tracing behavior for different services.
     *
     * **Catalog Sources:**
     * - Builtin catalogs: /opt/loxilb/trace-catalogs/
     * - User overrides: /etc/loxilb/trace-catalogs/
     *
     * **Response includes:**
     * - Catalog name (from the YAML catalog_name field, not the filename)
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
     * Discovery currently returns metadata names such as openai_v1, mcp_v1 and mock_parser, while assignment accepts registry keys openai, mcp and mock. Do not use discovery names directly as assignment values. Description and capabilities are not populated, and an unavailable tracing registry can cause 500.
     */
    get: operations["getTraceParsers"];
  };
  "/config/trace/catalog/{catalog_id}/parser": {
    /**
     * Get parser assignment for a catalog
     * @description Returns the parser currently assigned to a specific trace catalog.
     * parser_name is the runtime assignment key; parser_type is the YAML declaration and can differ after an override. Catalog metadata can be absent. Mapping lookup errors, including an unavailable registry, currently produce 404. Numeric catalog IDs are not durable identities across catalog-set changes.
     */
    get: operations["getCatalogParser"];
    /**
     * Update parser assignment for a catalog
     * @description Dynamically changes which parser is used for a specific catalog at runtime.
     * The override is runtime-only, does not edit YAML, and can be replaced by catalog synchronization. The handler validates the parser key but not catalog existence; current success has an empty body despite the declared response schema.
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
     * Removal is runtime-only and succeeds with 204 even when no mapping exists. Registry unavailability can produce 500. This does not edit YAML or guarantee that later catalog synchronization will preserve the removal.
     */
    delete: operations["deleteCatalogParser"];
  };
  "/config/l4trace/enable": {
    /**
     * Enable L4 connection tracing
     * @description Enables runtime L4 trace emission when supported by the build and loaded maps. Omitted body or sampling_rate defaults to 100; explicit zero is retained. Enablement alone does not prove capture or export of every connection.
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
     * This also resets sampling to 100. The operation does not guarantee completion or export of all in-flight spans and does not itself shut down the existing consumer.
     */
    post: operations["PostConfigL4traceDisable"];
  };
  "/config/l4trace/status": {
    /**
     * Get L4 tracing status and statistics
     * @description Returns L4 configuration with currently incomplete statistics wiring. REST reads C counters that are separate from the Go consumer's event counters; default or zero values do not establish measured traffic or loss, or compiled feature availability.
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
     * - 1-99%: Hash-based sampling with cached decisions and special handling for uncached close, reset and error events; this is not an unconditional same-decision guarantee for every event
     * - 100%: Trace all connections (production debugging)
     */
    put: operations["PutConfigL4traceSampling"];
  };
  "/config/l4trace/stats/reset": {
    /**
     * Reset L4 tracing statistics
     * @description Resets the C-side L4 statistics currently exposed by this API, not the separate Go consumer counters. Statistics wiring is incomplete, so success does not establish a fresh measurement baseline across the tracing pipeline.
     * Does not affect current tracing configuration (enabled/disabled state).
     * Useful for baseline measurements and performance testing.
     */
    post: operations["PostConfigL4traceStatsReset"];
  };
  "/config/conntrack/all": {
    /**
     * Get all of the conntrack entries.
     * @description Return gateway datapath connection records, not the host's complete operating-system conntrack table. Counters include reported hardware fast-path totals when available. A backend table-read failure can currently appear as an empty successful result; ageMs is not populated.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Return the gateway's port inventory and observed status. Link state and administrative state are distinct. Address arrays contain display strings for the first address of each family, not complete address inventories; portProp is not populated by the current domain getter.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Return the gateway's route inventory, including protocol, synchronization state, and byte and packet counters. Gateway strings may contain comma-separated next hops. A successful response is not proof of complete kernel inventory or datapath synchronization.
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
     * @description Add a route using a destination CIDR and literal next-hop IP. This uses add, not replace. Only the exact protocol string static explicitly selects the static protocol; other returned protocol values are not supported create-time selectors. Gateway validity and address-family consistency are not fully checked locally.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/route/destinationIPNet/{ip_address}/{mask}": {
    /**
     * Create a new Load balancer service
     * @description Delete a route identified by destination IP address and prefix length. This operation does not create a load-balancing service.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/session/all": {
    /**
     * Get all of the port interfaces
     * @description Return configured user sessions and their access-network and core-network tunnels.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Configure a user session identified by ident. Supply both tunnel objects: the current handler dereferences them even though the schema makes them optional. TEIDs narrow to uint32 without bounds checks. Existing-session comparison is defective and can delete and recreate an identical session, removing its ULCL classifiers; do not treat POST as an idempotent update.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/session/ident/{ident}": {
    /**
     * Create a new Load balancer service
     * @description Delete the session identified by ident and all of its ULCL classifiers.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/sessionulcl/all": {
    /**
     * Get
     * @description Return uplink classifiers associated with configured user sessions.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Add an uplink classifier to an existing session. Identity is the session identifier plus classifier IP; duplicate identity does not update QFI. Supply ulclArgument because the handler dereferences this schema-optional object. QFI narrows to uint8 without a bounds check.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/sessionulcl/ident/{ident}/ulclAddress/{ip_address}": {
    /**
     * Create a new Load balancer service
     * @description Delete the classifier identified by session identifier and classifier IP. QFI is not part of the deletion key. Missing-classifier errors are not consistently mapped to HTTP 404.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/policy/all": {
    /**
     * Get
     * @description Return configured policers and their target references. Rates are reported in Mbps and burst sizes in bytes. This response does not expose attachment synchronization and is not proof that a pending target is active.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Configure a policer. Rule targets require an exact VIP:PORT:PROTO or [VIP]:PORT:PROTO key; egress port targets require enabled egress hooks. Targets may remain pending. Information changes can delete and recreate an existing policer; target-only changes conflict. Mode propagation, numeric narrowing, and effective burst/rate semantics have known implementation limitations; this is not an atomic general-purpose update.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/policy/ident/{ident}": {
    /**
     * Delete a Policy QoS service
     * @description Delete the policer identified by ident and detach its target association.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/mirror/all": {
    /**
     * Get
     * @description Return mirror configuration and mirror-object synchronization state. The reported state does not establish successful attachment or active traffic mirroring.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Configure a mirror object. The inspected implementation provides a port-attached SPAN programming path; rule attachment and ERSPAN are not implemented end-to-end. RSPAN currently rejects nonzero VLAN IDs. Datapath failures can be ignored during creation, and changed information may delete and recreate an existing object while target-only changes conflict.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/mirror/ident/{ident}": {
    /**
     * Delete a Mirror service
     * @description Delete the mirror object identified by ident. Successful control-plane deletion does not independently verify datapath cleanup.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/ipv4address/all": {
    /**
     * Get IPv4 addresses in the device(interface)
     * @description Return the gateway's IPv4 address inventory, filtered by family, with interface names and synchronization state. This is not a complete independently verified kernel inventory.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Assign an address with prefix length to the named interface. Supply IPv4 CIDR notation; the shared mutation helper does not enforce this endpoint's address family. A missing Linux interface can fall back to an internal address object. Backend failure can return HTTP 200 with result set to fail; HTTP status alone does not establish success.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/ipv4address/{ip_address}/{mask}/dev/{if_name}": {
    /**
     * Delete IPv4 addresses in the device
     * @description Delete the address identified by interface, IPv4 address, and prefix length. Shared helpers do not enforce endpoint address family and can use internal address objects when Linux interface lookup fails. Backend failure can return HTTP 200 with result set to fail.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/ipv6address/all": {
    /**
     * Get IPv6 addresses in the device(interface)
     * @description Return the gateway's IPv6 address inventory, filtered by family, with interface names and synchronization state. This is not a complete independently verified kernel inventory.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Assign an address with prefix length to the named interface. Supply IPv6 CIDR notation; the shared mutation helper does not enforce this endpoint's address family. A missing Linux interface can fall back to an internal address object. Backend failure can return HTTP 200 with result set to fail; HTTP status alone does not establish success.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/ipv6address/{ip_address}/{mask}/dev/{if_name}": {
    /**
     * Delete IPv6 addresses in the device
     * @description Delete the address identified by interface, IPv6 address, and prefix length. Shared helpers do not enforce endpoint address family and can use internal address objects when Linux interface lookup fails. Backend failure can return HTTP 200 with result set to fail.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/neighbor/all": {
    /**
     * Get IPv4 neighbor in the device(interface)
     * @description Return the gateway's neighbor inventory and resolved interface names. This operation is not restricted to IPv4 by its handler, and a successful response does not independently verify complete kernel neighbor state.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Add a permanent neighbor entry using a literal IP address, interface name, and MAC address. IP parsing is not followed by complete local validation; downstream failures are not consistently classified.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/neighbor/{ip_address}/dev/{if_name}": {
    /**
     * Delete IPv4 neighbor in the device
     * @description Request deletion of a neighbor on the named interface. Safety limitation: if interface lookup fails, the current helper searches all interfaces and deletes matching IP entries, ignoring individual deletion failures. Do not assume interface-scoped deletion is enforced; verify the interface before submission. This fallback is an implementation gap, not a supported cross-interface deletion contract.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/fdb/all": {
    /**
     * Get FDB in the device(interface)
     * @description Return bridge-family forwarding entries from interfaces that have a bridge master. The response exposes interface and MAC only, not the complete kernel FDB key or every kernel FDB entry.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Add a permanent bridge-family forwarding entry for the supplied interface and MAC address. This is a netlink append operation, not a general replacement API.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/fdb/{mac_address}/dev/{if_name}": {
    /**
     * Delete FDB in the device
     * @description Delete a bridge-family forwarding entry identified by interface and MAC address. The API does not expose additional kernel FDB selectors such as VLAN or tunnel destination.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/vlan/all": {
    /**
     * Get vlan in the device
     * @description Return gateway-managed VLAN bridges, members, and ingress/egress byte and packet counters.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Create Linux bridge vlan<ID> with MTU 9000. The REST helper does not consistently enforce the VLAN range documented elsewhere, and successful creation does not prove completion of subsequent link setup.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/vlan/{vlan_id}": {
    /**
     * Delete vlan in the device
     * @description Delete Linux bridge vlan<ID>. The REST helper does not enforce a no-members precondition; do not assume a populated bridge will be rejected. Downstream failures are not guaranteed to use the documented conflict or not-found status.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/vlan/{vlan_id}/member": {
    /**
     * Add a physical port to a vlan interface
     * @description Attach a member to bridge vlan<ID>. Omitted tagged means false and attaches the named interface; tagged true creates and attaches <interface>.<ID>. The helper does not enforce existing-master ownership or the documented VLAN range, and failures can leave partial state. Verify existing membership before submission; automatic reparenting must not be treated as a safe update contract.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Request removal of a member from bridge vlan<ID>; tagged deletion also deletes <interface>.<ID>. Safety limitation: the helper checks that the requested bridge exists but does not verify that it owns the member before unmastering it. Verify membership before submission; wrong-bridge deletion is an implementation gap.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Return gateway VXLAN interfaces joined with kernel peer information. An empty interface inventory returns an empty list; missing or failed peer lookup can leave peerIP null. This does not prove complete peer inventory.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Create interface vxlan<ID> using the first IPv4 address of epIntf, UDP port 8472, MTU 9000, and learning enabled. The endpoint interface must exist and have an IPv4 address. Numeric and peer-family validation are incomplete. Backend failure can return HTTP 200 with result set to fail.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
     * @description Delete interface vxlan<ID>. The current helper continues after failed interface lookup; verify existence before submission. Backend failure can return HTTP 200 with result set to fail, so HTTP status alone is not success evidence.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
     * @description Add a VXLAN flood-list peer using a literal peer IP. The handler returns an operation-result object, not the resource shape currently declared for success. Backend failure can return HTTP 200 with result set to fail; peer parsing is not fully validated.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Delete the VXLAN flood-list peer identified by tunnel ID and peer IP. The handler returns an operation-result object, not the resource shape currently declared for success. Backend failure can return HTTP 200 with result set to fail.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Return cluster instance names, states, and VIPs. The current handler does not populate the schema-required sync field; do not interpret it as confirmed synchronization.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Set cluster instance state and initiate asynchronous dependent updates. Recognized states are MASTER, BACKUP, FAULT, STOP, and NOT_DEFINED. Current limitations include creating an instance before state validation, ignoring VIP changes when state is unchanged, and unchecked VIP parsing. Instance text is used in a shell hook when configured and is not safely isolated as an argument; do not treat unrestricted instance names as safe. HTTP success is not completion of HA or hook processing.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Return endpoint monitor configuration and observed health. Structured HTTP monitor fields are not returned, so this is not a complete configuration round-trip. currState uses ok, nok, or red, not the host-state input enumeration.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Configure a monitor for a literal endpoint IP, not a hostname or CIDR. Supply probeType; TCP, UDP, and SCTP require a nonzero probe port. Name selects a custom monitor identity, otherwise identity is host/type/port. Existing POST replaces options rather than patching them; reusing a name with a different host currently retains the old host. Port and duration narrowing and structured HTTP validation are incomplete.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Set green, yellow, or red host state. Specify both nonzero epPort and epProto for generated-key targeting, or omit both for host-wide targeting. Specific targeting does not resolve custom monitor names; host-wide requests can succeed without matches. Immediate dependent-rule updates are limited to the implemented fullproxy path and are not a universal completion guarantee.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Delete an endpoint monitor. A supplied name takes precedence over the path host and probe tuple; otherwise supply the original host, probe_type, and probe_port. Referenced monitors cannot be removed. probe_port is currently converted to uint16 without complete range or fractional validation; use an integer port in range.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/firewall/all": {
    /**
     * Get all of the firewall config
     * @description Return firewall match tuples, options, and packet/byte counters. Internally marked source-check rules are filtered out. hwOffload is not populated on readback; returned configuration does not prove hardware installation.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Add a firewall rule. Ports and preference are 0..65535; protocol is 0..255. Zero port pairs and protocol zero mean wildcard. Nonzero port pairs require minimum <= maximum; CIDR families must agree. Avoid conflicting terminal actions: precedence and independent doSnat side effects are not a safe one-action contract. Duplicate POST can change fwMark before returning conflict. Hardware expressibility admission does not establish hardware installation.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
    /**
     * Delete of the firewall service
     * @description Delete the exact firewall match tuple, including preference; query parameters are not a search filter. Reuse the original normalized tuple. Safety limitation: reversed port ranges currently become wildcard tuples instead of being rejected, so validate range ordering before submission.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/ipfilter/all": {
    /**
     * Get all IP filter rules
     * @description Return source-prefix whitelist and blacklist map entries with packet and byte counters. These maps are shared with security-rate whitelist configuration; GET is not an independent ownership inventory.
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/ipfilter": {
    /**
     * Create a new IP filter rule
     * @description Add or replace a source-prefix XDP filter. Zone must be zero or omitted; whitelist requires allow and blacklist requires drop. Priority is 0..65535, defaults to 100 when omitted, and preserves explicit zero. Each list uses longest-prefix matching; higher priority wins between lists and whitelist wins ties. Replacing an existing list/prefix resets its counters.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
    /**
     * Delete an IP filter rule
     * @description Delete the entry identified by filterType and normalized CIDR. This is a zone-less XDP map: the current handler narrows zone without validating it and deletion does not use zone in the key. Omit zone or use zero; do not rely on it for isolation.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/securityrate": {
    /**
     * Configure unified security rate limiting
     * @description Replace SYN, connection-SYN, and UDP rate configuration and the security-rate whitelist. Supply all required flags and thresholds; at least one protection must be enabled. Omitted whitelist clears the previous list. Numeric and relational limits are described on the configuration model. Programming is not atomic: errors can follow partial datapath changes. Explicit cookieThreshold zero becomes 50 in the datapath, and cookie telemetry does not implement a SYN-cookie exchange.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
    /**
     * Disable unified security rate limiting
     * @description Disable all three security-rate protections and replace the security-rate whitelist with an empty list. This does not clear tracking maps or guarantee counter reset. Whitelist maps are shared with IP-filter rules, so overlapping entries can be removed.
     */
    delete: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/securityrate/all": {
    /**
     * Get unified security rate limiting configuration and statistics
     * @description Return a single configuration/statistics entry in an array. Configuration reflects the stored control-plane values, which can differ from effective datapath defaults or partially applied updates. Statistics read failures can appear as zeros. uniqueIps is tracking-map occupancy, not a resettable cumulative counter.
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/securityrate/reset": {
    /**
     * Reset security rate limiting statistics
     * @description Attempt to reset accumulated SYN, connection-SYN, and UDP statistics counters. Tracking maps and their uniqueIps occupancy are not cleared. Individual counter-write failures are logged but can still result in HTTP 204; success does not prove every counter was reset.
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/status/process": {
    /**
     * Get a process based on CPU usage info in the device
     * @description Returns Linux process observations assembled from top, with CPU and memory percentages from ps. Values depend on command availability and output format; the current parser incompletely handles failed or short command output.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ProcessStatus"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
     * @description Returns identity read from Linux system files and uname. Raw values can include trailing newlines; uptime contains both /proc/uptime values rather than a formatted duration. Availability depends on distribution-specific files.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Returns filesystem observations parsed from Linux df -hT. Capacity and usage fields are human-readable strings, not byte counts; rows depend on the supported output format.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["FilesystemStatus"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
  "/status/ready": {
    /**
     * Configuration readiness of this gateway
     * @description Reports configuration-recovery readiness using boot replay, recovery outcomes, auto-persist failures and dependency checks. Checks vary by type and do not all perform external I/O. Informational attachment state and maintenance do not directly gate this verdict. It is not proof of successful inference, GPU operation or complete datapath health. A not-ready verdict returns 503 with ReadyStatus; authentication or credential-store errors can use a different error body.
     */
    get: {
      responses: {
        /** @description Ready */
        200: {
          content: {
            "application/json": components["schemas"]["ReadyStatus"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Authenticated principal's role carries no authority for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Not ready (body carries the reasons) */
        503: {
          content: {
            "application/json": components["schemas"]["ReadyStatus"];
          };
        };
      };
    };
  };
  "/maintenance": {
    /**
     * Operator maintenance state with drain read-back
     * @description Reports an ephemeral operator maintenance episode, its management-write gate and drain observations. The episode does not itself refuse new inference traffic. The in-flight count covers SSE streams, not all requests; elapsed time and deadline overrun do not prove a completed traffic drain.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["MaintenanceStatus"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Authenticated principal's role carries no authority for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Enter or leave operator maintenance
     * @description Idempotently enters or leaves maintenance. Repeat enter preserves operation_id, entered_at and the original timeout; changing timeout requires leave then enter. Omitted or zero timeout declares no deadline, and expiry never exits maintenance automatically. The operator gate exempts restore, persist and this endpoint; GETs bypass mutation freezes. Legacy import is not exempt. Independent boot or restore freezes can still reject maintenance changes with 503. Leave reports the ended episode's operation_id.
     */
    put: {
      /** @description Desired maintenance state */
      requestBody: {
        content: {
          "application/json": components["schemas"]["MaintenanceRequest"];
        };
      };
      responses: {
        /** @description Resulting maintenance state */
        200: {
          content: {
            "application/json": components["schemas"]["MaintenanceStatus"];
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
        /** @description Authenticated principal's role carries no authority for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Refused while the boot config replay has not settled, or while a snapshot restore is in progress */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
  };
  "/diagnostics": {
    /**
     * Secret-safe gateway diagnostics
     * @description Returns build/API identity, API-layer uptime, configuration-readiness observations, maintenance state, attachments, cached map utilization and lifecycle outcomes. Dependency checks vary by type; latency classes do not establish end-to-end health. The handler normally returns 200 even when ready is false. Nested reasons can contain propagated error text, so universal secret-redaction guarantees are not established. This is not a raw-log export; correlation references are not supplied by every API error path.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["DiagnosticsStatus"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Authenticated principal's role carries no authority for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        /** @description Management credential store unavailable */
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
     * @description Returns the current runtime logLevel. The implemented handler returns a body on success and has no empty-success 204 branch.
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
     * @description Sets runtime logLevel, updating a singleton operational setting rather than creating a resource. The setting is not recovered through configuration snapshots. Unsupported operating modes can reject the change.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
    /**
     * Update an IPsec tunnel
     * @description Update an existing IPsec tunnel in place. The tunnel is replaced within a single configuration regeneration and strongSwan reload (no delete/recreate window). The name in the path takes precedence over the body.
     */
    put: {
      parameters: {
        path: {
          /** @description Tunnel name */
          name: string;
        };
      };
      /** @description New IPsec tunnel configuration */
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/ipsec/tunnels/{name}/action": {
    /**
     * Execute a connection action on an IPsec tunnel
     * @description Initiate, terminate, or restart the strongSwan connection for an existing tunnel without changing its configuration.
     */
    post: {
      parameters: {
        path: {
          /** @description Tunnel name */
          name: string;
        };
      };
      /** @description Action to execute */
      requestBody: {
        content: {
          "application/json": components["schemas"]["IPsecTunnelActionMod"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/ipsec/tunnels/{name}/peerconfig": {
    /**
     * Get remote-peer strongSwan configuration for a tunnel
     * @description Generate a mirrored strongSwan configuration (ipsec.conf conn block and ipsec.secrets entry) ready to install on the remote peer of this tunnel. For PSK tunnels the response contains the pre-shared key.
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
            "application/json": components["schemas"]["IPsecPeerConfig"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
    /**
     * Reset IPsec statistics
     * @description Reset all IPsec statistics counters to zero.
     */
    delete: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
          };
        };
        /** @description Invalid authentication credentials */
        401: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/config/bgp/neigh/all": {
    /**
     * Get the all of BGP Neighbor
     * @description Return BGP neighbors and session state in a 200 response, including an empty array when there are none. Configured port 179 is normalized to zero or absent on readback. BGP must be enabled; a successful list does not establish peering readiness.
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
     * @description Add a BGP neighbor, not a general replacement. Supply a literal IP and remote ASN. ASN and port narrow without local bounds checks; omitted or zero remotePort selects 179 and setMultiHop enables an eight-hop TTL. GoBGP performs additional admission not represented fully by this schema.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Delete the BGP neighbor identified by IP. Implementation limitation: the handler dereferences the optional remoteAs parameter even though the backend deletion ignores ASN; omission is unsafe in this version. This is not a supported ASN-based ownership check.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Return defined sets of the requested type; type_name all selects all names of that type. Use lowercase prefix, neighbor, community, extcommunity, aspath, or largecommunity. The handler only emits prefixList for lowercase prefix despite broader internal aliases. Empty results use HTTP 200, not 204.
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
     * @description Delete the named defined set and all its entries. Select a supported type explicitly; unknown types are not rejected consistently and can fall back to prefix on this path. GoBGP dependency and deletion errors are not consistently mapped by HTTP status.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Add a BGP defined set. Use prefixList for prefix and capitalized List for other types. Use lowercase supported type names; unknown types can silently fall back to prefix. Prefix mask ranges use minimum..maximum, but parse errors and relational bounds are not fully validated locally.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Return BGP policy definitions and translated statements. The response is not a lossless representation of every GoBGP action or explicit zero; zero local preference cannot be reapplied through this write model.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Add a BGP policy definition. Supply non-null conditions and actions for every statement: the handler dereferences these schema-optional objects. Numeric narrowing, enum fallback, and string parsing can change meaning before GoBGP admission; validate statement relationships before submission. This is not an atomic general-purpose replacement API.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Delete the BGP policy identified by policy_name. Remote GoBGP validation and dependency failures are propagated through the current generic error classifier.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Add policy assignments for a neighbor or the global assignment target in the selected import/export direction. routeAction is the default assignment action and uses accept or reject, unlike statement routeDisposition. POST adds assignments; it does not perform a general replacement.
     */
    post: {
      requestBody: components["requestBodies"]["BGPApplyPolicyToNeighborMod"];
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Delete policy assignments for the selected target and direction. Omitted or empty policies removes all assignments for that target/direction. The schema still requires routeAction, but the handler ignores it during deletion. Make this destructive omission explicit in clients.
     */
    delete: {
      requestBody: components["requestBodies"]["BGPApplyPolicyToNeighborMod"];
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Start BGP with the supplied router ID, local ASN, and listen port, and create additional policy objects. Omitted or zero listenPort selects 179; numeric inputs narrow without complete local bounds checks. SetNextHopSelf is case-sensitive. This is not an atomic configuration replacement, and errors can follow partial setup.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
    /**
     * Scrape metrics from the cache
     * @description Public management-authentication-exempt Prometheus scrape, using exposition rather than JSON. Disabled collection/export returns plain-text 503. Series depend on initialization and activity; absence is not measured zero.
     */
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
    /**
     * Get prometheus config value
     * @description Returns the runtime Prometheus enablement flag, not proof of freshness or availability of every series.
     */
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
        403: components["responses"]["ManagementForbidden"];
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
     * turn on prometheus option
     * @description Idempotently enables runtime collection and scraping, not metric-resource creation. Collection is asynchronous; enablement does not prove a first sample exists. This setting is not recovered through snapshots.
     */
    post: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
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
     * turn off prometheus option
     * @description Idempotently disables runtime collection and scraping without stopping data forwarding or clearing every cached value. JSON metric readback can therefore remain stale.
     */
    delete: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Enables runtime GPU monitoring and associated map configuration and starts a cleanup thread. Requires compiled support and available maps; already-enabled requests are rejected. No source linkage was established from this global toggle to an effective per-service routing switch. Cleanup is currently a placeholder; success does not verify GPU-aware traffic selection.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Disables runtime GPU monitoring and stops its cleanup thread; already-disabled requests are rejected. This does not establish that existing services switch to CHWBL, since service selection configuration is separate. Map-update failure can leave partial state and is not a completed transition.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Returns the monitoring flag and cached worker observations, not verified GPU health or effective service routing. Uncompiled support can report routing_mode disabled. Worker count includes cached entries; ebpf_map_loaded checks one worker-statistics map descriptor rather than all required maps.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Conversation cleanup is currently a placeholder. The backend returns zero deletion and age counts without deleting mappings; success does not prove cleanup or an empty conversation table.
     */
    post: {
      parameters: {
        query?: {
          /** @description Requested age threshold in hours, defaulting to one when omitted. Negative values are rejected by the handler. The current backend does not apply the threshold or delete mappings; zero is not a functioning delete-all action. */
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Returns the GPU metrics currently held for every tracked worker, and whether monitoring is enabled at all.
     *
     * Requires the global bearer credential; a viewer role is sufficient. Unlike the POST on this path, the read is not refused while monitoring is disabled -- it reports that state instead, through monitoring_enabled. An empty workers list therefore means "no worker has reported yet" only when monitoring_enabled is true.
     *
     * Each entry's timestamp is the ingestion time the worker reported, not the time this response was built, so a consumer computes staleness as now - timestamp. Ingestion rejects any sample whose timestamp is more than 10 seconds old and substitutes the receive time when a sample carries none, so a timestamp here is never further than that behind the moment the gateway accepted it.
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
        403: components["responses"]["ManagementForbidden"];
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
      };
    };
    /**
     * Update worker GPU metrics
     * @description Submits a complete worker sample, not a partial update. Endpoint, queued_requests and kv_cache_usage_perc are required; omitted optional counters become zero. Active GPU monitoring is required. Cache and map updates can fail partially; successful ingestion does not establish endpoint registration or a verified routing decision.
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Returns public gateway build identity (version, buildInfo and product), without management authentication. This is not a runtime-readiness verdict.
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
     * @description Return BFD sessions when the cluster BFD running flag is set. Current IPv6 host/port parsing can corrupt readback. A session accepted for asynchronous creation may not yet appear; the global running flag can also become inconsistent after deletion.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Create or update a BFD session for an existing cluster instance. New sessions require a valid remote address, interval at least 100000 microseconds, and retryCount greater than zero; first setup also validates source IP. Existing-session zero interval/retryCount preserves that value, while unchanged submissions conflict and source-IP changes are not applied. Interval narrows from uint64 to uint32. First creation is asynchronous and can fail after HTTP success.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Request deletion of a BFD session by remote IP. Supply an existing instance explicitly; omission does not default to the default instance. Safety limitation: instance existence is checked but session ownership is not, and successful deletion clears a global running flag even if other sessions remain. Do not assume instance-scoped isolation or complete BFD shutdown.
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
     * @description Returns cached conntrack observations and active-flow counts by protocol. Inactive count is a collector observation, not a complete inactive inventory. Collection can be stale or uninitialized; optional zero-valued fields can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["FlowCountMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/hostcount": {
    /**
     * Get host count metrics
     * @description Returns cached healthy and unhealthy endpoint-host counts from collection. This is not a fresh health probe; values can be stale or unavailable and optional zero-valued fields can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["HostCountMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/lbrulecount": {
    /**
     * Get load balancer rule count metrics
     * @description Returns the cached load-balancer rule count, not a fresh configuration query. Collection can be stale or uninitialized; a zero-valued field can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["LbRuleCountMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/newflowcount": {
    /**
     * Get new flow count metrics
     * @description Returns the latest collection-cycle count of newly observed conntrack flows, not a rate or HTTP request count. Short-lived flows between collection passes can be missed; cached values can be stale and zero can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["NewFlowCountMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/requestcount": {
    /**
     * Get request count metrics
     * @description Returns accumulated observed conntrack-flow counts, globally and by service, not HTTP request counts. Short-lived flows between collection passes can be missed. Cached values can be stale; optional zero values can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["RequestCountMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/errorcount": {
    /**
     * Get error count metrics
     * @description Returns cached counts of observed conntrack error states, globally and by service, not HTTP error responses. Collection may be stale or uninitialized; optional zero values can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ErrorCountMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/processedtraffic": {
    /**
     * Get processed traffic metrics
     * @description Returns accumulated datapath load-balancer endpoint-counter deltas in bytes and packets, including protocol byte breakdowns. These are counters, not instantaneous throughput. Collection establishes baselines and can be stale; optional zero values can be omitted.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ProcessedTrafficMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/lbprocessedtraffic": {
    /**
     * Get load balancer processed traffic metrics
     * @description Returns cached accumulated conntrack-derived interaction bytes and packets by service, source and destination. This sampled persistent-flow view can miss short-lived flows and is not the same source as aggregate datapath processed-traffic counters.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["LbProcessedTrafficMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/epdisttraffic": {
    /**
     * Get endpoint distribution traffic metrics
     * @description Returns cached conntrack-derived endpoint traffic distribution keyed by service name. Each entry identifies a destination, its value and share within that service; ratio is zero when the denominator is zero. This is not a fresh or complete datapath traffic measurement.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["EpDistTrafficMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/servicedisttraffic": {
    /**
     * Get service distribution traffic metrics
     * @description Returns cached service traffic distribution keyed by service name, with value and share of the observed total. Ratio is zero when the denominator is zero. Collection can be stale or incomplete; this is not an instantaneous rate.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ServiceDistTrafficMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/fwdrops": {
    /**
     * Get firewall drops metrics
     * @description Returns cached current cumulative firewall-rule drop counters and their total, in packets. Values can decrease when rules disappear or counters reset; they are not HTTP errors or rates and can be stale.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["FwDropsMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/metrics/reqcountperclient": {
    /**
     * Get request count per client metrics
     * @description Returns cached conntrack-interaction packet totals keyed by client IP. Despite the operation name, these are packets, not HTTP requests. The sampled flow view can miss short-lived traffic and remain stale when collection is disabled.
     */
    get: {
      responses: {
        /** @description OK */
        200: {
          content: {
            "application/json": components["schemas"]["ReqCountPerClientMetrics"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal service error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/logs": {
    /**
     * Fetch logs with optional filtering
     * @description Fetch log lines newest-first, paging backwards towards the start of the file. When level or keyword is set the server keeps reading backwards until the requested number of *matching* lines has been collected, the start of the file is reached, or the per-request scan budget (32 MiB) is reached. This budget is checked between batches, so a long line can exceed it; it is not a strict memory or response-size limit. Thus has_more means "more matches may exist", not merely "more bytes exist". Offsets in next_cursor are byte offsets into the file the page was read from; for a .log.gz archive they address the uncompressed stream.
     */
    get: {
      parameters: {
        query?: {
          /** @description Requested matching-line count, defaulting to 100 when omitted. The handler currently lacks a strict positive bound and maximum; malformed or nonpositive values can produce an empty successful page. The scan budget is checked between batches, so a long line can exceed the advertised 32 MiB budget. */
          lines?: string;
          /** @description Case-sensitive substring filter, not structured severity parsing. Combined with keyword using AND while scanning backwards; keep unchanged across cursor requests. */
          level?: string;
          /** @description Case-sensitive substring filter combined with level using AND. Keep unchanged across cursor requests; blank lines are excluded and returned lines are trimmed. */
          keyword?: string;
          /** @description Opaque backwards-pagination cursor. Send the same explicit file and filters on subsequent requests; the cursor does not select the file or bind the filters. File mismatch or truncation can silently restart at the tail. Gzip offsets refer to decompressed bytes. */
          cursor?: string;
          /** @description Eligible log basename; when omitted the handler selects a current log file. For stable pagination repeat the response's log_file explicitly. Gzip archives are decompressed again per request with a 64 MiB decompressed-size limit; use the download endpoint for larger archives. */
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/log-archives": {
    /**
     * List available log archives
     * @description Lists eligible active .log files and rotated .log.gz archives from the supported log directories. Duplicate basenames use the first matching directory; listing order is not a global modification-time order.
     */
    get: {
      responses: {
        /** @description List of log archive files */
        200: {
          content: {
            "application/json": components["schemas"]["LogArchives"];
          };
        };
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        /** @description Internal server error */
        500: {
          content: {
            "application/json": components["schemas"]["Error"];
          };
        };
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/log-archives/{filename}": {
    /**
     * Download a specific log archive
     * @description Downloads an eligible log file by basename; gzip archives are transferred as stored rather than decompressed. The current handler can return 500 for a missing file despite the declared 404 response.
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
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
        503: components["responses"]["ManagementStoreUnavailable"];
      };
    };
  };
  "/nodegraph/all": {
    /**
     * List current topology
     * @description Not implemented by the current router configuration; the generated default handler returns 501. The declared topology response is not an available runtime contract, and dormant producer code still has metadata and edge-identity gaps.
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
        403: components["responses"]["ManagementForbidden"];
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
     * @description Not implemented by the current router configuration; the generated default handler returns 501. The declared service-filtered topology response is not an available runtime contract, and dormant producer code still requires validation.
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
        403: components["responses"]["ManagementForbidden"];
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
        401: components["responses"]["ManagementUnauthorized"];
        403: components["responses"]["ManagementForbidden"];
        503: components["responses"]["ManagementStoreUnavailable"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
        200: {
          content: {
            "application/json": components["schemas"]["OperationResult"];
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
  "/config/ai/model-profiles": {
    /**
     * List the published model-prompt profiles
     * @description Returns every profile of the currently PUBLISHED registry generation. Publication is all-or-nothing: a profile that appears here has already passed artifact digest verification, tokenizer load, and (when chat is declared) chat-template compilation - there is no partial or invalid availability state to represent, and disabled/unpublished profiles simply do not appear. Discovery is a CACHE, never an admission authority: a registry reload can change the available set at any time (rule POST admission re-validates against the generation current at POST time). Compare registryGeneration/setDigest with later discovery reads; after create, compare profile identity/generation with the rule's modelProfileId/modelProfileGen and inspect enforcedState. setDigest and bindingDigest identify different objects and must not be compared. profiles is deterministically ordered by profileId ascending with no pagination (the registry is a bounded operator-curated set). Artifact locator paths and host filesystem information are deliberately excluded from the response.
     */
    get: operations["getConfigAiModelProfiles"];
  };
  "/config/ai/model-profiles/{profile_id}": {
    /**
     * Get one published model-prompt profile
     * @description Returns the single profile identified by profile_id in the currently PUBLISHED registry generation (so a client can refresh one profile cheaply). Schema is identical to a list entry. Same cache-not-authority and exclusion rules as the list operation.
     */
    get: operations["getConfigAiModelProfilesProfileID"];
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
     * @description Cancels polling and removes the in-memory singleton configuration. Previously applied firewall rules and the persisted watcher cache are retained. Repeated deletion succeeds. Cancellation does not join an in-flight polling goroutine. This marked stub is intercepted by raw middleware; swagger-extras.yml describes the actual response envelope.
     */
    delete: operations["deleteConfigOpaWatcher"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    /** @description Per-domain replacement counts computed by PLAN, not a minimal difference. to_delete counts current entries and to_apply counts document entries; dry-run does not exercise all apply-time validation. */
    RestorePlanItem: {
      domain?: string;
      to_delete?: number;
      to_apply?: number;
    };
    /** @description Result of POST /config/restore (both dry-run and commit modes). */
    RestoreResult: {
      /** @enum {string} */
      mode?: "dry-run" | "commit" | "boot";
      /** @description Schema-compatibility verdict only, not proof that all validation, apply, verification or persistence stages will succeed. */
      compatible?: boolean;
      schema_version?: string;
      snapshot_gateway_version?: string;
      current_gateway_version?: string;
      plan?: components["schemas"]["RestorePlanItem"][];
      errors?: string[];
      /** @description ok, rolled-back, or ROLLBACK-FAILED; empty when the pipeline stopped before APPLY. */
      result?: string;
      /**
       * Format: uint64
       * @description The restored document's lineage generation (absent for documents that predate generations and for bare captures).
       */
      snapshot_generation?: number;
      /** @description Non-fatal anomalies the pipeline tolerated (degraded external stores, duplicate document items skipped at boot). Warnings never change the result field or trigger rollback. */
      warnings?: string[];
      /** @description The document's recovery-dependency manifest with this restore's per-entry disposition. Required entries are verified before anything is planned, wiped, or applied. */
      external_dependencies?: components["schemas"]["ExternalDependencyStatus"][];
      /** @description Write-through disposition of a committed restore. true when the committed state was persisted to snapshot.json; false when the restore applied but the write-through failed - the applied state will NOT survive a restart until a later persist succeeds (the failure detail is in errors). Absent for dry-run and for pipelines that never reached a successful commit. */
      persisted?: boolean;
      /**
       * Format: uint64
       * @description Lineage generation stamped by the successful write-through (present with persisted=true only).
       */
      persisted_generation?: number;
      /** @description On-disk path of the pre-restore snapshot captured before APPLY (commit mode only). */
      pre_restore_snapshot_persisted?: string;
    };
    /** @description Configuration readiness verdict with the evidence behind it - the boot replay outcome, live external-dependency probes, and the most recent successful persist/restore identities. */
    ReadyStatus: {
      ready: boolean;
      /** @description Why the gateway is not ready; empty when ready. */
      reasons?: string[];
      boot?: components["schemas"]["BootStatus"];
      /** @description Dependency-specific availability checks with ready or failed status. Some checks use configured or builtin state rather than external I/O; this is not uniform live reachability verification of every store or certificate file. */
      external_dependencies?: components["schemas"]["ExternalDependencyStatus"][];
      last_persist?: components["schemas"]["ConfigOpRecord"];
      last_restore?: components["schemas"]["ConfigOpRecord"];
      auto_persist?: components["schemas"]["AutoPersistStatus"];
      /** @description Live per-interface eBPF attachment, verified against the kernel (netlink) rather than the control plane's bookkeeping. Informational - attachment state does not gate the ready verdict. */
      ebpf_attachments?: components["schemas"]["EbpfAttachmentStatus"][];
    };
    /** @description Per-process CPU usage report (the /status/process body, formalized - the wire shape is unchanged). */
    ProcessStatus: {
      processAttr?: components["schemas"]["ProcessInfoEntry"][];
    };
    /** @description Filesystem usage report (the /status/filesystem body, formalized - the wire shape is unchanged). */
    FilesystemStatus: {
      filesystemAttr?: components["schemas"]["FileSystemInfoEntry"][];
    };
    /** @description Bounded utilization of one datapath table against its capacity. Counts only - never entry contents. */
    MapUtilization: {
      /** @description Table name (e.g. conntrack). */
      name: string;
      /**
       * Format: int64
       * @description Entries currently held, as last observed by the gateway's own periodic collector (shares its source with the metrics surface - no second counting layer).
       */
      count: number;
      /**
       * Format: int64
       * @description Maximum entries the table can hold.
       */
      capacity: number;
    };
    /** @description One dependency-specific check with a latency class. Identity is reported by type rather than store contents. Not every check performs external I/O; the latency class is not an end-to-end service-health guarantee. */
    DependencyDiagnostic: {
      /** @description Recovery dependency type, such as api-key-db, auth-db, engine-contracts, kv-model-profiles or cert-store. */
      type: string;
      /** @description Whether recovery treats this dependency as required. */
      required: boolean;
      /**
       * @description Verdict of the check performed for this response; its depth depends on the dependency type.
       * @enum {string}
       */
      status: "ready" | "failed";
      /**
       * @description Probe round-trip class - fast is under 250ms, slow is 250ms or more, failed means the probe errored (its latency is meaningless).
       * @enum {string}
       */
      latency_class: "fast" | "slow" | "failed";
    };
    /** @description Structured diagnostic assembly served by /diagnostics. Nested lifecycle and dependency reasons can contain propagated error text; universal redaction of every such string is not established. */
    DiagnosticsStatus: {
      /** @description Gateway version. */
      version: string;
      /** @description Build/source-revision identity string. */
      build_info?: string;
      /** @description Product identifier. */
      product?: string;
      /** @description Served API contract identity (base path and spec version), read from the embedded spec at startup. */
      api_version?: string;
      /**
       * Format: int64
       * @description Seconds since this gateway's API layer initialized.
       */
      uptime_seconds: number;
      /** @description The same configuration-readiness verdict /status/ready serves. */
      ready: boolean;
      /** @description Why the gateway is not ready; empty when ready. */
      ready_reasons?: string[];
      /**
       * @description The operator maintenance state (see /maintenance for the full drain read-back).
       * @enum {string}
       */
      maintenance_state: "active" | "maintenance";
      /** @description Live per-interface eBPF attachment, kernel-verified. */
      ebpf_attachments?: components["schemas"]["EbpfAttachmentStatus"][];
      /** @description Bounded per-table utilization/capacity. */
      maps?: components["schemas"]["MapUtilization"][];
      external_dependencies?: components["schemas"]["DependencyDiagnostic"][];
      boot?: components["schemas"]["BootStatus"];
      last_persist?: components["schemas"]["ConfigOpRecord"];
      last_restore?: components["schemas"]["ConfigOpRecord"];
      auto_persist?: components["schemas"]["AutoPersistStatus"];
    };
    /** @description One interface/hook attachment fact. A tc entry appears for every port the control plane dispatched a program load for, so attached=false there means the kernel and the control plane's intent disagree. An xdp entry appears only where an XDP program is verifiably attached (XDP expectation depends on datapath compile flags, so its absence is not reported as divergence). */
    EbpfAttachmentStatus: {
      /** @description Interface name. */
      name: string;
      /**
       * @description Attachment hook.
       * @enum {string}
       */
      mode: "tc" | "xdp";
      /** @description Kernel-verified attachment state. */
      attached: boolean;
    };
    /** @description Desired operator maintenance state. */
    MaintenanceRequest: {
      /** @description true enters maintenance, false leaves it. Both directions are idempotent. */
      enabled: boolean;
      /**
       * Format: uint32
       * @description Drain window declared on enter (0 or absent = no deadline). Ignored on a repeat enter and on leave - an episode's window is immutable.
       */
      drain_timeout_seconds?: number;
    };
    /** @description Operator maintenance state with drain read-back. Refusal fields report the observed truth of what this gateway build refuses in the current state, never an aspiration. */
    MaintenanceStatus: {
      /** @enum {string} */
      state: "active" | "maintenance";
      /** @description Identity of the maintenance episode - stable across repeated idempotent enters; a leave response carries the id of the episode it ended; empty when active. */
      operation_id?: string;
      /** @description Mutating configuration API calls are being refused (503), except the configuration-lifecycle operations and the maintenance endpoint itself. */
      refusing_new_config: boolean;
      /** @description New data-path inference requests are being refused. Gateway-wide data-path refusal is not implemented by this management-plane state - this field reports false so no caller mistakes maintenance for a traffic drain; per-service and per-endpoint drain remain the data path's own mechanisms. */
      refusing_new_inference: boolean;
      /**
       * Format: int64
       * @description AI inference streaming sessions (SSE) currently open through the gateway. Non-streaming requests have no in-flight counter and are deliberately not estimated.
       */
      in_flight_streams: number;
      /**
       * Format: date-time
       * @description When the current episode began (absent when active).
       */
      entered_at?: string;
      /**
       * Format: int64
       * @description Seconds spent in the current episode (0 when active).
       */
      elapsed_seconds: number;
      /**
       * Format: uint32
       * @description The episode's declared drain window (0 = none declared).
       */
      drain_timeout_seconds?: number;
      /** @description The declared drain window has elapsed. The gateway never leaves maintenance on its own - the operator owns the transition; an overrun is reported, not acted on. */
      drain_deadline_exceeded: boolean;
      /** @description The maintenance gate itself permits leaving and reports true. Independent boot or restore freezes, authentication and authorization can still reject the request; this is not an unconditional ability to leave right now. */
      cancellable: boolean;
    };
    /** @description Auto-persist failure streak (present only while failing; any successful persist clears it). Nonzero means recent config changes may not survive a restart - also surfaced as a not-ready reason and in the loxilb_autopersist_consecutive_failures gauge. */
    AutoPersistStatus: {
      consecutive_failures?: number;
      last_error?: string;
      /** Format: date-time */
      last_attempt?: string;
    };
    /** @description The boot config replay's recorded outcome. */
    BootStatus: {
      /** @description The --config-boot-profile the boot ran under (strict or compat). */
      profile?: string;
      snapshot_found: boolean;
      succeeded: boolean;
      /**
       * Format: uint64
       * @description Applied boot document's lineage generation (success only).
       */
      generation?: number;
      /** @description Where a failing snapshot was preserved (failure only). */
      quarantine_path?: string;
      /** @description The compat profile replayed the legacy *.txt artifacts after a failed snapshot restore. */
      legacy_fallback: boolean;
      /** @description The boot snapshot restore failed (strict booted empty; compat may be running legacy-replayed configuration). */
      degraded: boolean;
      reasons?: string[];
    };
    /** @description One successful persist or restore - identity of what is durable/applied. */
    ConfigOpRecord: {
      /** Format: uint64 */
      generation?: number;
      checksum?: string;
      /** @description For persists, the capture trigger (write-through, manual); for restores, commit or boot. */
      mode?: string;
      /** Format: date-time */
      at?: string;
    };
    /** @description Identity of one external recovery dependency (from the snapshot document's recovery_dependencies manifest) plus the reporting operation's disposition toward it. Identity only - never store content or credentials. */
    ExternalDependencyStatus: {
      /** @description Dependency type (api-key-db, auth-db, engine-contracts, kv-model-profiles, cert-store). */
      type?: string;
      /** @description Stable identity of the concrete store instance (database name, registry root); absent for single-instance types. */
      id?: string;
      /** @description Store generation at capture (decimal string or opaque version token); absent for stores without generation tracking. */
      generation?: string;
      /** @description Store content digest at capture ("sha256:<hex>"); absent for stores without content digests. */
      digest?: string;
      /** @description Whether recovery of the captured configuration requires this store (restore verifies required entries before planning anything). */
      required?: boolean;
      /**
       * @description Persist responses report ready (identity read from the live process) or configured (store wired; reachability deliberately unclaimed - the readiness surface owns liveness). Restore responses report verified, warning (detail in warnings), failed (detail in errors; the restore stopped before mutating anything), or declared (optional entry, informational only).
       * @enum {string}
       */
      status?: "ready" | "configured" | "verified" | "warning" | "failed" | "declared";
    };
    /** @description Result of POST /config/persist - the persisted document's identity and coverage, so automation can verify what was saved without re-reading the file. */
    PersistResult: {
      /** @description Always "ok" on 200. */
      result?: string;
      /** @description On-disk path of the persisted snapshot (config-path/snapshot.json). */
      path?: string;
      /** @description SHA-256 checksum of the persisted snapshot document. */
      checksum?: string;
      /** @description Schema version of the persisted document. */
      schema_version?: string;
      /**
       * Format: uint64
       * @description Monotonic lineage generation stamped into the persisted document.
       */
      generation?: number;
      /** @description The snapshot domains the persisted document covers. */
      included_domains?: string[];
      /** @description Configuration areas deliberately never captured by snapshots (honesty marker). */
      excluded_domains?: string[];
      /** @description The persisted document's recovery-dependency manifest with capture-time dispositions. */
      external_dependencies?: components["schemas"]["ExternalDependencyStatus"][];
      /** @description Non-fatal anomalies of this persist; empty on a clean save. */
      warnings?: string[];
    };
    /** @description Result envelope returned by configuration operations that succeed with a body ({"result":"Success"} or an informational message). */
    OperationResult: {
      /** @description Outcome message. "Success" for most operations; some carry an informational sentence instead. */
      result?: string;
    };
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
    /** @description Resolved KV-exact status of one rule, not a configuration request body. Identity fields are scalar: an allocated strict binding composes one model profile and one engine contract at their respective generations. Required fields are emitted for legacy and strict entries. hashContractId is also computed for legacy entries. modelProfileId identifies a bound declaration, but generation, bindingDigest and requiredEvidenceLevel may be absent on a strict rule whose binding is unresolved or missing; do not interpret their absence as a profile-less rule. enforcement is included for strict rules and restored legacy rules fenced for migration. wireSchemaId and pdDialectId are optional informational identities; clients must not infer readiness from their presence or absence alone. State and reason vocabularies are published in the x-kv-status-states / x-kv-status-reason-codes blocks below as an OPEN vocabulary versioned by x-kv-status-vocabulary-version (new values bump the version; existing values are never renamed or re-used). Forward-compatibility rule, binding on clients: an unrecognized desiredState/enforcedState MUST be treated as "not ready / in transition" and rendered raw; an unrecognized reasonCode MUST be rendered raw and MUST NOT be treated as fatal. */
    KvExactStatusEntry: {
      /** @description Stable opaque id of the load-balancer rule. */
      ruleIdentity: string;
      /** @description Served model name the rule keys its endpoint pool on. */
      modelName: string;
      /** @description Effective KV-event engine family (absent kvEngineType resolves to vllm). */
      engineFamily: string;
      /** @description Effective KV-exact API surface declaration (completions/chat/both; an absent kvExactApiMode resolves to the bound profile's declared surfaces, or "both" on a legacy rule). */
      apiMode: string;
      /** @description Bound ModelPromptProfile ID (absent on a legacy profile-less rule). */
      modelProfileId?: string;
      /**
       * Format: uint64
       * @description Registry generation the allocated binding used. May be absent when a declared profile is unresolved or the binding is missing; inspect enforcedState and reasonCodes.
       */
      modelProfileGen?: number;
      /** @description Bound engine-contract ID (absent on a legacy profile-less rule). */
      engineContractId?: string;
      /**
       * Format: uint64
       * @description Contract generation the binding was composed at.
       */
      engineContractGen?: number;
      /**
       * Format: uint32
       * @description Rule-scoped monotonic binding generation (data-plane handle; 0 is reserved and never a valid generation).
       */
      bindingGen?: number;
      /** @description Full digest over the composed binding identity. The digest, never the generation handle, is the identity proof. */
      bindingDigest?: string;
      /** @description Block-hash contract the rule's data plane computes with (the effective kvHashAlgo). */
      hashContractId?: string;
      /** @description Engine-contract wire-schema identity (absent until an engine-contract registry serves it). */
      wireSchemaId?: string;
      /** @description Engine-contract P/D dialect identity (absent until an engine-contract registry serves it). */
      pdDialectId?: string;
      /** @description Support-catalog evidence level the binding requires of its engine tuple (absent on legacy rules). */
      requiredEvidenceLevel?: string;
      /** @description Desired attestation-ladder state (LEGACY_ACTIVE_UNATTESTED on profile-less rules, PROFILE_VALIDATED and upward on strict rules). */
      desiredState: string;
      /** @description State the data plane actually enforces. Honest about pending machinery - a strict rule reports PENDING_DATAPLANE_CONTRACT until the data-plane contract word and attestation controller enforce its binding; a strict rule with missing binding state reports ENFORCEMENT_FAULT, never a silent legacy downgrade. */
      enforcedState: string;
      /** @description Typed reasons explaining enforcedState (x-kv-status-reason-codes vocabulary). Always present; MAY be empty - an empty array means "no qualifying reason", not "unknown". */
      reasonCodes: string[];
      enforcement?: components["schemas"]["KvExactEnforcement"];
    };
    /** @description Enforcement position of a strict KV-exact rule or a restored legacy rule fenced for migration. Ordinary active legacy rules omit this object. desired and enforced distinguish requested and acknowledged enforcement; lastAckAt is absent before the first full ACK after registration/restart, and fault is absent when none. Inspect goFenced independently as the tokenize-bridge backstop; declaration/readback alone is not enforcement. */
    KvExactEnforcement: {
      /** @description Desired attestation-ladder state. */
      desired: string;
      /** @description State the data plane actually enforces. */
      enforced: string;
      /** @description RFC3339 time of the last full contract-word ACK (readback and binding-digest halves both verified). Absent before the first ACK after registration or restart. */
      lastAckAt?: string;
      /** @description Last enforcement fault reason (absent when none). */
      fault?: string;
      /** @description Whether the authoritative tokenize-bridge deny-set fence currently denies the rule (fail-closed backstop - denied rules produce no tokens, so no hashes, regardless of C-side state). Always serialized - a lifted fence (false) must stay distinguishable from an unreported one. */
      goFenced?: boolean;
    };
    /** @description The currently published model-profile registry generation as a read-only discovery envelope. registryGeneration and profiles are always present; registryGeneration 0 with an empty profiles array is the documented no-registry-published (legacy-mode) state. setDigest is the immutable digest over the generation's profiles AND their verified artifacts - present whenever a generation is published, absent at generation 0. */
    AiModelProfileRegistry: {
      /**
       * Format: uint64
       * @description Monotonic generation number of the published registry (0 = no registry published).
       */
      registryGeneration: number;
      /** @description Digest over the published registry generation's profile documents and verified artifact bytes. Compare with later discovery reads to detect a registry reload. Do not compare setDigest with kvexactstatus.bindingDigest: the latter identifies a rule's composed model-profile/engine-contract binding, not the registry set. After creation, compare the selected profile identity/generation with modelProfileId/modelProfileGen and inspect the rule's enforcedState; POST admission remains authoritative. */
      setDigest?: string;
      /** @description Every published profile, deterministically ordered by profileId ascending. No pagination - the registry is a bounded operator-curated set. Always present; empty array means "no profiles published", never "unknown". */
      profiles: components["schemas"]["AiModelProfileEntry"][];
    };
    /** @description One published model-prompt profile (list and detail representations are identical). Presence conveys validity by construction - publication is all-or-nothing, so every entry has already passed artifact digest verification and tokenizer load; there is no partial or invalid state. tokenizerSha256 is always present (publication requires it); templateSha256/templateContentFormat are present iff a chat template is bound. The sha256 digests are the immutable audit/drift identities of the profile's artifacts. Artifact locator paths, the registry root, and any host filesystem information are deliberately EXCLUDED from this representation. */
    AiModelProfileEntry: {
      /** @description Registry key of the profile (a single path-safe segment). */
      profileId: string;
      /**
       * Format: uint64
       * @description Registry generation this entry was published at (equals the envelope's registryGeneration on the list operation).
       */
      gen: number;
      /** @description Served base-model identity (e.g. "Qwen/Qwen3-32B"). */
      baseModel: string;
      /**
       * @description base_model_only (only the base model name routes to this profile) or list (allowedAliases route additionally). There is no "any".
       * @enum {string}
       */
      aliasPolicy: "base_model_only" | "list";
      /** @description Additional served model names (present iff aliasPolicy is list). */
      allowedAliases?: string[];
      /** @description Request surfaces this profile serves (completions/chat). Always present and non-empty. */
      supportedApis: string[];
      /** @description Request features the profile explicitly supports (absent when none declared). */
      supportedFeatures?: string[];
      /** @description Request features the profile explicitly refuses (absent when none declared). */
      excludedFeatures?: string[];
      /** @description Upstream tokenizer revision the artifact was captured from (informational provenance; absent when not recorded). */
      tokenizerRevision?: string;
      /** @description Pinned sha256 of the tokenizer artifact bytes. Always present - the registry refuses to publish a profile without a verified tokenizer. */
      tokenizerSha256: string;
      /** @description Pinned sha256 of the chat-template artifact bytes (present iff a chat template is bound). */
      templateSha256?: string;
      /** @description Declared message content format of the bound chat template (present iff a chat template is bound and the profile declares it). */
      templateContentFormat?: string;
      /** @description Engine that renders the template on the serving path (absent when not declared). */
      rendererEngine?: string;
      /** @description Version of the serving-path renderer (absent when not declared). */
      rendererVersion?: string;
      /** @description Parity-oracle engine the rendered bytes are attested against (absent when not declared). */
      oracleEngine?: string;
      /** @description Version of the parity oracle (absent when not declared). */
      oracleVersion?: string;
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
    /** @description One ordered route with OR-combined match sets, AND-combined conditions and a FORWARD, REDIRECT or REJECT action. The first matching route in ascending position order wins. No match produces a synthetic 404. Implementation warning: admission does not reject every input exceeding C capacity. Conversion silently limits each route to 8 match sets, each set to 8 conditions and each forward target to 32 references. This can change policy meaning while GET retains the original document; these are defects requiring admission/runtime fixes, not supported truncation semantics. This schema does not establish complete Octavia or Gateway API translation compatibility. */
    L7Rule: {
      /** @description Evaluation precedence, ascending. Equal-position ordering is unspecified. The value narrows to a C int without a matching admission range check; unique positions within that range avoid this implementation gap. */
      position?: number;
      /** @description OR across sets; AND within each conditions array. An empty array or a set with no conditions does not match. See the L7Rule warning about unvalidated capacity limits. */
      matchSets?: {
          conditions?: components["schemas"]["L7Condition"][];
        }[];
      action?: components["schemas"]["L7Action"];
      /** @description Ordered SET, ADD or REMOVE request-header operations. The shared validator permits at most 8 entries, 63-byte names and 255-byte values, and rejects CR/LF and other prohibited control characters. Omitting this list disables configured operations, but the L7 path still synthesizes X-Forwarded-For, X-Forwarded-Port and X-Forwarded-Proto before applying these operations. Configured operations can overwrite that synthesized metadata; trust-boundary policy remains to be decided. Implementation warning: Go validation admits interior tabs in names that C later skips. This is not supported header syntax. */
      insertHeaders?: ({
          /**
           * @description SET replaces a header, ADD appends a value, and REMOVE removes the named header. Use the canonical uppercase enum spelling.
           * @enum {string}
           */
          op?: "SET" | "ADD" | "REMOVE";
          /** @description Header name, required by shared validation and limited to 63 bytes. Use an HTTP token name; see the containing schema's validation-gap warning. */
          name?: string;
          /** @description Header value, limited to 255 bytes. Empty values are accepted. REMOVE ignores the value when applying the operation but still validates its length and control characters. */
          value?: string;
        })[];
      /**
       * @description HTTP_COOKIE enables generated-cookie affinity on matching routes; omit to disable this marker. The REST enum does not expose APP_COOKIE or SOURCE_IP. Implementation warning: shared validation checks a policy-wide mixture of affinity labels, but does not inspect the LB's selector or session-header settings to enforce per-pool mutual exclusion. Cross-mode policy and runtime qualification remain outstanding.
       * @enum {string}
       */
      sessionPersistence?: "HTTP_COOKIE";
    };
    /** @description One predicate, AND-combined within a match set. */
    L7Condition: {
      /**
       * @description Request field to match. HOST strips the authority port; PATH reads the parsed request path; HEADER, COOKIE and QUERY use the named field; FILE_TYPE extracts the final path segment's extension without the dot. METHOD reads the captured method only in builds with HAVE_HTTP_TRACE; other builds have no METHOD operand, an implementation limitation. SSL_* fields are rejected.
       * @enum {string}
       */
      field: "HOST" | "PATH" | "HEADER" | "COOKIE" | "FILE_TYPE" | "METHOD" | "QUERY";
      /**
       * @description Comparison operator. FILE_TYPE accepts only EQUAL_TO or REGEX. String comparisons are case-sensitive; HEADER name lookup is separately case-insensitive. SEGMENT_PREFIX checks a segment boundary. Implementation warning: the current root-slash prefix handling does not match all paths; do not rely on it as a catch-all without a runtime fix.
       * @enum {string}
       */
      op: "EQUAL_TO" | "STARTS_WITH" | "SEGMENT_PREFIX" | "ENDS_WITH" | "CONTAINS" | "REGEX";
      /** @description Name required for HEADER, COOKIE and QUERY. Implementation warning - conversion limits this string to 63 bytes without rejecting oversized input; embedded NULs also cannot preserve the submitted string in C. */
      key?: string;
      /** @description Comparison operand. REGEX requires a nonempty pattern, validated with Go regular-expression syntax and compiled again as POSIX extended syntax on attachment; those syntaxes are not equivalent. Implementation warning: conversion limits the configured value to 255 bytes without admission rejection, and runtime REGEX operands are limited to 1023 bytes. Embedded NULs or truncation can change meaning. Passing admission does not establish full-length or cross-engine matching equivalence. */
      value?: string;
      /** @description Negates the comparison result. An absent request field is a non-match before inversion and therefore matches an inverted condition. The REST operation does not export to Gateway API; the standalone export guard is not connected to an export operation. */
      invert?: boolean;
    };
    /** @description Action selected by kind. FORWARD requires forward; REDIRECT requires redirect; REJECT permits an omitted reject object. Implementation warning: validation does not reject extra objects for other kinds. H1 synthetic REJECT/REDIRECT responses use raw socket writes without an SSL write branch; encrypted H1 response correctness is not established. H2 uses a separate framed responder. */
    L7Action: {
      /**
       * @description FORWARD selects a backend target; REDIRECT emits a terminal synthetic 3xx; REJECT emits a terminal synthetic 4xx. No Gateway API export is performed by these operations.
       * @enum {string}
       */
      kind: "FORWARD" | "REDIRECT" | "REJECT";
      /** @description Target within the listener's base endpoint pool. With no references the resolver returns the base pool; with references it constructs a subset using RR or WRR selection. Implementation warnings: poolId is not used to resolve an independent pool, and allocation failure can return the whole base pool instead of the subset. The fallback is a safety defect, not a promised routing policy. */
      forward?: {
        /**
         * Format: uint32
         * @description Stored and copied identifier. Implementation gap - the current C resolver does not use it to select a pool.
         */
        poolId?: number;
        /** @description Endpoint-slot references within the base pool. Empty means the whole base pool. Invalid indices are skipped at resolution; admission does not check pool membership or enforce the 32-reference C limit. */
        backendRefs?: {
            /**
             * Format: uint32
             * @description Internal base-pool endpoint slot. This is not a stable endpoint ID or necessarily the original POST-array position; creation sorts endpoints and updates reconcile existing slots.
             */
            ep?: number;
            /** @description Nonzero weight overrides the member weight; zero inherits it. Implementation gap - the value narrows to uint8 without an admission range check, so negative or oversized values can change meaning. */
            weight?: number;
          }[];
      };
      /** @description REDIRECT target. statusCode is restricted to {301,302,303,307,308} (default 302). */
      redirect?: {
        /** @description Explicit scheme or, when empty, http/https derived from the client TLS state. No scheme allow-list is enforced; the C field carries at most 7 bytes. */
        scheme?: string;
        /** @description Explicit host or the request Host/authority when empty, with its port stripped. Use port for an override. The C field carries at most 255 bytes; admission does not reject oversized input. */
        host?: string;
        /** @description Optional destination port; zero omits the port and an explicit scheme-default port is also omitted. The value narrows to uint16 without an admission range check. */
        port?: number;
        /**
         * @description NONE retains the request path; REPLACE_FULL uses value. Implementation gap: REPLACE_PREFIX currently joins value with the entire request path instead of removing the matched prefix. It does not implement correct matched-prefix replacement and must not be presented as such.
         * @enum {string}
         */
        pathOp?: "NONE" | "REPLACE_FULL" | "REPLACE_PREFIX";
        /** @description Replacement path value. The C field carries at most 255 bytes without an admission bound. Redirect assembly rejects CR/LF or an unusable target at request time; configuration admission does not fully validate the URL. */
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
    /** @description Independently stored policy and ordered routes, attached through an existing load-balancer ID. Create, list, get and delete are available; update is not. Implementation warnings: the registry enforces one policy per LB ID, while C attaches by VIP/port/protocol. Different LB resources sharing that tuple can overwrite the same attached policy; resource-versus-listener ownership is an unresolved policy decision. Attachment uses the external VIP even where LB programming uses privateIP. LB deletion can retain a C listener and routes; FullProxy replacement can clear listener arguments without rebuilding TLS contexts or restoring those arguments on reuse. Registry readback is not evidence of effective policy, TLS, HSTS or timeout state. See child schemas for capacity and response-path defects requiring implementation fixes. */
    L7Policy: {
      /** @description Opaque policy identifier. A supplied value is stored; an empty value is replaced with a UUID. Reusing an existing ID, even with identical content, returns 409 through REST. POST does not return the minted ID in its 204 response. */
      id?: string;
      /** @description Human-readable policy name. */
      name?: string;
      /** @description Nonblank identifier of an existing LB resource, discoverable through GET /config/loadbalancer/id/{id}. Missing resources return 404. The resource must also have an eligible IPv4 sockproxy listener; resource existence alone does not guarantee attachment. */
      lbId: string;
      /** @description At least one route is required by shared validation. Evaluation is first-match-wins by ascending position; stored GET order is not an effective-order or capacity-validation report. */
      rules: components["schemas"]["L7Rule"][];
    };
    /** @description Registry collection wrapper, sorted by policy ID. Values are stored configuration, not effective dataplane or runtime validation results. */
    L7PolicyGetEntry: {
      l7policyAttr?: components["schemas"]["L7Policy"][];
    };
    /** @description Shared request/readback representation. POST can create or replace an existing rule; PATCH supports only the restricted L4 overlay described on its operation. Create callers must supply serviceArguments and usable endpoints. Implementation warning: the POST handler dereferences serviceArguments without a nil guard, although the shared schema permits its omission for PATCH. Configuration acceptance and GET readback do not establish runtime enforcement. See serviceArguments and endpoints for intake, update and readback gaps. */
    LoadbalanceEntry: {
      /** @description Service configuration. Implementation warnings for this REST representation: POST does not copy adminStateUp, connectionLimit or snat into the domain. GET omits privateIP, connectionLimit, timeoutMemberConnect, timeoutMemberData, timeoutTcpInspect, vip_qos_policy_id, alpn_protocols, tls_ciphers, tls_versions, hsts_max_age, hsts_include_subdomains, hsts_preload, backend_ca_cert_id, backend_client_cert_id and mtls_frontend.client_crl_path. GET/edit/POST is therefore not a lossless configuration round trip. PATCH has a limited overlay and does not update arbitrary properties. Metadata-only POSTs can return an unchanged-rule error before applying metadata; managed is not assigned on the existing-rule update path. FullProxy replacement removes its pool but C retains the listener; reuse does not reliably restore listener arguments or rebuild TLS contexts, so updated TLS/HSTS/timeout settings are not established by stored state. Requested-security fail-closed behavior and LB-resource/listener policy ownership remain unresolved; these defects are not supported fallback or update semantics. */
      serviceArguments?: {
        /** @description Opaque LB identifier, supplied by the client or minted as UUIDv4 when absent. Collisions with another rule are rejected. The update path can replace an ID when another change is applied; do not assume immutable identity or automatic L7 reference migration. */
        id?: string;
        /** @description Service lifecycle flag. In the domain, absent/true enables new selection and false pauses new selection while retaining members. Implementation gap: POST drops this property, so false does not create a paused rule. The restricted L4 PATCH path handles explicit changes and GET reports effective state. Source behavior does not prove established-connection preservation. */
        adminStateUp?: boolean;
        /** @description Opaque project identifier stored on creation and available as an exact GET /all filter. The filter is not tenant authorization or isolation. Empty values do not clear an existing project ID; see the shared update limitations. */
        projectId?: string;
        /**
         * Format: uint32
         * @description Requested concurrent-connection ceiling across the service's endpoints; zero represents unlimited. Distinct from a per-source-IP security limit. The domain and eBPF conntrack selector contain a per-rule limit gate, but this REST POST does not copy the value, PATCH does not overlay it, and normal GET omits it. This field cannot currently establish an enforced connection limit through these REST operations.
         */
        connectionLimit?: number;
        /** @description Opaque metadata, not interpreted as configuration. Implementation limitation: storage retains only the first 32 keys in sorted order and truncates values to at most 256 bytes without splitting UTF-8. Oversized input is therefore not stored verbatim. See the shared metadata-update warning; these lossy bounds are not admission guarantees. */
        annotations?: {
          [key: string]: string;
        };
        /** @description External service IP used in the LB rule key. The domain validates the address. Create callers must provide it; shared PATCH-compatible schema optionality does not make an omitted create address usable. */
        externalIP?: string | null;
        /** @description Optional translated/private service IP used for dataplane programming and validated as an IP address. Normal GET does not reconstruct it. L7 attachment still uses externalIP, so private-address listener attachment is not established. */
        privateIP?: string;
        /** @description Service port, or inclusive range start when portMax is nonzero. ICMP requires zero. Implementation gap - the handler narrows to uint16 without validating the original integer range; clients should supply 0 through 65535 and not rely on narrowing. */
        port?: number | null;
        /** @description Inclusive range end. Zero uses a single service port; a nonzero end below port is rejected after uint16 conversion. Original input range validation is missing, and a port range does not establish FullProxy/L7 attachment support. */
        portMax?: number;
        /**
         * @description Transport protocol of the service. ICMP requires zero service and endpoint ports. PROXY protocol v2 requires TCP; N3 selection requires UDP.
         * @enum {string}
         */
        protocol?: "tcp" | "udp" | "sctp" | "icmp";
        /**
         * @description Endpoint selection algorithm (0=RR, 1=hash, 2=priority/WRR, 3=persistence, 4=least connections, 5=N2, 6=N3, 7=reserved, 8=CHWBL, 9=GPU-aware, 10=WRR-hash). Zero selects RR. DSR requires hash; N3 requires UDP; N2 requires FullProxy in the current domain guard. Reserved value 7 has no supported selector contract. Consult the corresponding AI field descriptions for AI selector prerequisites.
         * @enum {integer}
         */
        sel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        /** @description Requests BGP advertisement of the service and flat secondary IPs after a successful add when the BGP component is available. This flag alone does not establish a BGP session or route advertisement; structured secondaryVIPs are not advertised by this hook. */
        bgp?: boolean;
        /** @description Requests active endpoint monitoring. An explicit probetype other than none forces this flag true in the domain; some NAT modes also activate probes. False alone is not a universal disable switch. */
        monitor?: boolean;
        /**
         * @description Service-wide probe type. TCP, UDP, SCTP, HTTP and HTTPS require a nonzero probeport; ping and none require zero. An omitted type requires zero probeport and allows the probe builder to derive transport and port from each member.
         * @enum {string}
         */
        probetype?: "tcp" | "udp" | "sctp" | "http" | "https" | "ping" | "none";
        /**
         * Format: uint16
         * @description Service-wide probe destination port, also used with monitorAddress. Required nonzero for explicit TCP/UDP/SCTP/HTTP/HTTPS probes; zero for ping, none or an omitted probe type. There is no per-member monitor-port property here.
         */
        probeport?: number;
        /** @description Probe request payload or request-path input interpreted by the selected probe implementation. This service-level field is wired; the separate endpoint HTTP monitor properties have the wiring gaps documented on endpoints. */
        probereq?: string;
        /** @description Expected probe response content interpreted by the selected probe implementation. This is not the endpoint expectedCodes HTTP status-code property. */
        proberesp?: string;
        /** @description Externally managed rule marker stored at creation. Implementation gap - the existing-rule path does not assign a new value, so create support does not establish update support. */
        managed?: boolean;
        /**
         * Format: int32
         * @description NAT/proxy mode (0=DNAT, 1=one-arm, 2=FullNAT, 3=DSR, 4=FullProxy, 5=host one-arm). Zero selects DNAT. DSR requires hash selection and endpoint ports equal to the service port. Host one-arm requires an unspecified VIP. FullProxy is the userspace proxy path; PATCH rejects it, and POST replacement has the listener-state limitations documented on serviceArguments.
         * @enum {integer}
         */
        mode?: 0 | 1 | 2 | 3 | 4 | 5;
        /**
         * Format: int32
         * @description Proxy TLS mode (0=no proxy TLS, 1=frontend TLS termination, 2=frontend TLS plus backend re-encryption). Zero does not imply that an arbitrary L4 service speaks HTTP. Values outside this enum are rejected by generated validation. These are FullProxy TLS settings; admission does not comprehensively reject ineffective cross-mode configurations. Mode 2 does not establish backend certificate verification; see mtls_backend and the requested-security warning.
         * @enum {integer}
         */
        security?: 0 | 1 | 2;
        /**
         * Format: uint32
         * @description Rule block identifier included in the LB key. VIP/port/protocol alone may therefore identify more than one logical rule; it is not sufficient to establish L7 policy ownership.
         */
        block?: number;
        /**
         * Format: int32
         * @description Inactivity timeout in seconds. The domain rejects values above 86400; zero resolves to 240 for TCP/SCTP and 20 for other protocols. On an attached L7 policy, a nonzero timeoutMemberData overrides the relay idle deadline.
         */
        inactiveTimeOut?: number;
        /**
         * Format: uint32
         * @description Probe scheduling interval in seconds; zero selects the probe builder's default. It is distinct from the backend connect timeout. Canonical PATCH updates currently miss the handler's presence check; see the operation warning.
         */
        probeTimeout?: number;
        /**
         * Format: int32
         * @description Probe failure threshold passed to endpoint monitoring; zero uses the probe builder's default. Canonical PATCH updates currently miss the handler's presence check. Negative input has no matching schema range restriction and is not a qualified setting.
         */
        probeRetries?: number;
        /**
         * Format: uint32
         * @description Backend connect timeout in milliseconds, used when an L7 policy is attached. Zero uses 500 ms. Implementation gap: the value narrows to signed C int for poll without an admission bound; values above 2147483647 can become negative and must not be treated as supported deadlines. See serviceArguments for update/readback limitations.
         */
        timeoutMemberConnect?: number;
        /**
         * Format: uint32
         * @description Relay idle timeout in milliseconds on a listener with an attached L7 policy. A nonzero value overrides the existing deadline and is rounded up to whole seconds; zero leaves the existing idle deadline in use. Implementation gap: uint32 addition during rounding can overflow near its maximum. Millisecond input does not imply subsecond enforcement.
         */
        timeoutMemberData?: number;
        /**
         * Format: uint32
         * @description Header-accumulation deadline in milliseconds on the attached L7 policy path. Zero uses 10000 ms. This is not a general transport-level TCP inspection timeout or a claim of controller export support.
         */
        timeoutTcpInspect?: number;
        /** @description Service name stored and returned with the rule. A colon-separated name also participates in the domain's instance-name selection; it is not the opaque rule ID. */
        name?: string;
        /** @description SNAT rule indicator on domain readback. Implementation gap - this REST POST does not copy the property and PATCH does not overlay it, so setting it here does not create a SNAT rule. */
        snat?: boolean;
        /**
         * Format: int32
         * @description Endpoint operation label (0=create/replace, 1=attachEP, 2=detachEP). Implementation gap: on an existing rule, operation 1 takes the same omission/removal branch as replacement, so it is not a safe append-only operation. Detaching the last endpoint can delete the rule. PATCH separately rejects clearing all endpoints.
         * @enum {integer}
         */
        oper?: 0 | 1 | 2;
        /** @description Host routing key for the proxy pool, distinct from path_prefix. It participates in the LB rule key, but L7 policy attachment is currently keyed only by listener VIP/port/protocol. The server accepts at most 255 UTF-8 bytes and rejects embedded NUL or invalid UTF-8 before changing rule state. This byte limit reserves the terminator in the 256-byte data-plane field; UI validation must count encoded bytes rather than characters. Together with path_prefix and model_name, the conditional host, host|path, host||model or host|path|model key must not exceed 511 UTF-8 bytes including separators. */
        host?: string;
        /** @description Path component of the proxy pool's routing key, interpreted with path_match_mode. Empty preserves host-only routing unless model_name adds a host||model identity. This field is separate from conditions in an independently attached L7Policy. The server accepts at most 255 UTF-8 bytes and rejects embedded NUL or invalid UTF-8 before changing rule state. This byte limit reserves the terminator in the 256-byte data-plane field; UI validation must count encoded bytes rather than characters. The encoded host/path_prefix/model_name relationship is separately limited to 511 UTF-8 bytes including separators. */
        path_prefix?: string;
        /**
         * @description Proxy pool path mode - disabled uses host-only matching, prefix uses longest-prefix selection, and exact uses an exact path. The mode participates in the logical LB key and is distinct from L7Condition comparison operators.
         * @default disabled
         * @enum {string}
         */
        path_match_mode?: "disabled" | "prefix" | "exact";
        /** @description Enables PROXY protocol v2 on the supported backend path. The domain rejects non-TCP services when this flag is true; configure a backend that accepts the protocol header. */
        proxyprotocolv2?: boolean;
        /** @description Marks an egress rule. The ordinary LB2DP programming path returns early for this marker; do not infer ordinary ingress FullProxy behavior. The existing-rule path rejects changes to this flag. */
        egress?: boolean;
        /** @description Tracing catalog name, for example v1, anthropic or default. The domain resolves and maps it for the FullProxy tracing path when the catalog component is available. A configured name alone does not prove capture or parser execution. */
        trace_type?: string;
        /**
         * @description FullProxy HTTP capability - http1 selects HTTP/1.1, http2 selects HTTP/2, and both prefers HTTP/2 with HTTP/1.1 fallback. The capability is shared by listener/backend ALPN configuration; recognized alpn_protocols values override it. GET reports this field only for FullProxy.
         * @default http1
         * @enum {string}
         */
        backend_protocol?: "http1" | "http2" | "both";
        /** @description Model routing key for the endpoint pool. Empty selects the legacy wildcard pool only when KV Exact is disabled. kvExactMode=1 or 3 requires a non-empty name with a loadable matching tokenizer; a bound kvModelProfile must also admit this name through its alias policy. A family-name match alone does not establish tokenizer, template, or engine compatibility. The server accepts at most 127 UTF-8 bytes and rejects embedded NUL or invalid UTF-8 before changing rule state. This byte limit reserves the terminator in the 128-byte data-plane field; UI validation must count encoded bytes rather than characters. The encoded host/path_prefix/model_name relationship is separately limited to 511 UTF-8 bytes including conditional separators. */
        model_name?: string;
        /**
         * @description Enable detection of text/event-stream responses and the associated streaming idle-timeout protection. This flag controls Gateway SSE handling, not whether the backend implements an OpenAI API. Active detected streams remain subject to max_stream_duration_sec and the system stream cap; enabling SSE does not make them unbounded.
         * @default false
         */
        sse_mode?: boolean;
        /**
         * @description Data-plane X-Api-Key enforcement declaration for this service. Three states, and omission is one of them. OMITTED declares nothing: the service is not marked AI-facing, proxying stays byte-identical, and a backend-owned X-Api-Key header passes through untouched. An explicit "disabled" declares the service AI-facing without enforcement: no key is validated, but X-Api-Key is the gateway's credential namespace and the header is stripped before dispatch. "required" makes the data plane validate the X-Api-Key header against the API-key store before the request reaches a backend, fails closed when the policy cannot be evaluated, and likewise strips the header. Reading a service back preserves the declaration exactly: an omitted policy reads back with this field absent, never resolved to a value. On a replace of an existing service, omitting this field leaves the declared policy unchanged — it never silently turns enforcement off; to clear a declared policy, send "disabled" explicitly. Independent of sse_mode and pd_disagg_mode, and independent of the management-plane authentication mode.
         * @enum {string}
         */
        api_key_auth?: "disabled" | "required";
        /**
         * Format: int32
         * @description Duration limit for an active detected SSE response, in seconds. Omission or 0 uses the system cap of 86400 seconds; a positive value uses min(value, 86400). The periodic timeout walk terminates a stream when tracked elapsed time reaches the effective cap. QoS parking currently advances the stream start anchor to exclude parked time, so this is not a strict end-to-end wall-clock SLA. This limit is distinct from backend keepalive, connection idle timeout, and P/D session-affinity TTL.
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
         * @description Enable the per-endpoint circuit breaker for full-proxy rules. Five consecutive backend connect failures open the breaker; an open endpoint is excluded from selection. Recovery uses a 30-second open interval followed by half-open probing. This is independent of the configured health monitor (probetype); one failed request does not by itself meet the opening threshold.
         * @default false
         */
        cb_enable?: boolean;
        /**
         * @description Enable Gateway prefill/decode orchestration. Requires mode=4 and at least one endpoint with ep_role=1 (prefill) and one with ep_role=2 (decode). kvEngineType selects the dialect: vllm and trtllm use sequential prefill-then-decode flows; sglang uses a concurrent bootstrap-based pair. llamacpp is not supported on this path. If KV Exact is also enabled, use kvExactMode=1, not 3. Engine transport, tokenizer, and deployment prerequisites remain necessary; this flag alone does not qualify an engine/model tuple.
         * @default false
         */
        pd_disagg_mode?: boolean;
        /**
         * @description Enable Tier-1 radix-trie prefix affinity for P/D routing. Requires pd_disagg_mode=true. Tier-0 session stickiness is active independently of this flag when a client session key is present; Tier-2 load-based selection remains the fallback.
         * @default false
         */
        pd_cache_aware_mode?: boolean;
        /**
         * Format: int32
         * @description Tier-0 P/D session-stickiness idle TTL in seconds. Omitted or 0 uses the Gateway default of 300 seconds; a positive value overrides the default for this service. Successful session lookup or store refreshes the last-access time. A mapping expires when elapsed idle time exceeds the effective TTL; periodic cleanup may reclaim it later. Applies to P/D routing when a client session key is present, independently of pd_cache_aware_mode. This is a Gateway endpoint-affinity policy, not an engine KV-cache retention, KV-transfer timeout, or active-request timeout. Zero does not disable expiry or stickiness. Capacity eviction and endpoint-health checks still apply. No no-expiry mode is exposed.
         * @default 0
         */
        pd_session_ttl_sec?: number;
        /**
         * Format: int32
         * @description Minimum prefix-match percentage for Tier-1 trie affinity when pd_cache_aware_mode=true. Lower positive values allow shorter prefix matches. On creation, omission or 0 resolves to 20, not a literal zero-percent threshold. Current replace behavior retains the previous value when the incoming value is 0. The approved future update contract separates omission (retain) from explicit 0 (reset to 20); that presence-aware change is not implemented yet. UI clients must not assume a zero-valued update resets the current deployment. This field does not set the Tier-0 session TTL.
         * @default 20
         */
        pd_cache_threshold?: number;
        /**
         * Format: int32
         * @description Absolute active-connection imbalance threshold for P/D cache affinity. Tier-1 trie selection requires max-min to be at most this value; Tier-1.5 uses the check only when the process-level LLB_KV_LOADGUARD is enabled. A Tier-0 session hit returns before these checks. On creation, omission or 0 resolves to 3. Current replace behavior retains the previous value for incoming 0. The approved future contract is omission=retain and explicit 0=reset to 3; this update distinction is not implemented yet.
         * @default 3
         */
        pd_balance_abs_threshold?: number;
        /**
         * Format: int64
         * @description KV-cache exact (Tier 1.5) routing mode. Selects the ENDPOINT TOPOLOGY only — the serving framework is chosen independently by kvEngineType, and engine support for each mode is bounded by the per-engine capability matrix in the kvEngineType description (NOT every mode works with every engine). 0 = off. 1 = exact routing over a P/D role-partitioned pool: requires pd_disagg_mode=true (rejected otherwise) and endpoints tagged ep_role 1/2; only ep_role=1 (prefill) endpoints are subscribed and scored, and Tier 1.5 sits between Tier 1 (trie) and Tier 2 (min-load) in the P/D ladder. 2 = reserved and rejected; no NATS implementation is available. 3 = single-pool exact routing: requires mode=4 (fullproxy) and pd_disagg_mode=false (both rejected otherwise); ALL endpoints are subscribed and scored. Mode 3 does NOT reproduce the P/D ladder — there is no Tier-0 P/D session-affinity stage, no Tier-1 P/D trie and no P/D backpressure admission stage on this path; management admission and strict binding enforcement still apply. A Tier-1.5 miss falls back to the rule's own sel selector. vllm/sglang consume ZMQ events; trtllm consumes HTTP-polled events. All enabled exact modes require model_name and a loadable tokenizer. Profile/API-surface constraints apply independently; see kvModelProfile and kvExactApiMode.
         * @default 0
         */
        kvExactMode?: number;
        /**
         * Format: int64
         * @description Token block size for KV hashing. Omission or 0 resolves to 16 in the current implementation; choose the value from the deployed engine tuple, not from the schema default. Must match vLLM block-size, SGLang page-size, or TRT-LLM tokens_per_block. A mismatch can cause hash misses; TRT-LLM server-info validation can instead refuse the endpoint's KV event poller while plain load balancing remains available. Implementation limitation: the schema's uint32 ceiling is not a safe operational range; downstream hashing converts the size to signed int. Use only a qualified engine block size until the numeric contract and C arithmetic are hardened. API acceptance is not geometry validation.
         * @default 16
         */
        kvBlockSize?: number;
        /**
         * @description Block-hash contract used to match the prompt against the engine-published KV inventory. PREFER OMITTING THIS FIELD — when absent, the contract is derived from kvEngineType (vllm => sha256_cbor, sglang => sha256_sglang, trtllm => blockhash_trtllm). These are Gateway defaults, not discovery of the backend's actual hash settings. An explicit value overrides that default and MUST match the engine, or every computed hash misses and Tier 1.5 is silently dead; incoherent pairs are therefore rejected at config time. vLLM engines: "sha256_cbor" (must equal --prefix-caching-hash-algo) or "xxhash_cbor". SGLang engines: "sha256_sglang" only — SGLang hashes parent||tokens raw (no CBOR, no NONE seed) and truncates to the FIRST 8 digest bytes, where vLLM CBOR-encodes and truncates to the LAST 8. TRT-LLM engines: "blockhash_trtllm" only — the same raw chained-SHA256 contract applied on both sides by the gateway itself (requests and the token lists carried in stored KV events); the engine's own unversioned uint64 mixing hash is never used as a routing key. For vLLM Exact routing, Gateway admission also requires a non-empty LLB_KV_NONE_HASH_SEED of at most 23 bytes; deployment must ensure it matches the engine PYTHONHASHSEED. Tokenizer, template, and block geometry must agree independently of this enum.
         * @enum {string}
         */
        kvHashAlgo?: "sha256_cbor" | "xxhash_cbor" | "sha256_sglang" | "blockhash_trtllm";
        /**
         * Format: int64
         * @description Base ZMQ event port for vllm/sglang exact routing. Omission or 0 resolves to 5557 in the current implementation. Mode 1 subscribes prefill endpoints only; mode 3 subscribes all endpoints. SGLang rank N uses base+N for N=0..kvDpRankCount-1; the effective base plus effective rank count minus one must not exceed 65535. trtllm uses HTTP on targetPort instead: only omitted/0/default 5557 declarations are accepted there, and no ZMQ connection is made.
         * @default 5557
         */
        kvZmqPort?: number;
        /**
         * Format: int64
         * @description Intended Tier-1.5 inventory warm-up duration in seconds. Known implementation gap: the runtime guard needs kv_warmup_start, but the production connection lifecycle does not set that start timestamp. A positive declaration currently does not provide a working warm-up barrier, and the schema default 30 must not be interpreted as an effective startup delay. The feature is retained for implementation; connect/reconnect, per-rank, and HTTP-poller start conditions require an explicit lifecycle contract. Do not rely on this option as a readiness or admission guarantee.
         * @default 30
         */
        kvWarmupSec?: number;
        /**
         * @description Serving-engine family for this rule; omission resolves to vllm. One family per rule, immutable after creation (delete/recreate to change); omitted and explicit vllm are equivalent for this guard. Different ports on one VIP may use different families. The family derives kvHashAlgo but does not discover backend serve arguments. vllm and sglang use ZMQ KV events; only sglang permits rank fan-out above one. trtllm supports plain LB, exact mode 3, and P/D with exact mode 1 using HTTP-polled events on endpoint targetPort. The Gateway must be the sole consumer of each endpoint's drain-on-read /kv_cache_events resource. For trtllm, kvZmqPort accepts only omitted/0/5557 and kvDpRankCount accepts only omitted/0/1; these default declarations have no transport effect. llamacpp has no Gateway KV-event or P/D path: nonzero kvExactMode, enabled pd_disagg_mode, explicit kvHashAlgo, and non-default ZMQ/rank/block settings are rejected. Plain-LB selector constraints still apply. Process-level LOXILB_KV_* tuning is shared across KV rules, not isolated by this field. Engine-family acceptance is not model, tokenizer, template, or engine-version qualification.
         * @default vllm
         * @enum {string}
         */
        kvEngineType?: "vllm" | "sglang" | "trtllm" | "llamacpp";
        /**
         * Format: int32
         * @description SGLang event-publisher rank count, not the number of LB endpoints. Omission or 0 resolves to 1; accepted positive values are 1..8. Values above 1 require kvEngineType=sglang. Rank N uses kvZmqPort+N for N=0..count-1; after resolving defaults the highest port must be at most 65535. Inventories are unioned per endpoint. Fan-out support does not by itself qualify every engine/model/DP deployment.
         * @default 1
         */
        kvDpRankCount?: number;
        /**
         * @description Request API surfaces this KV-exact rule serves. Absent on a profile-less rule keeps the legacy behavior (both surfaces, unattested); with kvModelProfile bound, the effective surfaces default to the profile's declared supportedApis and an explicit value must be a subset of them. Declaring a chat surface requires a validated chat renderer for the rule's model_name — an unsupported chat declaration is refused at create time, never degraded into a silent runtime fallback. Meaningless without kvExactMode (rejected). Immutable after create with NO exception (delete+recreate to change): even the sanctioned migration attach (see kvModelProfile) must carry the SAME raw declaration as the live rule — the guard compares raw declared strings, so an unset value matches only unset. Scalar by schema — arrays are rejected representations.
         * @enum {string}
         */
        kvExactApiMode?: "completions" | "chat" | "both";
        /** @description ID of the ModelPromptProfile this rule binds to. Naming a profile makes the rule STRICT: the profile must be published in the gateway's profile registry, its alias policy must admit the rule's model_name, its pinned tokenizer artifacts must load and digest-match, and a composed KV-exact binding (model-profile@generation + engine-contract@generation) is allocated at create time — admission fails closed while no engine-contract registry is available. Absent = legacy profile-less rule (no binding; documented migration behavior). Immutable after create (delete+recreate to change), with ONE sanctioned exception: the migration attach. A replace-POST that names a profile on a live profile-less rule is admitted and re-runs the full strict bring-up (admission checks run BEFORE any mutation, so a refused attach leaves the rule, binding, and data plane untouched; enforcement reports pending until the data-plane contract installs and is acknowledged). The reverse transitions — dropping the profile or changing it to another — stay refused, as does any kvExactApiMode change during the attach (raw-string equality; an undeclared apiMode must stay undeclared in the attach POST). CAVEAT operators must be shown: attaching changes the rule's EFFECTIVE surface from the legacy both-surfaces default to the profile's declared supportedApis — attaching a completions-only profile to a rule that was serving chat traffic narrows the served surface. Scalar by schema — exactly one profile per rule; arrays are rejected representations. Requires kvExactMode=1 or 3; a profile declaration with Exact disabled is rejected. Snapshot restore has a separate recovery contract: it may preserve an unresolved profile declaration while fencing Exact routing; consult kvexactstatus rather than treating restored storage as a successful fresh admission. */
        kvModelProfile?: string;
        /**
         * Format: int32
         * @description SGLang bootstrap port on every prefill endpoint; must match the engine disaggregation-bootstrap-port. Omitted/0 resolves to 8998 on the SGLang P/D path. A nonzero declaration requires both pd_disagg_mode=true and kvEngineType=sglang; it is rejected on other shapes. Zero is accepted on other shapes but has no effect.
         * @default 0
         */
        pdBootstrapPort?: number;
        /** @description Session-key extraction setting for proxy affinity. Use a header name such as X-Session-ID, cookie:NAME for one cookie, query:NAME for one query parameter, or basic-auth for the Basic Authorization username. RR (sel=0) and persistence (sel=3) paths contain handling; a missing usable key follows their RR or IP-based fallback respectively. This setting is not authentication. GET includes it only for those selectors. The server accepts at most 127 UTF-8 bytes and rejects embedded NUL or invalid UTF-8 before changing rule state. This byte limit reserves the terminator in the 128-byte data-plane field; UI validation must count encoded bytes rather than characters. Cross-mode interaction with L7 HTTP_COOKIE remains unresolved. */
        session_header_name?: string;
        /**
         * @description Intended prefix level for sel=8 (CHWBL) or sel=10 (WRR_HASH), both requiring mode=4: 1=system prompt/model, 2=also session context, 3=also RAG context. Known wiring limitation: the declaration is forwarded to the C configuration for sel=8, but not for sel=10. The WRR_HASH path therefore uses its internal level-1 default. Readback of an explicit value does not prove it affects routing. The option is retained; complete propagation and parser behavior verification are required before claiming all levels are qualified.
         * @default 1
         * @enum {integer}
         */
        chwbl_prefix_hash_level?: 1 | 2 | 3;
        /**
         * @description Intended optional hash-input flags for sel=8/10: bits 0..7 name LoRA, image, audio, cache_salt, tools, session, RAG template, and RAG documents respectively; 0 declares automatic selection. Known implementation gap: API declarations are stored but are not propagated into the active C configuration, which initializes this field to 0. Per-bit behavior is not an implemented API guarantee. Retained for implementation and behavior verification.
         * @default 0
         */
        chwbl_prefix_hash_flags?: number;
        /**
         * @description Intended bounded-load factor in percent for sel=8/10, with a nominal bound of average load multiplied by factor/100. The schema declares 125, but current C initialization uses 175 and does not consume this API override. Do not interpret a returned value as the effective bound. The option is retained; the final default and complete configuration propagation require reconciliation.
         * @default 125
         */
        chwbl_mean_load_factor?: number;
        /**
         * @description Intended hash-ring replication setting for sel=8/10. CHWBL uses virtual nodes per endpoint; WRR_HASH distributes a ring budget by endpoint weight. The schema declares 100, but current C setup uses 256 and does not consume this API override. Retained for implementation; default, weight interaction, allocation limits, and live ring-rebuild behavior must be reconciled before the UI treats this as an effective tuning control.
         * @default 100
         */
        chwbl_replication?: number;
        /**
         * @description Intended request cache_salt requirement for sel=8/10. Known implementation gap: this declaration is not wired to active C configuration, which initializes the option disabled. It does not currently enforce salt presence or tenant isolation. Retained for implementation. A client-supplied hash salt is not itself an authenticated tenant-isolation boundary; identity binding and missing-salt behavior need an explicit security contract.
         * @default false
         */
        chwbl_enable_cache_salt?: boolean;
        /** @description Frontend client-certificate verification settings for FullProxy with security 1 or 2 and an mTLS-enabled build. The active encoder carries path-based CA, CN and CRL settings. Implementation gaps: admission does not comprehensively enforce these prerequisites, inline CA data is stored but not carried by the active encoder, and TLS-context updates have the serviceArguments lifecycle limitation. A stored required mode does not establish effective verification on an ineligible service. */
        mtls_frontend?: {
          /**
           * @description Requested verification mode - disabled performs no client verification, optional permits omission but verifies a supplied certificate, and required requires a valid certificate on the active mTLS TLS path. See the containing object's prerequisite and wiring warnings.
           * @default disabled
           * @enum {string}
           */
          client_cert_mode?: "disabled" | "optional" | "required";
          /** @description Gateway-local PEM CA bundle path used by the active frontend verification path. The encoder carries at most 255 bytes without a corresponding admission bound. An enabled verification mode with no CA path only logs a warning during C configuration; this is not a validated trust configuration. */
          client_ca_path?: string;
          /** @description Inline CA material declared as base64-encoded PEM. Implementation gap - stored and returned by REST but not passed by the active frontend encoder; it is not currently a working substitute for client_ca_path through this path. */
          client_ca_cert_data?: string;
          /**
           * @description Requests certificate-name pattern checking on the active frontend mTLS path. Supply a nonempty client_cn_pattern; an empty pattern does not establish an additional identity restriction.
           * @default false
           */
          require_client_cn?: boolean;
          /** @description Certificate-name pattern, for example *.corp.example.com, used when require_client_cn is true. The C path contains wildcard matching; the encoder carries at most 255 bytes. This field alone does not enable client certificate verification. */
          client_cn_pattern?: string;
          /** @description Optional gateway-local static PEM CRL path for leaf-certificate revocation checking on the configured frontend CA path. When empty, the implementation may use a sibling crl.pem beside the CA bundle. It is not automatic CRL retrieval or chain-wide revocation validation. The encoder carries at most 255 bytes; normal GET omits this field. */
          client_crl_path?: string;
        };
        /** @description Requested backend verification and client-certificate settings for FullProxy re-encryption (mode=4, security=2) with mTLS support. Implementation warning: REST stores and returns this object, but the active create encoder does not wire its verification flag or legacy path/inline material into the backend TLS configuration. The separate configuration bridge has no caller in the reviewed path. These fields therefore do not establish backend authentication, even after a successful POST. Backend cert-ID fields have separate C consumers; their existence does not repair this missing verification wiring. Requested-security fail-closed behavior and material precedence remain pending policy decisions, not supported fallback guarantees. */
        mtls_backend?: {
          /**
           * @description Requests backend server-certificate verification. False leaves verification unrequested. Implementation gap - true is stored but does not reach the active backend_verify_cert flag through this intake; it must not be displayed as effective verification.
           * @default false
           */
          verify_server_cert?: boolean;
          /** @description Requested gateway-local backend PEM CA bundle path. Stored/read back, but not wired into the active backend TLS material path; see mtls_backend. Omitting it does not by itself establish system-CA verification. */
          backend_ca_path?: string;
          /** @description Requested gateway-local client certificate path for backend mTLS, paired with client_key_path. Stored/read back but not wired into the active backend TLS material path. */
          client_cert_path?: string;
          /** @description Requested gateway-local client private-key path paired with client_cert_path. Stored/read back but not wired into the active backend TLS material path. */
          client_key_path?: string;
          /** @description Requested inline client certificate declared as base64-encoded PEM. Stored/read back but not an effective substitute for a backend client certificate through the current active path. */
          client_cert_data?: string;
          /** @description Requested inline client private key declared as base64-encoded PEM. Stored/read back with the object; active backend material wiring is missing. Treat the input and readback as sensitive key material. */
          client_key_data?: string;
        };
        /** @description Identifier of a pre-existing /config/policy to associate after LB creation, when the policy component is available. Empty skips the association. Implementation gaps: association occurs after LB creation, so an association error can leave the LB created; the existing-rule update path does not reach this block, and GET omits the identifier. A failed request is not evidence of an atomic rollback. */
        vip_qos_policy_id?: string;
        /** @description HTTP ALPN capability list, typically [h2, http/1.1], [h2] or [http/1.1]. Recognized values override backend_protocol through a shared capability used by listener and backend TLS setup; list order is not preserved as preference order. Empty leaves backend_protocol in use. Implementation limitations: unknown tokens are ignored, an entirely unrecognized list falls back to backend_protocol, and the H1/both listener callback can select H1 without a common advertised protocol. This is not strict ALPN allow-list enforcement. See shared readback/update warnings. */
        alpn_protocols?: string[];
        /** @description Cipher string passed to both the TLS 1.3 ciphersuite and TLS 1.2 cipher configuration calls for listener/backend contexts, regardless of the selected version range. Empty uses the built-in lists. Implementation warnings: the C copy limits the string to 255 bytes without admission rejection; either OpenSSL call can fail, and listener creation then reaches an SSL-context assertion. Invalid input is not guaranteed to produce a clean REST rejection. See shared readback/update warnings. */
        tls_ciphers?: string;
        /** @description TLS version selection for listener/backend context setup. The encoder recognizes TLSv1.0 through TLSv1.3 and collapses recognized entries to an inclusive minimum/maximum range; empty uses TLS 1.2 through 1.3. Implementation limitations: noncontiguous selections include intermediate versions, unknown tokens are ignored, and an entirely unrecognized list uses default bounds. This is not exact allow-list enforcement; version policy and strict rejection require separate decisions and fixes. */
        tls_versions?: string[];
        /**
         * Format: uint32
         * @description HSTS max-age in seconds, injected on qualifying HTTPS responses when an L7 policy is attached and this value is nonzero. Zero disables injection; it does not emit max-age=0 to clear a browser policy. See shared listener lifecycle and readback gaps.
         */
        hsts_max_age?: number;
        /** @description Appends includeSubDomains to the generated HSTS value when hsts_max_age is nonzero and the HTTPS/L7 injection path is active. */
        hsts_include_subdomains?: boolean;
        /** @description Appends preload to the generated HSTS value when hsts_max_age is nonzero and the HTTPS/L7 injection path is active. It does not register the domain in a browser preload list. */
        hsts_preload?: boolean;
        /** @description Reference used by the backend TLS material resolver for a managed CA bundle. It does not enable verification by itself; mtls_backend has missing verification-flag wiring. The C copy limits IDs to 63 bytes without admission rejection. Missing material can resolve to an empty path and select system CA paths if verification is otherwise enabled. Requested-security fail-closed semantics and material precedence are unresolved; this fallback is not an authenticated-backend guarantee. */
        backend_ca_cert_id?: string;
        /** @description Reference for backend client certificate/key material. The resolver consults this ID when it did not obtain client material from the CA-ID directory. Missing material can leave no client certificate; the ID alone does not establish mTLS or server verification. IDs are copied into 63-byte payload capacity without admission rejection. Strict missing-material handling and precedence remain unresolved. */
        backend_client_cert_id?: string;
      };
      /** @description Backend members; the domain accepts 1 through 32 input members. Creation sorts members by IP and updates reconcile existing slots, so input-array order is not a stable L7 backend-reference identity. Implementation warnings: POST/PATCH do not copy httpMethod, urlPath, expectedCodes, httpVersion or domainName into LB members, and GET does not return them. Their presence in this schema does not configure an HTTP monitor. Existing-member reconciliation updates weight but does not copy backup, subnetId or monitorAddress, so their create-time storage does not establish update support. Weight and port narrowing lack original-value range validation. state and counter are derived output and are ignored as configuration input. */
      endpoints?: ({
          /** @description Backend traffic IP address, validated by the domain. An IPv6 member is rejected for an IPv4 service. monitorAddress changes the probe destination only. */
          endpointIP: string;
          /** @description Member selection weight; zero marks the member unavailable for new selection while retaining membership. Interpretation depends on the selector. Implementation gap - the handler narrows to uint8 without rejecting negative or oversized input; use values within 0 through 255 without relying on wrapping. */
          weight: number;
          /** @description Backend traffic port. ICMP requires zero; DSR requires the service port. The handler narrows to uint16 without checking the original range, so clients must avoid values outside 0 through 65535. */
          targetPort: number;
          /**
           * Format: int32
           * @description Endpoint role for P/D disaggregation - 0=normal (no role), 1=prefill, 2=decode. Only used when pd_disagg_mode is true.
           * @default 0
           * @enum {integer}
           */
          ep_role?: 0 | 1 | 2;
          /**
           * Format: int32
           * @description NIXL side-channel port for KV cache transfer. 0=use targetPort (backward compatible). Only meaningful when pd_disagg_mode is true.
           * @default 0
           */
          nixl_port?: number;
          /**
           * @description Standby member marker. The selection builder enables an available backup only when no primary is available; zero-weight or unhealthy primaries are unavailable. False means primary. This is create-time selection wiring, subject to the existing-member update gap documented on endpoints.
           * @default false
           */
          backup?: boolean;
          /** @description Opaque subnet metadata stored for a new member and returned on GET; it has no routing effect. Existing-member updates have the reconciliation gap documented on endpoints. */
          subnetId?: string;
          /** @description Probe destination address override, using the service-wide probe port. Empty probes the member traffic IP; backend traffic still uses endpointIP. Existing-member updates have the reconciliation gap documented on endpoints. */
          monitorAddress?: string;
          /** @description Requested HTTP monitor method, for example GET or HEAD. This LoadbalanceEntry field is not wired; see the endpoints implementation warning. */
          httpMethod?: string;
          /** @description Requested HTTP monitor path, for example /healthz. This LoadbalanceEntry field is not wired; its presence does not override the service-level probereq path. */
          urlPath?: string;
          /** @description Requested HTTP status-code selection, expressed as a single code, comma-separated list or range. This LoadbalanceEntry field is not wired into monitoring; these forms describe intent, not effective LB monitor configuration. */
          expectedCodes?: string;
          /** @description Requested HTTP monitor version, such as 1.0 or 1.1. This LoadbalanceEntry field is not wired and does not establish a monitor HTTP version or Host-header behavior. */
          httpVersion?: string;
          /** @description Requested monitor TLS SNI/HTTP Host name. This LoadbalanceEntry field is not wired; setting it here does not configure either value. */
          domainName?: string;
          /** @description Derived member status on GET, such as active or inactive. Not applied from POST/PATCH input and not an independent proof of backend readiness. */
          state?: string;
          /** @description Derived endpoint packet and byte counters formatted as packets:bytes. Not applied from POST/PATCH input. */
          counter?: string;
        })[];
      /** @description Flat SCTP secondary service addresses. The POST handler copies this list only for SCTP; the domain permits at most three, validates addresses and rejects IPv6 secondary addresses on an IPv4 service. Existing-rule changes to the flat list are rejected. Unlike secondaryVIPs, this list reaches the SCTP dataplane and the BGP advertisement hook when enabled. */
      secondaryIPs?: {
          /** @description IP address for secondary access */
          secondaryIP?: string;
        }[];
      /** @description Opaque additional-VIP metadata stored and returned for all protocols, separately from secondaryIPs. Implementation gap: this collection does not feed additional addresses to SCTP or another dataplane, nor to the BGP advertisement hook. It must not be presented as active additional VIPs. Storage is uncapped here; metadata-only update handling has the shared serviceArguments limitation. Whether these addresses should become active remains a policy/implementation decision. */
      secondaryVIPs?: {
          /** @description Opaque address metadata; does not create or advertise an active VIP through this collection. */
          address?: string;
          /** @description opaque Octavia subnet identifier for this VIP (round-trip only) */
          subnetId?: string;
          /** @description opaque Octavia port identifier for this VIP (round-trip only) */
          portId?: string;
          /** @description opaque protocol hint for this VIP (round-trip only) */
          proto?: string;
        }[];
      /** @description Source-address prefixes associated with the LB source-check path. A nonempty domain list enables source checking; GET returns the stored prefixes. This is an address filter, not projectId-based tenant authorization. */
      allowedSources?: {
          /** @description Source IP prefix in CIDR notation, validated when the domain creates the source-prefix association. */
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
    /** @description Create-time route input. destinationIPNet is a CIDR and gateway is a literal IP. Only protocol static explicitly selects a protocol on this path; returned protocol strings are not a write-time enumeration. Gateway parsing and family agreement are not fully validated. */
    RouteEntry: {
      /** @description Destination network in CIDR notation. */
      destinationIPNet: string;
      /** @description Literal next-hop IP address, not CIDR. Local gateway validity and family checks are incomplete. */
      gateway: string;
      /** @description Only static explicitly sets the create-time protocol; GET may report additional symbolic or numeric protocol values. */
      protocol?: string;
    };
    /** @description Gateway route readback. gateway may contain comma-separated next hops; protocol is a symbolic name for known values or a decimal string. statistic.bytes and statistic.packets are route byte and packet counters, not ingress/egress byte counters. sync is reported datapath status, not an independent runtime verification. */
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
        /** @description Route byte counter. */
        bytes: number;
        /** @description Route packet counter. */
        packets: number;
      };
    };
    /** @description Legacy Kubernetes-enriched connection shape. The assigned /config/conntrack/all operation does not reference this definition and does not provide these enrichment fields. */
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
    /** @description Gateway datapath connection record. packets and bytes include reported eBPF and hardware totals when reconciliation is available. Hardware fields may be omitted and ageMs is not populated by the current handler. Signed counter serialization does not preserve the entire unsigned counter range. */
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
       * @description Currently unavailable from this handler: ageMs is not populated and its zero value is omitted. This declaration does not establish DOCA age-query support.
       */
      ageMs?: number;
    };
    /** @description Observed gateway port record. portType and portProp describe type/property flags, not scheduling priority; the current getter does not populate portProp. link is link status and state is administrative state. Address arrays contain a formatted first address with a primary/secondary marker or an empty string, not complete raw address lists. */
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
        /** @description Port property flags, not priority. The current domain getter leaves this field unpopulated. */
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
        /** @description Administrative interface state; distinct from link status. */
        state?: boolean;
        /** @description Master interface name. */
        master?: string;
        /** @description Underlying interface name. */
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
        /** @description Display string for the first IPv4 address with primary/secondary marker, or an empty string; not a complete address list. */
        IPv4Address?: string[];
        /** @description Display string for the first IPv6 address with primary/secondary marker, or an empty string; not a complete address list. */
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
    /** @description User session identified by ident. Supply sessionIP and both tunnel objects as literal-IP configuration; schema-optional tunnel objects are dereferenced by the handler. Access TeID and core teID are case-sensitive wire names and narrow to uint32 without range checks. Existing-session replacement has a comparison defect and can remove associated ULCL classifiers. */
    SessionEntry: {
      /** @description User-session identifier, not an IP/netmask. */
      ident: string;
      /** @description Literal user-session IP address. Local parsing is not followed by complete admission validation. */
      sessionIP?: string;
      /** @description Supply this object; the current handler dereferences it despite its optional schema declaration. */
      accessNetworkTunnel?: {
        /** @description Access-network TEID, converted to uint32 without a bounds check. Omission becomes zero. */
        TeID?: number;
        /** @description Access network IP address */
        tunnelIP?: string;
      };
      /** @description Supply this object; the current handler dereferences it despite its optional schema declaration. */
      coreNetworkTunnel?: {
        /** @description Core-network TEID, converted to uint32 without a bounds check. Note the case-sensitive teID wire name. */
        teID?: number;
        /** @description Connection network IP address */
        tunnelIP?: string;
      };
    };
    /** @description Classifier for an existing user session. ulclIdent selects the session; classifier IP, not QFI, completes the identity. The schema-optional ulclArgument is dereferenced by the handler. QFI narrows to uint8 without bounds checking; the protocol-valid range still requires an explicit admission policy. */
    SessionUlClEntry: {
      /** @description Identifier of the existing user session. */
      ulclIdent: string;
      /** @description Supply this object; the current handler dereferences it despite its optional schema declaration. */
      ulclArgument?: {
        /** @description Classifier QFI, converted to uint8 without bounds checking. It is not part of the classifier identity. */
        qfi?: number;
        /** @description Access network IP address */
        ulclIP?: string;
      };
    };
    /** @description Policer configuration. CIR and PIR use Mbps; burst sizes use bytes. CIR must be at least 8 and PIR may be zero or at least 8, but PIR/CIR ordering is not enforced. CBS zero becomes 30000000 and supplied EBS is overwritten with twice CBS. Signed inputs, scaling, and datapath narrowing are incompletely checked. Stored type does not currently select srTCM in the inspected eBPF path. Fullproxy rule targets use a separate byte-shaper path. */
    PolicyEntry: {
      /** @description Policy name */
      policyIdent: string;
      policyInfo?: {
        /**
         * @description Stored policy type, 0 for trTCM and 1 for srTCM. The current eBPF work item does not propagate this selection, so type 1 does not establish single-rate behavior.
         * @enum {integer}
         */
        type?: 0 | 1;
        /** @description Policy color for QoS */
        colorAware?: boolean;
        /** @description Committed rate in Mbps; the domain requires at least 8 after unchecked unsigned conversion. eBPF token-rate conversion truncates to 8-Mbps increments. */
        committedInfoRate?: number;
        /** @description Peak rate in Mbps; zero or at least 8 passes current domain validation. PIR >= CIR is not enforced and zero is not limited to the single-rate type. */
        peakInfoRate?: number;
        /** @description Committed burst size in bytes. Zero becomes 30000000; datapath conversion narrows to uint32 without a bounds check. */
        committedBlkSize?: number;
        /** @description Supplied value is currently ignored: the domain sets excess burst size to twice the effective committed burst size. This is an implementation limitation. */
        excessBlkSize?: number;
      };
      targetObject: {
        /**
         * @description Target selector, 0 for exact LB rule, 1 for ingress port, 2 for egress port. Egress requires enabled egress hooks.
         * @enum {integer}
         */
        attachment: 0 | 1 | 2;
        /** @description Port name or exact rule key VIP:PORT:PROTO for IPv4 and [VIP]:PORT:PROTO for IPv6. Rule port must be 1..65535 and protocol tcp, udp, or sctp; a missing target can remain pending. */
        polObjName: string;
      };
    };
    /** @description Mirror configuration, not proof of active mirroring. Port-attached SPAN has an implementation path; rule attachment and ERSPAN are not implemented end-to-end. The attachment enum is not translated correctly for rule attachment, nonzero RSPAN VLAN is rejected, and tunnel IDs narrow without bounds checks. Information changes can delete and recreate an object; target-only changes conflict. */
    MirrorEntry: {
      /** @description Mirror name */
      mirrorIdent: string;
      mirrorInfo?: {
        /**
         * @description Requested mirror type, 0 SPAN, 1 RSPAN, 2 ERSPAN. ERSPAN is not implemented end-to-end; RSPAN has inconsistent VLAN validation.
         * @enum {integer}
         */
        type?: 0 | 1 | 2;
        /** @description Port where mirrored traffic needs to be sent */
        port?: string;
        /** @description Requested mirror VLAN. Nonzero VLAN is currently rejected for RSPAN; do not interpret this defect as a supported tagging contract. */
        vlan?: number;
        /** @description Requested literal ERSPAN remote IP. ERSPAN datapath programming is not implemented and IP validation is incomplete. */
        remoteIP?: string;
        /** @description Requested literal ERSPAN source IP. ERSPAN datapath programming is not implemented and IP validation is incomplete. */
        sourceIP?: string;
        /** @description Requested ERSPAN tunnel identifier, narrowed to uint32 without bounds checking. ERSPAN is not implemented end-to-end. */
        tunnelID?: number;
      };
      targetObject: {
        /**
         * @description Requested selector, 0 rule or 1 port. The handler does not translate rule 0 to the internal constant; only port attachment has an implemented consumer.
         * @enum {integer}
         */
        attachment: 0 | 1;
        /** @description Target Names */
        mirrObjName: string;
      };
    };
    /** @description Stored mirror configuration and mirror-object sync status. This does not report attachment synchronization independently and can describe unsupported or incompletely programmed configurations; do not infer active mirroring from this object. */
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
      /** @description Mirror-object synchronization status only; attachment synchronization and actual traffic mirroring are not established by this field. */
      sync: number;
    };
    /** @description Linux bridge identifier used to form vlan<ID>. The REST creation helper does not enforce all documented VLAN bounds; successful bridge creation does not establish completion of link setup. */
    VlanBridgeEntry: {
      /** @description Vlan ID */
      vid: number;
    };
    /** @description Gateway-managed VLAN bridge with members and ingress/egress byte and packet counters. This is observed control-plane inventory, not independent verification of Linux bridge ownership. */
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
    /** @description Member interface and tagging choice. Omitted tagged means false. Tagged membership creates <dev>.<ID>; untagged membership attaches dev directly. The current helpers do not consistently enforce current-master ownership, and partial failures can leave intermediate state. */
    VlanMemberEntry: {
      /** @description Existing member interface name. The current helper does not verify existing-master ownership before mutation. */
      dev?: string;
      /** @description True creates a tagged child <interface>.<ID>; false or omission attaches the named interface directly. */
      tagged?: boolean;
    };
    /** @description IPv4 address configuration: supply an interface name and CIDR, not a bare address. The shared mutation helper does not enforce IPv4 family. Missing Linux interfaces may fall back to internal address objects; backend failures can return HTTP 200 with result set to fail. */
    IPv4AddressEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev: string;
      /** @description IPv4 address with prefix length in CIDR notation. The shared helper does not enforce this endpoint's family. */
      ipAddress: string;
    };
    /** @description Gateway IPv4 addresses grouped by interface with reported synchronization status. Address strings include prefix lengths; inventory and sync are not independent proof of kernel or datapath convergence. */
    IPv4AddressGetEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev?: string;
      ipAddress?: string[];
      /** @description Sync - sync state */
      sync: number;
    };
    /** @description IPv6 address configuration: supply an interface name and CIDR, not a bare address. The shared mutation helper does not enforce IPv6 family and may use internal address objects for missing Linux interfaces. Internal self-route construction has an IPv6 prefix-length limitation. Backend failures can return HTTP 200 with result set to fail. */
    IPv6AddressEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev: string;
      /** @description IPv6 address with prefix length in CIDR notation. The shared helper does not enforce this endpoint's family. */
      ipAddress: string;
    };
    /** @description Gateway IPv6 addresses grouped by interface with reported synchronization status. Address strings include prefix lengths; inventory and sync are not independent proof of kernel or datapath convergence. */
    IPv6AddressGetEntry: {
      /** @description Name of the interface device to which you want to modify the IP address */
      dev?: string;
      ipAddress?: string[];
      /** @description Sync - sync state */
      sync: number;
    };
    /** @description Permanent neighbor input consisting of a literal IP, interface name, and parsed MAC address. The handler is not IPv4-only and local IP validation is incomplete. Interface-scoped deletion is not safely enforced when interface lookup fails. */
    NeighborEntry: {
      /** @description IP address to neighbor */
      ipAddress: string;
      /** @description Name of the interface device to which you want to add neighbor */
      dev: string;
      /** @description MAC address to neighbor */
      macAddress: string;
    };
    /** @description Bridge-family forwarding entry identified here by interface and MAC address. This model omits additional kernel FDB selectors, including VLAN and tunnel destination; GET only enumerates interfaces with a bridge master. */
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
      /** @description Filesystem size as a formatted string from the system filesystem report, not a numeric byte count. */
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
    /** @description VXLAN interface readback joined with kernel peer data. peerIP can be null when no peer information is available, despite its required array declaration. Peer mutation handlers return operation-result objects, not this resource shape. */
    VxlanEntry: {
      vxlanName: string;
      epIntf: string;
      vxlanID: number;
      peerIP: string[];
    };
    /** @description VXLAN creation input. epIntf must exist and have an IPv4 address; its first IPv4 address is selected as source. Creation uses vxlan<ID>, UDP port 8472, MTU 9000, and learning enabled. Numeric validation is incomplete. */
    VxlanBridgeEntry: {
      epIntf: string;
      vxlanID: number;
    };
    /** @description Literal VXLAN flood-list peer IP. Parsing and address-family validation are incomplete. The POST peer handler returns an operation-result object rather than this request shape. */
    VxlanPeerEntry: {
      peerIP: string;
    };
    /** @description Cluster state transition input. State must be MASTER, BACKUP, FAULT, STOP, or NOT_DEFINED. VIP must be treated as a literal IP, but parsing is not fully checked. Current code creates instances before validating state and ignores VIP changes when state is unchanged. Instance text is passed through shell-hook construction without safe argument isolation. Dependent updates are asynchronous. */
    CIStatusEntry: {
      /** @description Cluster instance name. Current shell-hook construction does not safely isolate this input as an argument; unrestricted names are not a safe supported contract. */
      instance?: string;
      /** @description Requested cluster state: MASTER, BACKUP, FAULT, STOP, or NOT_DEFINED. Repeating the current state skips VIP changes. */
      state?: string;
      /** @description Literal instance VIP. Parsing is not fully validated, and a same-state request does not update this value. */
      vip?: string;
    };
    /** @description Cluster instance state and VIP readback. The current handler does not populate the schema-required sync field; neither its presence nor the response status proves completion of dependent HA actions. */
    CIStatusGetEntry: {
      /** @description Instance name */
      instance?: string;
      /** @description Current Cluster Instance State */
      state?: string;
      /** @description Instance Virtual IP address */
      vip?: string;
      /** @description Not populated by the current handler despite its required declaration; not evidence of completed synchronization. */
      sync: number;
    };
    /** @description Endpoint monitor readback with observed health. The structured HTTP monitor fields are omitted, so this is not a full configuration round-trip. currState is ok, nok, or red. Delay strings are formatted durations from recorded probe measurements, not guarantees for every probe type. */
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
      /** @description Observed state, ok, nok, or red. This is not a direct round-trip of green/yellow/red host-state input. */
      currState?: string;
    };
    /** @description Monitor configuration for a literal host IP, not a hostname or CIDR. Supply probeType; TCP/UDP/SCTP require nonzero probePort. Port narrows to uint16 and duration to uint32 before full validation; retries have only an upper-bound check of 100 and duration an upper bound of 86400 after conversion. Omitted numeric values become zero, not a generic server default. Existing POST replaces options; reusing a name with another host currently retains the old host. HTTP status syntax and IPv6 probe address construction have known limitations. */
    EndPoint: {
      /** @description Literal endpoint IP address, not a DNS hostname or CIDR. */
      hostName: string;
      /** @description Custom monitor identifier. If empty, identity is derived from host/type/port. Changing host under an existing custom name does not currently replace the stored host. */
      name?: string;
      /** @description Configured inactive retry threshold. Values above 100 are rejected, but negative values are not rejected locally; omission becomes zero. */
      inactiveReTries?: number;
      /**
       * @description Supply a supported probe type; omission is rejected by domain validation. tls-hello checks handshake completion without validating certificate trust.
       * @enum {string}
       */
      probeType?: "tcp" | "udp" | "sctp" | "ping" | "http" | "https" | "none" | "tls-hello";
      /** @description URI for http/https probes */
      probeReq?: string;
      /** @description Legacy HTTPS response-substring expectation. HTTP and structured HTTPS use status-code matching instead; this is not a universal response-body check. */
      probeResp?: string;
      /** @description Probe interval in seconds. Omission becomes zero. The handler narrows to uint32 before the domain maximum of 86400 is checked; original-input bounds are incomplete. */
      probeDuration?: number;
      /** @description Probe port, narrowed to uint16 without bounds checking. TCP/UDP/SCTP require nonzero; HTTP/HTTPS/TLS-hello do not automatically select standard ports. */
      probePort?: number;
      /** @description HTTP(S) probe request method, actively consumed by the prober; empty uses GET. Method syntax is not validated at admission. */
      httpMethod?: string;
      /** @description HTTP(S) request path. Empty falls back to probeReq, then /. A structured HTTPS setting selects status-code matching rather than legacy probeResp substring matching. */
      urlPath?: string;
      /** @description Expected HTTP status: a single value, comma-separated values, or inclusive ranges such as 200-204. Empty uses 200 on the structured status path. Parsing errors, range ordering, and numeric narrowing are not safely validated. */
      expectedCodes?: string;
      /** @description Current implementation uses 1.1 to control explicit Host-header behavior and HTTPS prober selection; this field does not select an HTTP/1.0 versus HTTP/1.1 wire protocol. */
      httpVersion?: string;
      /** @description TLS SNI for structured HTTPS and TLS-hello probes, and explicit Host for structured HTTPS. For HTTP, explicit Host override is applied only when httpVersion is 1.1. */
      domainName?: string;
    };
    /** @description Explicit host-state input. Supply both nonzero epPort and epProto for generated-key targeting, or omit both for host-wide targeting. Custom monitor names cannot be selected by the specific tuple path. Host-wide requests can succeed without matches. epPort narrows to uint16 without full validation; immediate dependent updates are implemented for fullproxy rules, not universally. */
    EndPointHostState: {
      /** @description Literal endpoint host IP used for monitor matching, not a hostname or CIDR. */
      hostName?: string;
      /** @description Nonzero port requires epProto; zero or omission requires epProto empty for host-wide targeting. Conversion to uint16 is not fully validated. */
      epPort?: number;
      /** @description Generated monitor-key probe type; supply together with nonzero epPort or omit both. This selector cannot resolve a custom monitor name and is not a universal transport-protocol selector. */
      epProto?: string;
      /** @description Host state string ("green", "yellow", "red" ) */
      state?: string;
    };
    /** @description Firewall action options. Avoid combining terminal actions: the current precedence is allow, drop, redirect, trap, then SNAT, with default drop, while doSnat also has independent side effects. record is independent. SNAT requires a literal toIP and zero explicit fwMark; toPort zero preserves the port. Mark narrowing and reserved-bit handling are not fully validated. These limitations are not a supported multi-action policy. */
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
      /** @description Target interface name for the redirect action. */
      redirectPortName?: string;
      /** @description Packet mark, narrowed to uint32 without complete bounds or reserved-bit validation. Explicit mark must be zero for SNAT; duplicate POST can change this value before returning conflict. */
      fwMark?: number;
      /** @description Do SNAT on matching rule */
      doSnat?: boolean;
      /** @description Literal translated source IP, not CIDR. Required for the SNAT action. */
      toIP?: string;
      /** @description Modify to given Port (Zero if port is not to be modified) */
      toPort?: number;
      /** @description Trigger only on default cases */
      onDefault?: boolean;
      /** @description Readback traffic counters formatted as packets:bytes; not a configurable traffic limit. */
      counter?: string;
    };
    /** @description Exact firewall match tuple. Ports and preference are 0..65535; protocol is 0..255, with zero meaning wildcard. Both endpoints of a zero port range mean wildcard; otherwise minimum must not exceed maximum. Missing CIDRs become family-appropriate wildcards and explicit source/destination families must agree on creation. DELETE does not safely reject reversed ranges. hwOffload admission is not evidence of hardware installation and is not returned faithfully by GET. */
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
      /** @description IP protocol number 0..255; zero means wildcard. */
      protocol?: number;
      /** @description the incoming port */
      portName?: string;
      /** @description Preference 0..65535. This participates in rule identity and must match on deletion. */
      preference?: number;
      /**
       * @description Request hardware offload, not proof of installation. Current admission rejects IPv6, non-/32 IPv4 prefixes, non-singleton port ranges, and TCP- or UDP-specific protocol matches. Other acceptance does not establish runtime support, and GET does not populate this flag.
       * @default false
       */
      hwOffload?: boolean;
    };
    /** @description Firewall match tuple plus action options. POST is not a general replacement: a duplicate can update fwMark and still return conflict. DELETE identifies the exact normalized tuple, including preference. Validate action exclusivity and range ordering in clients while the implementation gaps remain open. */
    FirewallEntry: {
      ruleArguments: components["schemas"]["FirewallRuleEntry"];
      opts: components["schemas"]["FirewallOptionEntry"];
    };
    /** @description Zone-less source-prefix XDP filter. whitelist requires allow and blacklist requires drop. Each list uses longest-prefix matching; higher priority wins between lists and whitelist wins ties. Reposting the same normalized list/prefix replaces the entry and resets counters. Maps are shared with the security-rate whitelist, not isolated by API ownership. */
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
       * @description Zone must be zero or omitted on POST because XDP filtering precedes zone classification. DELETE does not use zone in the key.
       * @default 0
       */
      zone?: number;
      /**
       * Format: int64
       * @description Priority 0..65535. Omission uses 100; explicit zero is preserved. Higher priority wins between matching lists; whitelist wins ties.
       * @default 100
       */
      priority?: number;
      /**
       * @description Use allow with whitelist and drop with blacklist; other combinations are rejected.
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
    /** @description Full replacement of rate-limit configuration and security-rate whitelist. All required flags and thresholds must be supplied; schema defaults do not establish omission support. Thresholds are 0..16777216 and UDP bandwidth is 0..4095 MiB/s. Enabled protections require positive applicable thresholds, and enabled SYN protection requires cookieThreshold < synThreshold. At least one protection must be enabled. At most 1024 valid whitelist CIDRs are accepted; omission clears the prior list. Explicit cookieThreshold zero becomes 50 in the datapath. Programming is non-atomic and shares whitelist maps with IP filtering. */
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
       * @description SYN threshold telemetry, not a SYN-cookie exchange. With SYN enabled it must be below synThreshold; explicit zero is accepted but becomes 50 in the datapath, which can violate the intended relationship.
       * @default 50
       */
      cookieThreshold: number;
      /** @description Enable/disable connection rate limiting (P0-6) */
      connRateEnabled: boolean;
      /**
       * Format: int64
       * @description Per-source-IP SYN packet rate threshold, not completed connections per second. Must be positive when connection-rate protection is enabled.
       * @default 50
       */
      ratePerSec: number;
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
       * @description UDP bandwidth threshold in MiB per second per source IP, converted using 1024*1024 bytes; valid range 0..4095 and positive when UDP protection is enabled.
       * @default 100
       */
      udpBandwidthMB: number;
      /** @description Up to 1024 valid IPv4/IPv6 CIDRs. Omission clears the previous security-rate whitelist. These entries share maps with IP-filter whitelist rules. */
      whitelistIps?: string[];
    };
    /** @description Stored configuration with observed security-rate statistics. GET does not establish effective configuration after defaults or partial programming failures, and statistics failures can appear as zeros. Connection counters concern SYN packets, not completed connections. synCookies is threshold telemetry, not proof of a SYN-cookie exchange. uniqueIps is current tracking-map occupancy and is not cleared by counter reset. */
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
       * @description Stored telemetry threshold; zero can differ from effective datapath value 50. This field does not establish SYN-cookie generation.
       */
      cookieThreshold?: number;
      /** @description Whether connection rate limiting is enabled */
      connRateEnabled?: boolean;
      /**
       * Format: int64
       * @description Stored per-source-IP SYN packet rate threshold, not completed connection rate.
       */
      ratePerSec?: number;
      /** @description Whether UDP flood protection is enabled */
      udpEnabled?: boolean;
      /**
       * Format: int64
       * @description Maximum UDP packets per second per IP
       */
      udpPktThreshold?: number;
      /**
       * Format: int64
       * @description Stored UDP bandwidth threshold in MiB per second per source IP.
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
       * @description SYN packets observed in the cookie-threshold telemetry branch, not completed or generated SYN-cookie exchanges.
       */
      synCookies?: number;
      /**
       * Format: int64
       * @description SYN packets blocked by connection-rate checking, not distinct completed connections.
       */
      connBlocked?: number;
      /**
       * Format: int64
       * @description SYN packets counted as passed by connection-rate checking, not distinct established connections.
       */
      connPassed?: number;
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
       * @description Current IPv4 plus IPv6 tracking-map occupancy. Counter reset and protection disable do not clear these maps.
       */
      uniqueIps?: number;
    };
    /** @description Stored IPsec settings, not proof of active kernel or hardware enforcement. The reviewed implementation does not connect these global controls to enforcement; supportedAlgorithms is a static list and hwCapabilities is not populated. Tunnel state and telemetry have separate limitations. */
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
    /** @description Updates the stored global settings. The handler forwards every field, so omitted values become false, zero, or empty rather than preserving the previous setting. Successful storage does not establish active fast-path, offload, anti-replay, MTU, or SA lifecycle enforcement. */
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
    /** @description Tunnel selector metadata. Only srcCidr and dstCidr reach the generated strongSwan configuration in the reviewed implementation; protocol, srcPort, and dstPort do not currently restrict traffic. CIDR syntax is not validated by the domain validator. Do not interpret successful storage as enforcement. */
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
    /** @description Dead Peer Detection settings. The domain supplies restart, 30 seconds, and 120 seconds when action, delay, or timeout is empty or zero. The declared timeout default of 150 differs from this implementation behavior. */
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
    /** @description Creates or replaces a tunnel declaration and schedules a daemon reload; success does not establish an installed or usable tunnel. PUT uses the path name, although the shared request schema still requires body name. Omitted optional settings generally reset or default rather than merge; an omitted or empty PSK is preserved when updating an existing PSK tunnel without changing authentication mode. Names, IDs, proposals, and selectors lack complete configuration-syntax validation. Use explicit reviewed values. */
    IPsecTunnelMod: {
      /** @description Tunnel name (unique identifier) */
      name: string;
      /** @description Local gateway IPv4/IPv6 address or strongSwan special value %any, %defaultroute, or %config. Acceptance validates syntax, not topology or peer reachability. */
      localIp: string;
      /** @description Remote gateway IPv4/IPv6 address or strongSwan special value %any, %defaultroute, or %config. Acceptance does not establish a viable peer configuration. */
      remoteIp: string;
      /**
       * @description Authentication mode (PSK or certificate)
       * @enum {string}
       */
      authMode: "psk" | "cert";
      /** @description Secret required when creating a PSK tunnel or switching to PSK authentication. Omitted or empty preserves the existing secret when updating a tunnel that remains in PSK mode. Peer configuration export exposes this secret. */
      psk?: string;
      /** @description IKE local identifier */
      localId?: string;
      /** @description IKE remote identifier */
      remoteId?: string;
      /** @description Certificate name (required for cert mode) */
      certName?: string;
      /** @description Stored CA certificate reference. Currently neither required nor validated for cert mode and not consumed by the generated tunnel configuration; it does not establish peer trust policy. */
      caCertName?: string;
      /**
       * @description IKE version
       * @default ikev2
       * @enum {string}
       */
      ikeVersion?: "ikev1" | "ikev2";
      /**
       * @description IKE encryption algorithm as a single token (e.g. aes256, aes128). The gateway composes the proposal as encryption-integrity-dhgroup.
       * @default aes256
       */
      ikeEncryption?: string;
      /**
       * @description IKE integrity algorithm as a single token (e.g. sha256, sha1)
       * @default sha256
       */
      ikeIntegrity?: string;
      /**
       * @description IKE DH group as a single token (e.g. modp2048, modp1024)
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
       * @description ESP encryption algorithm as a single token (e.g. aes256, aes128). The gateway composes the proposal as encryption-integrity[-pfsgroup].
       * @default aes256
       */
      espEncryption?: string;
      /**
       * @description ESP integrity algorithm as a single token (e.g. sha256, sha1)
       * @default sha256
       */
      espIntegrity?: string;
      /** @description ESP PFS DH group as a single token (e.g. modp2048). When set, it is appended to the ESP proposal to enable Perfect Forward Secrecy; leave empty to disable PFS. */
      espDhGroup?: string;
      /**
       * Format: uint32
       * @description ESP lifetime in seconds
       * @default 3600
       */
      espLifetime?: number;
      /**
       * Format: uint32
       * @description Netfilter mark for VTI routing. Omitted or zero currently selects 100; zero does not disable marking. Known deletion limitation is documented on IPsecTunnel.
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
      /**
       * @description Append a weak legacy proposal (aes128-sha1-modp1024 for IKE, aes128-sha1 for ESP) as a compatibility fallback for old peers. Disabled by default.
       * @default false
       */
      compatFallback?: boolean;
      selector?: components["schemas"]["IPsecSelector"];
      dpd?: components["schemas"]["IPsecDPD"];
    };
    /** @description Requests ipsec up, down, or down followed by up for an existing tunnel. Command completion and best-effort state refresh are not proof of peer connectivity, installed traffic selectors, or successful encrypted traffic. */
    IPsecTunnelActionMod: {
      /**
       * @description Connection action - initiate (ipsec up), terminate (ipsec down), restart (down then up)
       * @enum {string}
       */
      action: "initiate" | "terminate" | "restart";
    };
    /** @description Secret-bearing peer configuration draft. PSK mode includes the plaintext shared secret; current management authorization permits viewer GET access. Certificate mode contains installation placeholders. Review peer-specific routing, credentials, and policy before use; this is not a ready-to-run or runtime-qualified peer configuration. */
    IPsecPeerConfig: {
      /** @description Tunnel name */
      tunnelName?: string;
      /** @description strongSwan ipsec.conf conn block for the remote peer */
      ipsecConf?: string;
      /** @description strongSwan ipsec.secrets entry for the remote peer (PSK mode only; contains the pre-shared key) */
      ipsecSecrets?: string;
      /** @description Peer-side installation notes */
      notes?: string;
    };
    /** @description Stored declaration with best-effort daemon state, not traffic-readiness evidence. State refresh is throttled and failures retain the previous state; counters and timestamps are incomplete. Known deletion implementation gap: deleting a marked tunnel issues unfiltered XFRM state and policy flushes, which can affect other tunnels in the same network namespace. Isolated per-tunnel deletion is not currently guaranteed. */
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
      /** @description Weak legacy proposal fallback enabled */
      compatFallback?: boolean;
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
    /** @description Intended SA read model. The reviewed SA enumeration implementation is a stub returning no entries; empty output does not prove that no kernel SAs exist. Creation and expiry timestamps are not mapped by the handler. */
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
    /** @description Incomplete telemetry. The implementation reports stored tunnel count, zero tunnelsUp, all stored tunnels as tunnelsDown, and placeholder zero SA, traffic, and error counters. lastUpdated is not mapped. DELETE resets stub state, not kernel statistics; these values are not operational evidence. */
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
    /** @description Leaf certificate and private-key input. Upload performs implemented local parsing and validity checks, not complete chain-trust or tunnel-readiness validation. Name reaches node filesystem paths without complete path-safety validation. The validation-only endpoint shares this schema but ignores name and description. See IPsecCertValidation for key-matching limitations. */
    IPsecCertificateMod: {
      /** @description Certificate name (unique identifier) */
      name: string;
      /** @description PEM-encoded X.509 certificate */
      certificate: string;
      /** @description PEM-encoded private key */
      privateKey: string;
      /** @description Accepted input that is currently unused. Encrypted private-key decryption is not implemented; supplying a passphrase does not enable encrypted-key support. */
      passphrase?: string;
      /** @description Optional description */
      description?: string;
    };
    /** @description Partial installed-certificate metadata. Serial, SAN, and key-usage extraction is unfinished, and validity/installation timestamps are not populated in responses. Deletion does not enforce an in-use dependency conflict; absence of a conflict response does not establish safe removal. */
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
    /** @description Result of implemented PEM, date, and limited private-key checks, not a chain-trust or handshake attestation. Current key matching does not reject all mismatched key types, and passphrase decryption is absent. Validity timestamps are not mapped. The serializer can omit valid when false; require an explicit true and inspect errors, while retaining these limitations. */
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
    /** @description Installs a PEM certificate after parsing and an IsCA check. The reviewed upload does not apply the leaf validator's date policy or complete trust validation. Name reaches node filesystem paths without complete path-safety validation. Installation is not proof that a tunnel uses this CA. */
    IPsecCACertificateMod: {
      /** @description CA certificate name */
      name: string;
      /** @description PEM-encoded X.509 CA certificate */
      certificate: string;
      /** @description Optional description */
      description?: string;
    };
    /** @description Partial CA metadata; validity and installation timestamps are not populated in responses. Deletion does not check tunnel dependencies or guarantee that all filesystem cleanup succeeded. Do not infer safe removal from success. */
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
    /** @description BGP neighbor creation input. ASN narrows to uint32 and remotePort to uint16 without local bounds checks. Omitted or zero port selects 179; enabled multihop uses TTL 8. IP parsing is not fully validated locally. POST uses GoBGP AddPeer, not a general replacement. */
    BGPNeigh: {
      /** @description BGP Neighbor IP address */
      ipAddress: string;
      /** @description Remote ASN, narrowed to uint32 without a bounds check. */
      remoteAs: number;
      /** @description Remote peering port, narrowed to uint16 without bounds checking; omitted or zero selects 179. */
      remotePort?: number;
      /** @description Enable eBGP multihop using TTL 8. */
      setMultiHop?: boolean;
    };
    /** @description Named defined-set readback. Prefix sets use prefixList and other types use lowercase list. Use lowercase prefix in requests: a broader internal alias is not faithfully emitted by the handler. The name all selects all names only on the GET path. */
    BGPPolicyDefinedSetGetEntry: {
      /** @description BGP Defined set Entries */
      name: string;
      prefixList?: components["schemas"]["BGPPolicyPrefix"][];
      list?: string[];
    };
    /** @description Named defined-set input. Use prefixList for prefix sets and capitalized List for other types. Unsupported type names are not rejected consistently and can select prefix by default. This request shape differs from GET's lowercase list field. */
    BGPPolicyDefinedSetsMod: {
      /** @description Defined-set name, not a neighbor IP address. */
      name: string;
      /** @description Entries for non-prefix defined sets. This write-time key is capitalized; GET uses lowercase list. */
      List?: string[];
      /** @description Entries for prefix defined sets; use instead of List when defineset_type is prefix. */
      prefixList?: components["schemas"]["BGPPolicyPrefix"][];
    };
    /** @description Prefix-set entry with CIDR ipPrefix and inclusive minimum..maximum masklengthRange. Local parsing checks the separator but ignores numeric conversion errors and narrows to uint32; prefix-family limits and range ordering require explicit validation rather than reliance on this schema. */
    BGPPolicyPrefix: {
      /** @description Network prefix in CIDR notation. */
      ipPrefix?: string;
      /** @description Inclusive prefix-length range minimum..maximum. Numeric parse errors, uint32 narrowing, family bounds, and ordering are not fully validated locally. */
      masklengthRange?: string;
    };
    /** @description Named BGP policy and its statements. Supply non-null conditions and actions for every statement because the handler dereferences these schema-optional objects. This endpoint does not provide a general atomic update contract. */
    BGPPolicyDefinitionsMod: {
      /** @description Policy definition name, not a neighbor IP address. */
      name?: string;
      statements?: components["schemas"]["BGPPolicyDefinitionsStatement"][];
    };
    /** @description BGP statement conditions and actions. Supply conditions and actions objects. Match options use any/all/invert, community actions add/remove/replace, and path-length operators eq/ge/le; unknown strings can silently fall back. routeDisposition uses accept-route/reject-route, unlike assignment accept/reject. asPathLength.value, prepend ASN/count, and setLocalPerf narrow to uint32 without full validation. setLocalPerf zero omits the action, setMed parses signed 32-bit decimal text, and setNextHop does not specially translate self. Validate AFI/SAFI, set references, prefixes, and numeric relationships before submission. */
    BGPPolicyDefinitionsStatement: {
      name?: string;
      /** @description Supply an object; the current POST handler dereferences it despite its optional schema declaration. */
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
      /** @description Supply an object; the current POST handler dereferences it despite its optional schema declaration. */
      actions?: {
        /** @description Statement disposition uses accept-route or reject-route; other values map to no disposition, unlike assignment accept/reject. */
        routeDisposition?: string;
        bgpActions?: {
          /** @description MED replacement parsed from signed 32-bit decimal text. This is not an unchecked arbitrary-size or relative-action string. */
          setMed?: string;
          /** @description Next-hop address text passed to GoBGP. The string self is not specially translated to the GoBGP self flag. */
          setNextHop?: string;
          /** @description Local preference under the existing setLocalPerf wire name. Zero omits this action; other values narrow to uint32 without bounds checks. */
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
            /** @description Decimal ASN text, parsed with ignored conversion errors and narrowed to uint32. Validate before submission. */
            as?: string;
            /** @description Prepend repeat count, narrowed to uint32 without bounds checking; omission becomes zero. */
            repeatN?: number;
          };
        };
      };
    };
    /** @description Policy-assignment input. policyType selects import/export; routeAction uses accept/reject as the default assignment action. POST adds assignments. On DELETE, omitted or empty policies removes all assignments for the selected target/direction, and the schema-required routeAction is ignored. */
    BGPApplyPolicyToNeighborMod: {
      /** @description BGP Neighbor IP address */
      ipAddress: string;
      /** @enum {string} */
      policyType: "import" | "export";
      /** @description Policy names to add or delete. On DELETE, omission or an empty list removes all assignments for the selected target and direction. */
      policies?: string[];
      /**
       * @description Default assignment action, accept or reject. Still schema-required on DELETE, but ignored by that handler.
       * @enum {string}
       */
      routeAction: "accept" | "reject";
    };
    /** @description BGP neighbor state readback. Configured remote port 179 is normalized to zero or omitted. multiHop reports whether multihop is enabled; it does not preserve an arbitrary configured TTL. A returned neighbor is not necessarily established. */
    BGPNeighGetEntry: {
      /** @description BGP Neighbor IP address */
      ipAddress?: string;
      /** @description Remote AS number */
      remoteAs?: number;
      /** @description Current state */
      state?: string;
      /** @description Formatted duration associated with current up/down state, or never; not always uptime. */
      updowntime?: string;
      /** @description Configured non-default BGP peering port (0 means the default, 179) */
      remotePort?: number;
      /** @description Whether eBGP multihop is enabled for this neighbor */
      multiHop?: boolean;
    };
    /** @description BGP startup input, not an atomic general replacement. Local ASN narrows to uint32 and listenPort to uint16; omitted or zero listenPort selects 179. SetNextHopSelf is a case-sensitive wire field and triggers additional policy setup. Failure can occur after partial startup or policy creation. */
    BGPGlobalConfig: {
      /** @description BGP Router ID */
      routerId: string;
      /** @description Local ASN, narrowed to uint32 without a bounds check. */
      localAs: number;
      /** @description Adds policy to set next hop as self, if enabled */
      SetNextHopSelf?: boolean;
      /** @description Listening port, narrowed to uint16 before zero selects 179. Original-input bounds are not fully checked. */
      listenPort?: number;
    };
    /** @description BFD session readback with interval in microseconds and observed state. sourceIP differs in capitalization from write-time sourceIp. Current IPv6 host/port splitting can corrupt remoteIp and port; a successful response is not IPv6 qualification. */
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
      /** @description Gateway version string reported by this build; not an instance name or proof of feature qualification. */
      version?: string;
      /** @description build info */
      buildInfo?: string;
      /** @description Product identifier for API flavor detection. This gateway reports "loxilb-inference-gateway"; upstream loxilb (and gateway builds predating the field) omit it, which clients treat as plain loxilb. */
      product?: string;
    };
    /** @description BFD session input for an existing cluster instance. New sessions require interval >= 100000 microseconds and retryCount > 0. Interval narrows from uint64 to uint32 without an upper-bound check. On an existing session, zero interval/retryCount preserves the current value, source-IP changes are not applied, and an unchanged request conflicts. Initial setup can return success before asynchronous creation fails. */
    BfdEntry: {
      /** @description Existing cluster instance name; omission does not select an implicit default instance. */
      instance?: string;
      /** @description Remote IP */
      remoteIp?: string;
      /** @description Literal local source IP, validated during first setup. Existing-session updates do not apply a changed source IP. */
      sourceIp?: string;
      /**
       * Format: uint64
       * @description Transmit interval in microseconds. New sessions require at least 100000; existing-session zero preserves the current interval. Conversion to uint32 lacks an upper-bound check.
       */
      interval?: number;
      /**
       * Format: uint8
       * @description Detection multiplier. New sessions require a positive value; existing-session zero preserves the current multiplier.
       */
      retryCount?: number;
    };
    MetricsConfig: {
      /** @description Runtime Prometheus enablement flag, not a sample-freshness or per-series availability verdict. This setting is not recovered through snapshots. */
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
    /** @description Successful local-account login returns an opaque random management session token, not a JWT containing client-readable identity or role claims. Local account routes require UserServiceEnable. Known logout limitation: its handler forwards the full Authorization header to a raw-token hash lookup, so a successful Bearer logout response is not verified session revocation. */
    LoginResponse: {
      token?: string;
    };
    MessageResponse: {
      message?: string;
    };
    SuccessResponse: {
      message?: string;
    };
    /** @description Shared local-account request model. Login uses username and password only. Creation also requires an explicit admin or viewer role in domain validation; body id and created_at are ignored. Creation requires an administrator, or no credential from a loopback transport peer while the account table is empty. PUT uses the path id, requires username and password, and currently drops role rather than applying it. Account mutations return an HTTP 200 result envelope, not a User resource. Security limitation: usernames are not checked for the delimiter used to encode principals, so role isolation is not established by the role enum alone. Intended role mapping requires an implementation correction, not client interpretation of the username. */
    User: {
      created_at?: string;
      id?: number;
      /** @description Required request secret. Create/update policy requires at least 9 bytes, upper/lowercase, a number, punctuation or symbol, inequality with username, and no three consecutive identical characters. Update checks password reuse by submitted username, so rename handling does not reliably compare the original account's password. Never a response field. */
      password: string;
      /** @description Account name. Complete normalization and delimiter validation are absent; see the User security limitation. The submitted value also selects the previous-password comparison on update. */
      username: string;
      /** @enum {string} */
      role?: "admin" | "viewer";
    };
    /** @description Read-only account identity without password material. created_at is emitted as RFC3339. Viewer authorization currently permits listing all accounts; this is not a per-user or per-tenant visibility boundary. */
    UserSummary: {
      created_at?: string;
      id?: number;
      username?: string;
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
      /** @description Log lines for this page, newest first. Empty rather than null when nothing matched. */
      logs?: string[];
      /** @description Name of the log file the lines were read from. */
      log_file?: string;
      /** @description Number of lines in this page — that is, the length of logs after filtering. Not a count of matches in the file. */
      log_count: number;
      /**
       * Format: int64
       * @description Size in bytes of the whole log file, independent of this page and of any filter. For a .log.gz archive this is the uncompressed size, since offsets address the decompressed stream.
       */
      total_size: number;
      /** @description Whether the backwards scan stopped before the start of the file, i.e. older lines remain to be searched. True implies next_cursor is set. Unfiltered this means more lines exist; filtered it means more matches may exist — the final page of a filtered search can legitimately come back empty. */
      has_more: boolean;
      /** @description Opaque cursor for the next (older) page; present only when has_more is true. */
      next_cursor?: string;
      /**
       * Format: int64
       * @description Bytes examined to build this page. Equal to the page's own span when unfiltered; larger for a filtered query that had to search backwards past non-matching lines. Compare against total_size to show progress through a long search.
       */
      scanned_bytes: number;
    };
    LogArchives: {
      /** @description List of log archive filenames. */
      archives?: string[];
      /** @description Per-archive metadata, in the same order as archives. Additive — archives stays populated for existing clients. */
      archive_info?: components["schemas"]["LogArchiveInfo"][];
    };
    LogArchiveInfo: {
      /** @description Archive filename, matching an entry in archives. */
      name?: string;
      /**
       * Format: int64
       * @description Size of the archive on disk in bytes (compressed size for .gz).
       */
      size_bytes?: number;
      /**
       * Format: date-time
       * @description Last modification time of the archive (RFC3339). The only reliable age signal for names that carry no timestamp.
       */
      modified?: string;
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
    /** @description Legacy message schema. OAuth authorization initiation currently returns HTTP 307 with Location, not a JSON success message or HTTP 302. OAuth routes require Oauth2Enable. State is single-use, process-local, and expires after ten minutes; browser/session and provider binding are not established. */
    OauthMessageResponse: {
      message?: string;
    };
    /** @description OAuth-specific message envelope. Invalid provider or callback state returns 400 on initiation/callback; exchange and refresh failures generally return 500. Refresh credential rejection is not consistently represented as 401. */
    OauthErrorResponse: {
      message?: string;
    };
    /** @description Provider token response, not a local JWT. Current OAuth admission assigns administrator authority unconditionally; identity admission and role mapping require explicit policy and implementation. GitHub configuration currently uses the Google OAuth endpoint, and provider user-info parsing is incomplete; this schema is not evidence of qualified provider support. */
    OauthLoginResponse: {
      /** @description The unique identifier for the authenticated user (e.g., Google user ID). */
      id?: string;
      /** @description The access token used for API requests. Typically expires after a short duration. */
      token?: string;
      /** @description Provider refresh token. The current refresh endpoint also requires the original access-token entry to remain cached, so refresh after access-token expiry is not supported by that path. */
      refreshtoken?: string;
      /** @description The duration in seconds that the access token is valid for. */
      expiresin?: number;
    };
    /** @description Refresh result for a still-cached access-token/refresh-token pair. A rotated refresh token is not returned by this schema, and replacement of stored credentials is not atomic. Do not describe this as a complete post-expiry refresh or refresh-token-rotation workflow. */
    OauthTokenResponse: {
      /** @description The access token used for API requests. Typically expires after a short duration. */
      token?: string;
      /** @description The duration in seconds that the access token is valid for. */
      expiresin?: number;
    };
    /** @description Management CORS origin additions, applied sequentially rather than atomically; a later failure does not undo earlier entries. Omitted or empty cors is a no-op. CRUD rejects wildcard origin entries. Removing the last explicit origin leaves an empty allowlist, not the factory wildcard state. GET uses corsAttr. Current preflight grants omit PATCH and X-Api-Key; CORS is not management authentication or data-plane API-key enforcement. */
    CorsEntry: {
      /** @description Origin strings to add. Values are trimmed; empty values and '*' are rejected, and duplicates conflict. Deletion identifies the exact origin encoded as one path parameter. */
      cors?: string[];
    };
    /** @description Replaces the configured manual management-token file with license_key and echoes the request on success. This is not license validation and does not change the active authentication mode. Empty/whitespace validation and a secret-response policy are not established. Authentication precedence is local user service, OAuth, then manual token; with none configured the management API operates without credential enforcement. */
    UpdateLicenseRequest: {
      license_key: string;
    };
    GPUMonitoringStatus: {
      /** @description Runtime monitoring flag, not proof of GPU health or effective routing. The generated response can omit false. */
      enabled?: boolean;
      /** @description Reported monitoring mode (standard_chwbl, gpu_aware or disabled when support is not compiled), not verified per-service datapath selection. */
      routing_mode?: string;
      /** @description Number of cached worker entries, including potentially stale samples; zero can be omitted. */
      worker_count?: number;
      /**
       * Format: date-time
       * @description Latest timestamp among cached samples, not a fresh health probe; may be absent when no sample exists.
       */
      last_metrics_update?: string;
      /** @description Whether the worker-statistics map descriptor is positive; this does not verify all required maps or their consumers. False can be omitted. */
      ebpf_map_loaded?: boolean;
    };
    WorkerMetricsEntry: {
      /** @description Worker endpoint label, conventionally IP:port. The handler does not establish endpoint registration or fully validate address syntax; GPU indexing uses an IP-like key, so different supplied ports can alias map state. */
      endpoint_ip: string;
      /** @description Caller-supplied queue observation. The builtin scraper stores waiting requests, not running plus waiting. Values are converted to uint32 without a matching schema maximum; safe bounds and a uniform producer contract remain unresolved. */
      queued_requests: number;
      /** @description Caller-supplied swap/preemption observation; the handler does not compute or verify a delta. Omitted values replace the previous sample with zero. Conversion to uint32 lacks a matching schema maximum. */
      swapped_requests?: number;
      /** @description vllm:gpu_cache_usage_perc * 100 (0-100 scale) */
      kv_cache_usage_perc: number;
      /** @description Advertised GPU-block capacity observation. Omitted values replace the previous sample with zero. The handler does not verify engine capacity and converts to uint32 without a matching schema maximum. */
      num_gpu_blocks?: number;
      /**
       * Format: date-time
       * @description Sample collection time. Omitted or zero time becomes the server's current time. Samples older than ten seconds are rejected; future timestamps currently lack an upper bound. Readback reports the cached sample time.
       */
      timestamp?: string;
    };
    WorkerMetricsResponse: {
      workers: components["schemas"]["WorkerMetricsEntry"][];
      /** @description Whether GPU worker-metrics monitoring is enabled. When false the gateway accepts no ingestion and workers is always empty; when true an empty workers list means no worker has reported yet. */
      monitoring_enabled: boolean;
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
      /** @description Currently always zero from a placeholder backend that performs no deletion; this does not prove the table is empty. */
      deleted_count: number;
      /**
       * Format: float
       * @description Currently a placeholder zero, not a measured age of remaining conversations.
       */
      oldest_remaining_hours: number;
      /** @description Status message */
      message: string;
    };
    /** @description Registration in the node's shared hostname-keyed certificate store, not a PEM upload. DELETE uses hostname and ignores certPath; it unregisters without deleting files. Mutations currently return HTTP 200 result strings for both success and failure. GET returns sniAttr entries, not certificates/count or reference-count fields. Hostname and path validation is incomplete. Loading a root CA file alone does not enable mTLS on this registration path. */
    SNICertificateEntry: {
      /** @description Hostname for SNI certificate (e.g., api.example.com). This certificate will be automatically used by all loadbalancer rules that have matching 'host' field. */
      hostname: string;
      /** @description Optional directory on the gateway node containing server.crt and server.key; omitted uses the hostname-relative location under /opt/loxilb/cert. This is not a client-side path or upload. The registration loader is invoked with mTLS disabled, so rootCA.crt alone does not enable client-certificate enforcement. */
      certPath?: string;
    };
    /** @description Managed PEM input and partial read model. POST currently returns empty 201, including when it mints an ID; callers cannot obtain that minted handle from the response. PUT uses the path ID and ignores body ID and hostnames. Known lifecycle gaps: duplicate POST persists before rejecting registration and can remove existing material; failed rotation does not roll back files; hostname ownership conflicts and multi-host swaps are not transactional; rotation retains the old hostname set. Do not claim atomic certificate transactions, automatic SAN migration, or verified zero downtime. GET returns no private-key material, although the shared schema still requires keyPem and the generated response can serialize it as null. */
    Cert: {
      /** @description Opaque handle, client-supplied or minted when absent/empty on POST. PUT uses the path handle. Current validation permits at most 63 bytes and rejects path separators and any '..' substring; NUL validation is incomplete. Minted handles are currently not returned by POST. */
      certId?: string | null;
      /** @description Leaf certificate PEM required on POST/PUT. The Go handler checks PEM armor; authoritative X.509/key parsing occurs in the OpenSSL loader after persistence. A 400 load failure does not imply transactional rollback of persisted material. */
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
       * @description Name from the YAML catalog_name field, not the filename. The catalog-list operation is currently unwired, so this is not an available response field.
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
       * @description YAML capture limit in bytes. The loader replaces zero with 16384 and rejects values above 10 MiB; zero is not unlimited. The catalog-list operation is currently unwired.
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
       * @description Metadata name returned by discovery, such as openai_v1, mcp_v1 or mock_parser. These differ from assignment keys openai, mcp and mock and must not be used interchangeably.
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
       * @description Intended descriptive metadata; currently not populated by the parser-list handler.
       * @example Parses OpenAI API requests including GPT models, token usage, and streaming responses
       */
      description?: string;
      /**
       * @description Intended capability metadata; currently not populated by the parser-list handler and not evidence of verified parser behavior.
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
       * @description Runtime catalog identifier assigned from the loaded catalog set, not a durable identity across changes to that set.
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
       * @description Runtime assignment key (openai, mcp or mock), not the distinct metadata name returned by discovery. The mapping is runtime-only; parser existence is checked, but catalog existence is not established by this update.
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
       * @description Reported enablement; false can be omitted. Default-looking status does not establish compiled support or usable maps.
       * @example true
       */
      enabled?: boolean;
      /**
       * Format: int64
       * @description Reported sampling percentage. Explicit zero can be omitted by response serialization; absence is not proof of the enable operation's default of 100.
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
    /** @description Stored settings, not scanner-readiness evidence. Requires piidetection and an initialized manager. Omission generally preserves values; empty strings do not clear them. Known gaps are documented on the affected fields below. Numeric int64 settings are narrowed to uint32 without upper bounds, and min_body_size <= max_body_size is not validated. Configuration success does not establish encryption, complete-body inspection, or protection. */
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
       * @description Intended large-message mode, currently dropped by this handler. The consumer skips oversized input in full mode or truncates to configured max_body_size in truncate mode, not invariably 64KB.
       * @example truncate
       * @enum {string}
       */
      scan_mode?: "full" | "truncate";
      /**
       * @description Stored gRPC endpoint. The reviewed client uses insecure transport credentials; storage does not establish connectivity, TLS protection, or successful live reconfiguration.
       * @example localhost:50051
       */
      analyzer_url?: string;
      /**
       * @description Optional stored endpoint; the reviewed Go bridge uses the analyzer client rather than configuring a separate anonymizer connection.
       * @example localhost:50051
       */
      anonymizer_url?: string;
      /**
       * Format: float
       * @description Stored threshold, including explicit zero. AnonymizeJSON reads this value, but legacy Analyze sends 0.5; uniform threshold enforcement is not established.
       * @example 0.7
       */
      score_threshold?: number;
      /**
       * Format: int64
       * @description Stored milliseconds, including explicit zero. The current reconfiguration bridge does not apply this value to the client's five-second RPC timeout; zero is not a proven disable or unlimited setting.
       * @example 100
       */
      timeout_ms?: number;
      /**
       * Format: int64
       * @description Stored byte bound, including explicit zero. Eligibility also checks HTTP-buffer length and content type; this does not guarantee inspection of every complete body or validate the relation to min_body_size.
       * @example 65536
       */
      max_body_size?: number;
      /**
       * Format: int64
       * @description Stored minimum byte bound, including explicit zero. The consumer checks HTTP-buffer length; the relation to max_body_size is not validated.
       * @example 100
       */
      min_body_size?: number;
      circuit_breaker?: components["schemas"]["PIICircuitBreaker"];
      retry?: components["schemas"]["PIIRetry"];
      /**
       * @description Intended v2 selector, currently dropped by the handler. Supplying it does not enable v2 processing; no performance improvement is established by this API.
       * @example true
       */
      enable_v2?: boolean;
      /**
       * @description Intended v2 operator, currently dropped by the handler. Selecting encrypt does not configure encryption or imply use of encryption_key.
       * @example encrypt
       * @enum {string}
       */
      default_operator?: "replace" | "redact" | "hash" | "mask" | "encrypt";
      /**
       * @description Intended v2 encryption input, currently dropped by the handler. Base64 decoding, AES-256 key-length validation, and encryption using this value are not implemented on this path.
       * @example YourBase64EncodedKey32BytesLong=
       */
      encryption_key?: string;
      /**
       * Format: int64
       * @description Intended v2 batch size, currently dropped by the handler. The declared range does not establish batch-processing support through this endpoint.
       * @example 10
       */
      batch_size?: number;
    };
    /** @description Stored C-scanner settings. Omission preserves values; explicit zero is accepted but ignored, not a disable command. Defaults are 5 failures, 60 seconds, and 3 successes. Values are narrowed to uint32 without upper bounds. */
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
    /** @description Stored C-scanner settings. Explicit zero is ignored by the manager, so max_retries=0 cannot currently disable retries. Defaults are one retry and 100 ms backoff; the consumer waits backoff_ms times the attempt number. Values are narrowed to uint32 without upper bounds. */
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
    /** @description Ordered update with required mode. clear ignores patterns; replace with omitted/empty patterns clears the list; add appends. Empty configuration scans all eligible URLs. A nonempty list is an include list with first match winning, so an exclude-only list scans nothing. The resulting limit is 64 entries; excess count currently maps to generic 500. Null entries can pass generated validation and be dereferenced by the handler. */
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
    /** @description Ordered include/exclude matcher, not an independent exclusion override. The first matching entry decides. Text beyond 127 bytes can be truncated in fixed-size storage; length and pattern syntax are not fully validated. */
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
    /** @description Stored configuration, not scanner readiness. scan_mode is not mapped by the handler; optional zero/false fields can be omitted. V2/encryption settings are neither returned nor applied by the configuration handler. Without the compiled feature or initialized manager, status fails. */
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
    /** @description Unimplemented management telemetry. All four values are hard-coded zero and currently serialize as an empty object, including without a manager. This is not evidence of zero scans, detections, blocks, or errors. */
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
    /** @description Stored settings, not verified active policy. Omitted nullable fields preserve values; explicit booleans are stored. Timeout, cache, connection pool, fail-policy, threshold, and scanner-selection settings are not connected end-to-end to the reviewed consumer. The RPC client uses a fixed 15-second timeout and insecure transport. The HTTP error path continues processing after scan failures, and oversized scan content also follows an allow/error path. Fail-closed protection is not currently guaranteed; implementation correction is required, not client reinterpretation. */
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
       * @description Intended error policy, stored but not reliably enforced by the HTTP consumer. true does not currently guarantee blocking on scanner errors; do not claim fail-closed protection from this setting.
       * @example false
       */
      fail_closed?: boolean | null;
      /**
       * Format: float
       * @description Intended blocking threshold. Zero is accepted but ignored by the manager, and the stored value is not connected to the C policy configuration; effective threshold enforcement is not established.
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
       * @description Stored cache TTL in seconds. Explicit zero is ignored, and this setting is not connected to caching in the reviewed RPC consumer.
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
       * @description Intended inclusion patterns, currently discarded by the manager. Supplied patterns do not restrict scanning through this setting.
       * @example [
       *   "/api/v1/chat*",
       *   "/api/*\/code"
       * ]
       */
      scan_patterns?: string[];
      /**
       * @description Intended exclusions, currently discarded by the manager. Supplying a path does not guarantee exclusion from scanning.
       * @example [
       *   "/health",
       *   "/metrics"
       * ]
       */
      skip_patterns?: string[];
    };
    /** @description Stored flags; omission preserves values and false is stored. Current request scanning nevertheless selects prompt_guard and regex directly, rather than consuming these flags. A response-scanning function exists but no production caller was located. These switches do not establish implemented end-to-end scanner selection. */
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
    /** @description Stored configuration plus incomplete tracked status, not a readiness probe. connected and last_health_check are not connected to the active client; pattern arrays are discarded and timeout/pool-size readback is absent. The disabled build can return inert status successfully. Optional false or zero fields may be omitted; configured values do not prove enforcement. */
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
    /** @description Stored flag readback only; current request scanning hard-codes prompt_guard and regex. These values do not establish which scanners run. */
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
    /** @description Management telemetry is not connected to scanner counters. Values come from an unpopulated object, including in the disabled build. Zero or omitted values do not prove no scans, threats, blocks, errors, or cache use. */
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
    /** @description Per-scanner telemetry placeholders; a member's presence does not establish that its scanner ran. */
    LlamaFirewallScannerStats: {
      prompt_guard?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      code_shield?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      regex?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      hidden_ascii?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      agent_alignment?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
      pii_detection?: components["schemas"]["LlamaFirewallIndividualScannerStats"];
    };
    /** @description Placeholder values, not measured scan, detection, latency, or error evidence in this management path. */
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
    /** @description Unpopulated decision counters. hitl does not establish an implemented human-review workflow or enforcement action. */
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
    /** @description Intended health response. Current behavior reads tracked state rather than probing the scanner, and no updater from the active client was located. Unhealthy results use the generic error envelope instead of this schema; latency_ms is not measured probe latency. This is not readiness attestation. */
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
    /** @description Management creation of a data-plane credential; management authorization and data-plane enforcement are separate. Protection requires a service requiring API-key authentication. Quotas lack complete nonnegative/range validation. Whitespace-only tenant IDs are rejected but surrounding spaces are retained. Empty allowed_models permits all models; otherwise matching is exact. Embedded commas do not round-trip as one model identifier. */
    ApiKeyCreateRequest: {
      /** @description Tenant identifier that owns this key */
      tenant_id: string;
      /** @description Human-readable label for the API key */
      name?: string;
      /** @description Optional imported credential; absent or empty generates a new key. Imports require 16-512 printable non-space ASCII bytes. GET/list never returns the credential. Create currently emits an empty raw_key string for imports, not omission. Length rejection maps to 400; invalid character errors currently fall through to generic 500. */
      api_key?: string;
      /** @description List of model identifiers this key may access */
      allowed_models?: string[];
      /**
       * Format: int64
       * @description Maximum requests per second allowed for this key
       */
      rate_limit_rps?: number;
      /**
       * Format: int64
       * @description Total request-bucket capacity, not additional capacity above RPS. Zero uses per-key RPS. Nonpositive RPS skips this limiter; negative-value validation remains incomplete.
       */
      burst_size?: number;
      /**
       * Format: int64
       * @description Stored per-key token-quota metadata; enforcement is not connected in the reviewed token-accounting consumer. Tenant and tenant/model quotas are separate.
       */
      tokens_per_min?: number;
      /**
       * Format: date-time
       * @description Optional RFC3339 expiry. Omitted, zero-time, or Unix-epoch values mean no expiry in this handler. Other past timestamps are accepted, so successful creation does not establish a currently usable key.
       */
      expires_at?: string;
      /** @description Whether the API key is active. Absent = enabled (optional, nullable to distinguish unset). */
      enabled?: boolean | null;
    };
    /** @description HTTP 201 creation result. key_id is the management handle. raw_key contains a secret only for generated credentials and is currently empty for imports. Protect generated secrets from logs; subsequent reads expose metadata only. */
    ApiKeyCreateResponse: {
      /** @description Generated plaintext credential returned only at creation; currently an empty string, not omission, when the caller imported api_key. */
      raw_key: string;
      /** @description Unique identifier of the created API key */
      key_id: string;
    };
    /** @description Metadata, not effective service-enforcement status. enabled=false is explicitly serialized; optional zero metadata can be absent. A list without nonempty tenant_id returns all keys; viewer authorization is not tenant scoped. DELETE permanently removes the key and returns 204, not reversible disabling. Per-key token-quota enforcement is not connected. */
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
       * @description Total request-bucket capacity, not additional capacity above RPS. Nonpositive burst uses per-key RPS; nonpositive RPS skips that limiter.
       */
      burst_size?: number;
      /**
       * Format: int64
       * @description Stored metadata, not an enforced per-key token quota in the reviewed consumer. Tenant and tenant/model token limits are separate.
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
      enabled: boolean;
    };
    /** @description POST replaces aggregate rps, tokens_per_min, and burst_pct; omission becomes zero, not preservation. Supplied model_limits are individual upserts or removals; omitted/empty model_limits preserves existing model rows. Aggregate and model writes are sequential, not one transaction, so failure can leave partial changes. Blank identifiers and malformed model entries are not consistently rejected as 400. Configuration alone does not enable enforcement on a service. */
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
      /**
       * Format: int64
       * @description Token bucket capacity as a percent of tokens_per_min; 0 uses the server default
       */
      burst_pct?: number;
      /** @description Per-model token quotas for the tenant */
      model_limits?: components["schemas"]["TenantModelRateLimit"][];
    };
    /** @description A nonempty model is required by the handler despite the schema's optional property. Storage rejects '|' in tenant/model names. Zero, including an omitted tokens_per_min, removes the model quota. Negative values currently also remove it; that is not an approved negative-quota policy. Repeated model entries are applied in order, with the last successful write winning. */
    TenantModelRateLimit: {
      /** @description Model name the quota applies to */
      model?: string;
      /**
       * Format: int64
       * @description Maximum LLM tokens per minute for this tenant and model; 0 removes the model quota
       */
      tokens_per_min?: number;
    };
    /** @description Stored quotas, not enforcement status. Missing aggregate and model records produce 404; model-only state may lack an aggregate update timestamp. Zero aggregate rates disable their limiter while model quotas remain separate. burst_pct controls token capacity, not request-rate burst; zero uses the server default and positive values are clamped to 1-1000. */
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
       * Format: int64
       * @description Token bucket capacity as a percent of tokens_per_min; 0 uses the server default
       */
      burst_pct?: number;
      /** @description Per-model token quotas for the tenant */
      model_limits?: components["schemas"]["TenantModelRateLimit"][];
      /**
       * Format: date-time
       * @description Timestamp of the last rate limit update
       */
      updated_at?: string;
    };
    /** @description Full replacement of the singleton OPA watcher configuration, not a patch. Acceptance starts background polling; it does not prove a successful fetch or firewall application. The current internal applier uses localhost HTTP without a management credential, so authenticated management deployments require implementation reconciliation before enforcement can be claimed. */
    OPAWatcherConfig: {
      /** @description OPA server URL with a hostname. Current admission checks a limited IPv4 blocklist only; it does not provide comprehensive IPv6, redirect, or DNS-rebinding protection. This is an unresolved outbound security limitation, not a qualified SSRF prevention guarantee. */
      opa_url: string;
      /**
       * @description OPA data path; omitted or empty uses loxilb/l4. Leading slashes are removed before appending the path after /v1/data/.
       * @default loxilb/l4
       */
      policy_path?: string;
      /**
       * @description Polling interval in seconds; omitted or nonpositive uses 30. The initial poll starts after the current 10-second initial delay. Positive values need an overflow-safe product bound before conversion to time.Duration; that upper-bound validation is not implemented.
       * @default 30
       */
      poll_interval_sec?: number;
      /**
       * @description Intended OPA failure-policy declaration. The current watcher stores and reports this flag but does not implement distinct fail-open behavior; fetch failures retain the previously applied state for either value. False does not implement a deny-all fallback. Policy semantics and enforcement require implementation reconciliation.
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
      /** @description Stored fail_open declaration; the current failure path does not consume it and retains existing applied rules for either value. */
      fail_open?: boolean;
      /** @description Watcher lifecycle state (running, stopped, not_configured). Running means polling was started, not that policy synchronization succeeded. */
      status?: string;
      /**
       * Format: date-time
       * @description Timestamp of the latest cycle reaching the end of apply, including partial apply failures. Consult last_error; this timestamp does not prove complete or durable synchronization.
       */
      last_sync_at?: string;
      /** @description Number of rules in the watcher cache, including loaded cached state. This is not a live firewall or dataplane readback. */
      rules_count?: number;
      /** @description Policy-fetch circuit breaker state (0=closed, 1=open, 2=half-open). This is distinct from the fullproxy endpoint circuit breaker. */
      circuit_breaker_state?: number;
      /** @description Last error message if any */
      last_error?: string;
    };
  };
  responses: {
    /** @description Authenticated principal is not authorized for this operation */
    ManagementForbidden: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Management credential store unavailable; the credential could not be evaluated */
    ManagementStoreUnavailable: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Missing or invalid management credential */
    ManagementUnauthorized: {
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
  };
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
   * @description Returns simplified input metadata from embedded main and supplemental Swagger. One operation is selected per path, preferring POST, then PUT, then PATCH; main-document entries win overlaps. Ranges, defaults, patterns, authentication, cross-field rules and vendor extensions, including root relationship metadata, are not passed through. This is advisory field metadata, not a complete UI validator. Extraction errors are currently logged without changing the handler's 200 response.
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Patch an existing Load balancer service (RFC 7386 JSON merge-patch)
   * @description Updates an existing L4 rule selected by VIP/port/protocol; does not create a missing rule. FullProxy rules are rejected. The handler overlays name, sel, inactiveTimeOut, monitor, probetype, probeport, probereq, proberesp and adminStateUp when present, and replaces endpoints or allowedSources when their collection key is present. Changes to security, egress, mode or the identifying tuple are guarded as immutable. Empty or null endpoints are rejected; serviceArguments:null does not clear the service configuration. Implementation warning: this is a restricted overlay, not general recursive RFC 7386 support for every LoadbalanceEntry field. Other schema fields are not applied by this handler. Canonical probeTimeout/probeRetries updates miss the handler's incorrectly lowercased presence checks; this is a wiring defect, not an alternate spelling of the API. Existing-member metadata updates also have the limitations documented on endpoints. The L4 path uses in-place reconciliation, but source inspection does not establish runtime connection preservation. Returns 200 on successful apply and 404 when absent; errors, including no-change detection, can prevent a successful apply.
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get all L7 content-routing policies
   * @description Returns stored policies sorted by policy ID under l7policyAttr. This is registry readback, not an effective dataplane policy or attachment-status query; submitted values can differ from bounded C values.
   */
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Create an L7 content-routing policy
   * @description Validates a policy, resolves its load-balancer ID, attaches its routes to an existing sockproxy listener, then stores the policy. The current attachment bridge supports IPv4; an existing LB resource alone does not establish an eligible listener. Success returns 204 without a policy body or generated ID. Duplicate policy IDs, including identical replay, and a second policy for the same LB ID return 409. No update or Gateway API export operation is performed. Implementation warnings on L7Policy, L7Rule and L7Action describe attachment identity, truncation and response-path gaps. A successful attach is source-level configuration evidence, not proof of effective matching, TLS responses or lifecycle safety. Policy ownership across LB resources sharing a listener remains unresolved.
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
      /** @description Policy validation or dataplane attachment failed. Generated request-model validation runs before the handler; this operation does not perform Gateway API export. */
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Referenced load-balancer not found */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Resource conflict (duplicate policy id, or the load-balancer already carries a policy) */
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get a single L7 content-routing policy by id
   * @description Returns the stored policy with this ID, or 404 when absent. Readback does not verify that the listener still carries the policy or that its effective values match the stored document.
   */
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Delete an L7 content-routing policy by id
   * @description Detaches the policy when its referenced LB still exists, then removes the stored resource. A missing policy returns 404; a detach failure retains the registry entry. Implementation warning: when the LB has disappeared the handler skips detach, although C can retain the listener and attached routes. Successful deletion in that case does not establish dataplane cleanup.
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get the resolved KV-exact composition status of Load balancer rules
   * @description Returns the resolved KV-exact status (model-profile/engine-contract binding identity, binding generation and digest, hash contract, attestation-ladder desired/enforced states with reason codes) for every KV-exact rule on the composite key. A DEDICATED read model - resolved status never rides the GET/POST-shared LoadbalanceEntry, so an echoed GET body can never replay resolved state back as configuration. Every identity field is a scalar by schema.
   */
  getConfigLoadbalancerKvExactStatus: {
    parameters: {
      query?: {
        /** @description Restrict to the rule serving this model name (absent = every KV-exact rule on the key) */
        model_name?: string;
      };
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
          "application/json": {
            kvExactStatusAttr?: components["schemas"]["KvExactStatusEntry"][];
          };
        };
      };
      /** @description Invalid authentication credentials (unknown, expired or missing token, or a credential that is not a management identity — the cases are deliberately indistinguishable) */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Authenticated management identity whose role does not authorize this operation */
      403: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description No KV-exact status on this key. Deliberately coalesced: no rule exists on the composite key, the rule(s) on the key are not KV-exact, the model_name filter matched no rule, or the composite key itself is unservable (for example an unsupported protocol — a key that can never hold a rule answers the same as an empty key) — all four answer 404. A 200 body always carries at least one entry (empty result sets are never emitted as 200). */
      404: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Malformed path or query parameter (e.g. a non-numeric port). Emitted by request validation before the handler runs; the body code field carries a validation code, not an HTTP status. */
      422: {
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
      /** @description Credential store unavailable — the credential was never examined; retry after a moment */
      503: {
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Enable HTTP/HTTPS protocol tracing
   * @description Enables runtime HTTP/HTTPS tracing and attempts to initialize its consumer. Actual capture depends on the proxy path and tracing configuration; enablement does not prove capture or export of all traffic. Some initialization failures currently return an error message with HTTP 200.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Disable HTTP/HTTPS protocol tracing
   * @description Disables runtime HTTP/HTTPS trace emission without itself shutting down the existing consumer or proving buffered events were exported. Some failure branches currently return an error message with HTTP 200.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get HTTP/HTTPS tracing status
   * @description Returns tracing enablement and OTLP configuration. Event totals and ring-utilization reporting currently use placeholder statistics, not measured zero traffic or loss. Connection state reflects recorded export outcomes rather than a fresh reachability probe.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get OTLP endpoint configuration (with security settings)
   * @description Returns configured OTLP endpoint, protocol and TLS settings. Header values are redacted or marked for reprovisioning and must not be submitted back as credentials. Connection state reflects recorded export outcomes rather than a fresh connectivity check.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Configure OTLP endpoint for trace export (with TLS security)
   * @description Replaces the OTLP exporter configuration rather than patching individual fields. Endpoint and protocol are required. Omitted TLS fields use their defaults; omitted headers clear the header map. Redacted GET values must not be submitted as credentials. Configuration changes can precede secret persistence or reconnection, leaving partial state on failure; some failures currently return HTTP 200 with an error message.
   *
   * **Security Features:**
   * - TLS encryption enabled by default (use_tls: true)
   * - TLS certificate verification (tls_skip_verify: false)
   * - Optional authentication headers (API keys, bearer tokens)
   * - Endpoint syntax checks (host:port); no DNS lookup or complete numeric port-range validation is performed by this handler
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * List all loaded trace catalogs
   * @description Not implemented by the current router configuration; the generated default handler returns 501. The following catalog shape describes intended data, not an available response.
   * Catalogs define parser assignments, sampling rates, and tracing behavior for different services.
   *
   * **Catalog Sources:**
   * - Builtin catalogs: /opt/loxilb/trace-catalogs/
   * - User overrides: /etc/loxilb/trace-catalogs/
   *
   * **Response includes:**
   * - Catalog name (from the YAML catalog_name field, not the filename)
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
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
   * Discovery currently returns metadata names such as openai_v1, mcp_v1 and mock_parser, while assignment accepts registry keys openai, mcp and mock. Do not use discovery names directly as assignment values. Description and capabilities are not populated, and an unavailable tracing registry can cause 500.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get parser assignment for a catalog
   * @description Returns the parser currently assigned to a specific trace catalog.
   * parser_name is the runtime assignment key; parser_type is the YAML declaration and can differ after an override. Catalog metadata can be absent. Mapping lookup errors, including an unavailable registry, currently produce 404. Numeric catalog IDs are not durable identities across catalog-set changes.
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Update parser assignment for a catalog
   * @description Dynamically changes which parser is used for a specific catalog at runtime.
   * The override is runtime-only, does not edit YAML, and can be replaced by catalog synchronization. The handler validates the parser key but not catalog existence; current success has an empty body despite the declared response schema.
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Remove parser assignment for a catalog
   * @description Removes the catalog → parser mapping, causing the system to fall back to:
   * 1. URL path-based routing (e.g., /v1/chat/completions → openai)
   * 2. Default mock parser
   *
   * Removal is runtime-only and succeeds with 204 even when no mapping exists. Registry unavailability can produce 500. This does not edit YAML or guarantee that later catalog synchronization will preserve the removal.
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
      403: components["responses"]["ManagementForbidden"];
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
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Enable L4 connection tracing
   * @description Enables runtime L4 trace emission when supported by the build and loaded maps. Omitted body or sampling_rate defaults to 100; explicit zero is retained. Enablement alone does not prove capture or export of every connection.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Disable L4 connection tracing
   * @description Disables L4 connection tracing and stops emitting events to ring buffers.
   * This also resets sampling to 100. The operation does not guarantee completion or export of all in-flight spans and does not itself shut down the existing consumer.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Get L4 tracing status and statistics
   * @description Returns L4 configuration with currently incomplete statistics wiring. REST reads C counters that are separate from the Go consumer's event counters; default or zero values do not establish measured traffic or loss, or compiled feature availability.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Update L4 tracing sampling rate
   * @description Changes the L4 tracing sampling rate without disabling tracing.
   * New connections will use the updated rate immediately.
   *
   * **Sampling behavior:**
   * - 0%: Effectively disables tracing (use /disable endpoint instead)
   * - 1-99%: Hash-based sampling with cached decisions and special handling for uncached close, reset and error events; this is not an unconditional same-decision guarantee for every event
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Reset L4 tracing statistics
   * @description Resets the C-side L4 statistics currently exposed by this API, not the separate Go consumer counters. Statistics wiring is incomplete, so success does not establish a fresh measurement baseline across the tracing pipeline.
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
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
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
      /** @description Authenticated principal is not authorized to list API keys */
      403: {
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
      /** @description Management credential store or API-key store unavailable */
      503: {
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
      /** @description Authenticated principal is not authorized to create API keys */
      403: {
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
      /** @description Management credential store or API-key store unavailable */
      503: {
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
      /** @description Authenticated principal is not authorized to read API keys */
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
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Management credential store or API-key store unavailable */
      503: {
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
      /** @description Authenticated principal is not authorized to delete API keys */
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
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Management credential store or API-key store unavailable */
      503: {
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
      /** @description Authenticated principal is not authorized to update tenant quotas */
      403: {
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
      /** @description Management credential store or API-key store unavailable */
      503: {
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
      /** @description Authenticated principal is not authorized to read tenant quotas */
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
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Management credential store or API-key store unavailable */
      503: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * List the published model-prompt profiles
   * @description Returns every profile of the currently PUBLISHED registry generation. Publication is all-or-nothing: a profile that appears here has already passed artifact digest verification, tokenizer load, and (when chat is declared) chat-template compilation - there is no partial or invalid availability state to represent, and disabled/unpublished profiles simply do not appear. Discovery is a CACHE, never an admission authority: a registry reload can change the available set at any time (rule POST admission re-validates against the generation current at POST time). Compare registryGeneration/setDigest with later discovery reads; after create, compare profile identity/generation with the rule's modelProfileId/modelProfileGen and inspect enforcedState. setDigest and bindingDigest identify different objects and must not be compared. profiles is deterministically ordered by profileId ascending with no pagination (the registry is a bounded operator-curated set). Artifact locator paths and host filesystem information are deliberately excluded from the response.
   */
  getConfigAiModelProfiles: {
    responses: {
      /** @description OK. When no registry is published the response carries registryGeneration 0 and an empty profiles array - the documented legacy-mode state, not an error. */
      200: {
        content: {
          "application/json": components["schemas"]["AiModelProfileRegistry"];
        };
      };
      /** @description Invalid authentication credentials (unknown, expired or missing token, or a credential that is not a management identity — the cases are deliberately indistinguishable) */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Authenticated management identity whose role does not authorize this operation */
      403: {
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
      /** @description Credential store unavailable — the credential was never examined; retry after a moment */
      503: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
    };
  };
  /**
   * Get one published model-prompt profile
   * @description Returns the single profile identified by profile_id in the currently PUBLISHED registry generation (so a client can refresh one profile cheaply). Schema is identical to a list entry. Same cache-not-authority and exclusion rules as the list operation.
   */
  getConfigAiModelProfilesProfileID: {
    parameters: {
      path: {
        /** @description Profile identifier (the registry key; a single path-safe segment) */
        profile_id: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["AiModelProfileEntry"];
        };
      };
      /** @description Invalid authentication credentials (unknown, expired or missing token, or a credential that is not a management identity — the cases are deliberately indistinguishable) */
      401: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Authenticated management identity whose role does not authorize this operation */
      403: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      /** @description Unknown profile_id in the currently published registry generation - or no registry is published at all (the list operation answers 200/generation 0 for that state; the detail operation has no profile to serve). */
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
      /** @description Credential store unavailable — the credential was never examined; retry after a moment */
      503: {
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
      401: components["responses"]["ManagementUnauthorized"];
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
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
      401: components["responses"]["ManagementUnauthorized"];
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
  /**
   * Stop and remove OPA L4 policy watcher
   * @description Cancels polling and removes the in-memory singleton configuration. Previously applied firewall rules and the persisted watcher cache are retained. Repeated deletion succeeds. Cancellation does not join an in-flight polling goroutine. This marked stub is intercepted by raw middleware; swagger-extras.yml describes the actual response envelope.
   */
  deleteConfigOpaWatcher: {
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["PostSuccess"];
        };
      };
      401: components["responses"]["ManagementUnauthorized"];
      403: components["responses"]["ManagementForbidden"];
      /** @description Internal service error */
      500: {
        content: {
          "application/json": components["schemas"]["Error"];
        };
      };
      503: components["responses"]["ManagementStoreUnavailable"];
    };
  };
}
