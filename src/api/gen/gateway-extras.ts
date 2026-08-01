/**
 * Generated from api-spec/gateway-swagger-extras.yml by scripts/gen-api-types.mjs — DO NOT EDIT.
 * Regenerate with: npm run gen:api
 */


export interface paths {
  "/config/ai/kv/inventory": {
    /**
     * Dump the KV-cache block inventory for an endpoint
     * @description Read-only admin endpoint returning the per-block 64-bit hash inventory tracked for one endpoint of an AI service. block_idx is a synthetic sequence index (map iteration order), not a semantic block position.
     */
    get: {
      parameters: {
        query: {
          /** @description Numeric service identifier (uint32) */
          service_id: number;
          /** @description Endpoint index within the service */
          ep_idx: number;
        };
      };
      responses: {
        /** @description KV inventory snapshot */
        200: {
          content: {
            "application/json": {
              service_id?: number;
              ep_idx?: number;
              /** @description Hash algorithm used for block keys */
              hash_algo?: string;
              blocks?: {
                  /** @description Synthetic sequence index */
                  block_idx?: number;
                  /**
                   * Format: uint64
                   * @description 64-bit block hash key
                   */
                  hash_uint64?: number;
                }[];
              total?: number;
            };
          };
        };
        /** @description Invalid service_id or ep_idx */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Service or endpoint not found */
        404: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Method not allowed (GET only) */
        405: {
          content: never;
        };
        /** @description KV inventory provider not registered */
        503: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
      };
    };
  };
  "/config/dpu/debug": {
    /**
     * Get DPU offload debug state and hardware counters
     * @description Returns DPU offload status, aggregate counters, per-pipe counters, and optionally per-entry detail. Without query parameters the fast aggregate shape is returned; flows=1 opts in to expensive per-entry enumeration (flows, fdb_entries, route_entries, acl_entries). Supplying any of pipe, svc, ep, or limit switches to the filtered per-entry detail path, which populates doca_entry_details.
     */
    get: {
      parameters: {
        query?: {
          /** @description Set to 1 to include per-flow/FDB/route/ACL hardware counter arrays */
          flows?: "1";
          /** @description Restrict the filtered entry query to one hardware pipe */
          pipe?: "rss" | "to_kernel" | "egress_dispatch" | "ct_fwd_5tuple" | "ct_rev_5tuple" | "root_l3l4_dispatch" | "fdb_l2" | "deny" | "allow";
          /** @description Filter entries by service name */
          svc?: string;
          /** @description Filter entries by endpoint in addr:port form */
          ep?: string;
          /** @description Maximum entries returned by the filtered query (clamped to 2000) */
          limit?: number;
        };
      };
      responses: {
        /** @description DPU debug state */
        200: {
          content: {
            "application/json": components["schemas"]["DpuDebugResponse"];
          };
        };
        /** @description Invalid pipe or endpoint parameter */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description DPU manager not initialized (filtered path only) */
        503: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
      };
    };
    /**
     * Trigger a DPU debug action
     * @description Executes a debug action. Supported actions are "unregister" (unload a DPU plugin by name) and "cb_force" (pin the offload circuit breaker open or closed for testing).
     */
    post: {
      /** @description Debug action */
      requestBody: {
        content: {
          "application/json": {
            /** @enum {string} */
            action: "unregister" | "cb_force";
            /** @description Plugin name (required for action=unregister) */
            plugin?: string;
            /**
             * @description Circuit breaker mode (required for action=cb_force)
             * @enum {string}
             */
            mode?: "open" | "close";
          };
        };
      };
      responses: {
        /** @description Action executed */
        200: {
          content: {
            "application/json": {
              status?: string;
              /** @description Present for action=cb_force */
              circuit_breaker_open?: boolean;
            };
          };
        };
        /** @description Invalid JSON, unsupported action, or missing field */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Method not allowed */
        405: {
          content: never;
        };
        /** @description DPU manager not initialized */
        503: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
      };
    };
  };
  "/config/dpu/hwcounters": {
    /**
     * Get per-flow DPU hardware counters
     * @description Returns hardware packet and byte counters for all offloaded flows, with the flow key parsed into protocol and source/destination IPs. Returns an empty flow list when no DPU provider is registered.
     */
    get: {
      responses: {
        /** @description Hardware counters per flow */
        200: {
          content: {
            "application/json": {
              flows?: {
                  /** @description Raw flow key */
                  flow_id?: string;
                  protocol?: string;
                  src_ip?: string;
                  dst_ip?: string;
                  /** Format: uint64 */
                  packets?: number;
                  /** Format: uint64 */
                  bytes?: number;
                }[];
              total_flows?: number;
            };
          };
        };
        /** @description Method not allowed (GET only) */
        405: {
          content: never;
        };
      };
    };
  };
  "/config/opa/watcher": {
    /**
     * Get OPA policy watcher status
     * @description Returns the configuration and runtime status of the OPA L4 policy watcher. When no watcher is configured, status is "not_configured".
     */
    get: {
      responses: {
        /** @description Watcher status */
        200: {
          content: {
            "application/json": {
              opa_url?: string;
              policy_path?: string;
              poll_interval_sec?: number;
              fail_open?: boolean;
              /** @enum {string} */
              status?: "not_configured" | "running" | "stopped";
              /** @description RFC 3339 timestamp of the last successful sync */
              last_sync_at?: string;
              rules_count?: number;
              circuit_breaker_state?: number;
              last_error?: string;
            };
          };
        };
      };
    };
    /**
     * Configure and start the OPA policy watcher
     * @description Creates (or replaces) the OPA L4 policy watcher and starts polling the given OPA server. URLs resolving to private or reserved IP ranges are rejected for SSRF protection.
     */
    post: {
      /** @description Watcher configuration */
      requestBody: {
        content: {
          "application/json": {
            /** @description Base URL of the OPA server */
            opa_url: string;
            /**
             * @description OPA policy path to poll
             * @default loxilb/l4
             */
            policy_path?: string;
            /**
             * @description Poll interval in seconds
             * @default 30
             */
            poll_interval_sec?: number;
            /** @description Allow traffic when OPA is unreachable */
            fail_open?: boolean;
          };
        };
      };
      responses: {
        /** @description Watcher configured */
        200: {
          content: {
            "application/json": {
              result?: string;
            };
          };
        };
        /** @description Invalid JSON, missing opa_url, or URL blocked by SSRF protection */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Method not allowed */
        405: {
          content: never;
        };
      };
    };
    /**
     * Stop and remove the OPA policy watcher
     * @description Stops the watcher if running. Succeeds even when no watcher is configured.
     */
    delete: {
      responses: {
        /** @description Watcher stopped */
        200: {
          content: {
            "application/json": {
              result?: string;
            };
          };
        };
      };
    };
  };
  "/config/ai/apikey/{key_id}": {
    /**
     * Update an AI gateway API key
     * @description Updates the allowed model list and/or the enabled flag of an existing API key. Only the PATCH method on this path is handled by the middleware; the other API key operations are part of the generated specification.
     */
    patch: {
      parameters: {
        path: {
          /** @description API key identifier */
          key_id: string;
        };
      };
      /** @description Fields to update */
      requestBody: {
        content: {
          "application/json": {
            /** @description Replacement list of models the key may access */
            allowed_models?: string[];
            /** @description Enable or disable the key */
            enabled?: boolean;
          };
        };
      };
      responses: {
        /** @description Key updated */
        204: {
          content: never;
        };
        /** @description Missing key_id or invalid request body */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Key not found */
        404: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Update failed */
        500: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
      };
    };
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    /** @description Minimal error envelope returned by the raw handlers. */
    SimpleError: {
      error?: string;
    };
    /** @description DPU offload debug state, aggregate counters, and optional per-entry detail. */
    DpuDebugResponse: {
      enabled?: boolean;
      /** Format: uint64 */
      offload_success?: number;
      /** Format: uint64 */
      offload_failure?: number;
      /** Format: int64 */
      offload_active?: number;
      offload_success_by_pipe?: {
        [key: string]: number;
      };
      offload_failure_by_pipe?: {
        [key: string]: number;
      };
      /** @description Per-pipe active counts plus a synthetic "total" key */
      offload_active_by_pipe?: {
        [key: string]: number;
      };
      plugins?: string[];
      /** @description Per-flow hardware counters (only with flows=1) */
      flows?: {
          flow_key?: string;
          pipe_key?: string;
          /** Format: uint64 */
          hw_bytes?: number;
          /** Format: uint64 */
          hw_pkts?: number;
        }[];
      /** @description Per-FDB-entry hardware counters (populated with flows=1; always present as an array) */
      fdb_entries?: {
          mac?: string;
          port?: number;
          /** Format: uint64 */
          hw_bytes?: number;
          /** Format: uint64 */
          hw_pkts?: number;
        }[];
      /** @description Per-route hardware counters (always present as an array) */
      route_entries?: {
          dst?: string;
          next_hop_mac?: string;
          port?: number;
          /** Format: uint64 */
          hw_bytes?: number;
          /** Format: uint64 */
          hw_pkts?: number;
        }[];
      /** @description Per-ACL-rule hardware counters (always present as an array) */
      acl_entries?: {
          rule_id?: number;
          action?: string;
          /** Format: uint64 */
          hw_bytes?: number;
          /** Format: uint64 */
          hw_pkts?: number;
        }[];
      circuit_breaker_open?: boolean;
      /** @description Per-entry detail (only on the filtered query path) */
      doca_entry_details?: {
          /** @description Hashed entry handle for log correlation */
          entry_handle_hashed?: string;
          "5_tuple"?: string;
          /** Format: uint64 */
          hw_pkts?: number;
          /** Format: uint64 */
          hw_bytes?: number;
          /** Format: uint64 */
          age_ms?: number;
          pipe_key?: string;
        }[];
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
