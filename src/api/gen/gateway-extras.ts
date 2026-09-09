/**
 * Generated from api-spec/gateway-swagger-extras.yml by scripts/gen-api-types.mjs — DO NOT EDIT.
 * Regenerate with: npm run gen:api
 */


export interface paths {
  "/config/ai/kv/inventory": {
    /**
     * Dump the KV-cache block inventory for an endpoint
     * @description Read-only management endpoint returning the gateway's tracked 64-bit KV hash set for a registered service/endpoint inventory. Viewers may read it in role-based authentication modes. An existing load-balancer endpoint need not have a KV inventory: registration depends on KV mode and subscriber targets (prefill endpoints in mode 1; selected endpoints in single-role mode). block_idx is a synthetic sequence index from map iteration order, not a semantic block position or stable ordering. Blocks are copied under the inventory lock, but algorithm and admission are read separately. No freshness, generation, engine parity, or dataplane-readiness attestation is provided. Tokens and parent hashes are not stored or returned by this inventory.
     */
    get: {
      parameters: {
        query: {
          /** @description Required decimal uint32 identifier, accepting 0 through 4294967295. Derived from the internal load-balancer rule number and used by the KV subscriber registry; not the opaque load-balancer ID. Missing, empty, nonnumeric, or out-of-range values fail parsing. */
          service_id: number;
          /** @description Required endpoint index in the service's KV inventory registry. Parsed as a signed native Go int; missing, empty, nonnumeric, or overflowing values return 400. A parseable index without a registered inventory returns 404. The handler has no explicit nonnegative check; stricter bounds require an implementation decision. */
          ep_idx: number;
        };
      };
      responses: {
        /** @description Tracked inventory. service_id, ep_idx, hash_algo, blocks, and total are always emitted; admission is optional. An empty registered inventory returns blocks=[] and total=0. */
        200: {
          content: {
            "application/json": {
              /** @description Echoed uint32 service identifier. */
              service_id?: number;
              /** @description Echoed endpoint inventory index. */
              ep_idx?: number;
              /** @description Algorithm recorded for the service. When the stored value is empty, the provider substitutes sha256_cbor; that fallback is not an observed engine assertion. */
              hash_algo?: string;
              /** @description TRT-LLM server-info admission verdict for this endpoint. Omitted when no verdict exists, including ZMQ engines or a gate awaiting its first answer. May report admitted, legacy admission assumptions, or a refusal reason; this field alone does not establish KV-exact readiness. */
              admission?: string;
              /** @description Always an array; unique tracked hash keys, without stable ordering. */
              blocks?: {
                  /** @description Synthetic index from 0 through total-1; not stable across reads. */
                  block_idx?: number;
                  /**
                   * Format: uint64
                   * @description Unsigned 64-bit block hash key; preserve exact integer precision.
                   */
                  hash_uint64?: number;
                }[];
              /** @description Nonnegative length of the returned blocks array. */
              total?: number;
            };
          };
        };
        /** @description Missing, empty, or unparseable service_id or ep_idx. Provider availability is checked before query parsing and can instead yield 503. */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description No registered KV service or endpoint inventory exists for the pair; this does not establish that the load-balancer resource is absent. */
        404: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Unsupported method after authentication; plain-text body. GET only; OPTIONS is handled globally. */
        405: {
          content: never;
        };
        /** @description KV inventory provider not registered (SimpleError), or management credential store unavailable before dispatch (ManagementError). Schema limitation: the reference below covers only the provider error. */
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
     * @description Returns DPU offload status, aggregate counters, per-pipe counters, and optionally per-entry detail. A nonempty pipe, svc, ep, or limit selects filtered detail mode; empty values do not. Filtered mode takes precedence over flows=1 and skips bulk flow/FDB/route/ACL enumeration. Otherwise, flows=1 opts in to expensive bulk enumeration and omitting it returns aggregate counters. To retain aggregate or bulk mode, omit all four filter parameters, including limit: serializing its default 200 changes the mode. Current filtering is incomplete: service/endpoint identities and hardware-pipe direction are not reliably selected (see parameters). Filtered queries use only the first BF2 plugin and may omit failed hardware queries, with no completeness, truncation, or warning-header signal. Empty detail is omitted from JSON; it does not prove no hardware entries exist. No-provider aggregate mode returns disabled state with empty collections; filtered mode returns 503 instead.
     */
    get: {
      parameters: {
        query?: {
          /** @description Exactly 1 enables bulk hardware enumeration only when pipe, svc, ep, and limit are all absent or empty. Other values are ignored by the raw handler. Filtered mode ignores flows even when it equals 1. */
          flows?: "1";
          /** @description Nonempty values must be in the declared allowlist or return 400. Implementation limitation: both ct_fwd_5tuple and ct_rev_5tuple match the same logical ct entries, without direction filtering. Other values are compared to logical entry keys, and separate FDB/ACL maps are not enumerated. This is not reliable hardware-pipe selection; complete pipe coverage requires implementation work. */
          pipe?: "rss" | "to_kernel" | "egress_dispatch" | "ct_fwd_5tuple" | "ct_rev_5tuple" | "root_l3l4_dispatch" | "fdb_l2" | "deny" | "allow";
          /** @description Intended service-name filter. Implementation limitation: currently a case-sensitive substring search of the raw CT key, with no service identity lookup. Do not use this as a reliable service selector. No additional string validation is performed; empty means no filter. */
          svc?: string;
          /** @description Intended endpoint filter in addr:port form. A nonempty value must contain a final colon followed by a parseable port from 1 through 65535. The address portion is not validated. Implementation limitation: matching is a substring search of the raw concatenated CT key, which lacks the normal IPv4 addr:port separator. Endpoint identity filtering is not reliably implemented; empty means no filter. */
          ep?: string;
          /** @description Effective filtered-query limit. Omitted, empty, nonpositive, or unparseable values use 200; positive parseable values above 2000 are clamped to 2000. Any nonempty value selects filtered mode, even 0 or malformed text. Do not serialize this default in aggregate or bulk mode. Selection stops before hardware reads, so skipped query failures can return fewer rows without backfilling. No stable order, pagination cursor, total-match count, or truncation flag is provided. */
          limit?: number;
        };
      };
      responses: {
        /** @description DPU debug state and any successfully collected detail. A 200 does not establish hardware availability or complete results. Unsupported or disabled BF2 detail collection can produce no detail; provider query errors are logged and do not produce a warning header or non-200 response on this path. */
        200: {
          content: {
            "application/json": components["schemas"]["DpuDebugResponse"];
          };
        };
        /** @description Invalid nonempty pipe or endpoint port syntax/range; malformed limit values use the default instead. */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description DPU manager not initialized on the filtered path (SimpleError), or management credential store unavailable (ManagementError). Schema limitation: the reference below covers only the manager error. */
        503: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
      };
    };
    /**
     * Trigger a DPU debug action
     * @description Dispatches unregister or cb_force. For unregister, require a nonempty plugin name and omit mode; exact name matching is used. For cb_force, require mode=open or mode=close and omit plugin. Irrelevant fields are ignored. open forces supported plugin breakers open; close clears the forced-open override, resets failures, and restores normal automatic operation, which can reopen the breaker. The action applies to every CB-capable plugin and is a successful no-op when none is registered. Outcome limitations: an unknown unregister name is also a successful no-op; shutdown errors are logged while the plugin is removed. Multi-plugin breaker changes are not atomic: a later error can follow earlier changes. Successful dispatch does not guarantee successful hardware shutdown.
     */
    post: {
      /** @description Debug action object. action is required; plugin is conditionally required for unregister, mode for cb_force. A null or empty object fails action validation. Manager availability is checked before JSON decoding, so an unavailable manager yields 503 even for invalid input. */
      requestBody: {
        content: {
          "application/json": {
            /**
             * @description Selects the plugin field for unregister or the mode field for cb_force.
             * @enum {string}
             */
            action: "unregister" | "cb_force";
            /** @description Nonempty exact plugin name required for unregister; ignored for cb_force. No whitespace trimming is performed. */
            plugin?: string;
            /**
             * @description Required for cb_force; open forces open, close clears the override and resumes automatic operation. Ignored for unregister.
             * @enum {string}
             */
            mode?: "open" | "close";
          };
        };
      };
      responses: {
        /** @description Action dispatched; see operation limitations for no-op and shutdown outcomes. */
        200: {
          content: {
            "application/json": {
              /** @description Always emitted as ok on this success response. */
              status?: string;
              /** @description Present only for cb_force. True when any registered CB-capable plugin reports open; may be false after mode=open if no plugin supports breaker control. This is observed state, not an echo. */
              circuit_breaker_open?: boolean;
            };
          };
        };
        /** @description Invalid JSON, unsupported action, missing conditional field, invalid mode, or provider-reported breaker error. Provider errors may follow earlier plugin changes; 400 does not universally imply no mutation. */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Unsupported method after authentication; plain-text body. GET and POST are accepted; OPTIONS is handled globally. */
        405: {
          content: never;
        };
        /** @description DPU manager not initialized (SimpleError), or management credential store unavailable (ManagementError). Schema limitation: the reference below covers only the manager error. */
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
     * @description Returns successfully collected hardware packet and byte counters from registered flow-stat providers. Failed hardware queries are skipped; total_flows counts returned entry rows, potentially including both directions of one connection, not unique connections or all installed flows. No DPU provider returns flows=[] and total_flows=0; the same empty result can also mean no supported rows or failed queries. Implementation limitation: the parser expects protocol|src:port->dst:port, but current BF2 CT keys use concatenated fields without those separators. BF2 rows therefore report protocol=unknown and empty src_ip/dst_ip. Parsed identity is not a supported guarantee until this mismatch is fixed. Raw flow_id and counter values remain available; direction metadata is not exposed.
     */
    get: {
      responses: {
        /** @description Successfully collected entry rows. flows and total_flows and all six row properties are always emitted. */
        200: {
          content: {
            "application/json": {
              /** @description Always an array, including when empty; not a complete inventory guarantee. */
              flows?: {
                  /** @description Raw provider flow key; current BF2 keys concatenate CT fields without a stable display format. */
                  flow_id?: string;
                  /** @description Parsed protocol, or unknown when no separator is found; current BF2 CT keys take the unknown path. */
                  protocol?: string;
                  /** @description Parsed source address text; currently empty for BF2 CT keys because of the parser mismatch. */
                  src_ip?: string;
                  /** @description Parsed destination address text; currently empty for BF2 CT keys because of the parser mismatch. */
                  dst_ip?: string;
                  /**
                   * Format: uint64
                   * @description Unsigned 64-bit hardware packet count for this returned entry.
                   */
                  packets?: number;
                  /**
                   * Format: uint64
                   * @description Unsigned 64-bit hardware byte count for this returned entry.
                   */
                  bytes?: number;
                }[];
              /** @description Nonnegative length of flows; counts entry rows, not unique connections or skipped queries. */
              total_flows?: number;
            };
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Unsupported method after authentication; plain-text body. GET only; OPTIONS is handled globally. */
        405: {
          content: never;
        };
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
      };
    };
  };
  "/config/opa/watcher": {
    /**
     * Get OPA policy watcher status
     * @description Returns the configuration and runtime status of the OPA L4 policy watcher. When no watcher is configured, status is "not_configured". All properties except last_sync_at and last_error are always emitted. With no watcher, configuration strings are empty, numeric fields are 0, and fail_open is false. running means polling was started, not that policy fetch or firewall application succeeded. rules_count is the local cache size, potentially loaded from disk, not live firewall readback. Current last_sync_at includes partial apply failures; inspect last_error and do not treat a recent timestamp as successful enforcement or durability.
     */
    get: {
      responses: {
        /** @description Watcher status */
        200: {
          content: {
            "application/json": {
              /** @description Configured OPA base URL, or an empty string when not configured. */
              opa_url?: string;
              /** @description Configured policy path before fetcher leading-slash normalization; empty when not configured. */
              policy_path?: string;
              /** @description Effective configured poll interval in seconds; 0 when not configured. */
              poll_interval_sec?: number;
              /** @description Stored setting only; distinct fail-open behavior is not implemented. False when no watcher is configured. */
              fail_open?: boolean;
              /**
               * @description Watcher lifecycle state; running is not a successful-sync or readiness verdict.
               * @enum {string}
               */
              status?: "not_configured" | "running" | "stopped";
              /** @description RFC 3339 timestamp of the latest cycle reaching the end of the apply stage. Implementation limitation: updated even after partial apply failures; it is not a last-success timestamp or durable-state acknowledgment. Omitted until such a cycle occurs. */
              last_sync_at?: string;
              /** @description Number of rules in the local watcher cache, including loaded persisted state; not live firewall readback. */
              rules_count?: number;
              /** @description Policy-fetch circuit-breaker state: 0=closed, 1=open, 2=half-open. Zero also appears when no watcher is configured. */
              circuit_breaker_state?: number;
              /** @description Latest recorded synchronization error; omitted when empty. Cache-save failures are logged separately and are not represented here. */
              last_error?: string;
            };
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
      };
    };
    /**
     * Configure and start the OPA policy watcher
     * @description Creates or replaces the singleton OPA L4 policy watcher and starts background polling. This is full configuration replacement: omitted optional fields use defaults rather than retaining previous values. The first poll begins after the default 10-second initial delay; a 200 does not confirm OPA connectivity or firewall application. The previous watcher is canceled without waiting for its goroutine to exit, so atomic replacement and complete quiescence are not guaranteed. Security limitation: admission checks only five IPv4 ranges (169.254.0.0/16, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16). IPv6 private/reserved ranges and other reserved ranges are not covered; HTTP(S)-only validation, DNS-failure rejection, guarded redirects, and DNS-rebinding protection are not implemented. This is not comprehensive SSRF protection. Functional limitations: fail_open is stored but has no effect on failure handling. The rule applier targets http://localhost:11111 without a management credential; authenticated management deployments cannot rely on successful rule application with this wiring. This request exposes no applier URL, TLS, or credential configuration. These limitations require implementation or policy changes, not new claims of support.
     */
    post: {
      /** @description Full replacement configuration. opa_url must be nonempty. Empty or omitted policy_path uses loxilb/l4; nonpositive or omitted poll interval uses 30; omitted fail_open becomes false. Null fields decode to the corresponding zero values. Unknown fields are ignored by the raw decoder, so they cannot configure additional watcher capabilities. */
      requestBody: {
        content: {
          "application/json": {
            /** @description Required nonempty OPA base URL. Must parse and contain a hostname; currently checked against only the operation's limited IPv4 blocklist. DNS lookup failure is not an admission rejection, and successful admission does not establish reachability or comprehensive SSRF safety. Scheme restrictions require a fix. */
            opa_url: string;
            /**
             * @description OPA data policy path. Omitted, null, or empty values use loxilb/l4. The fetcher removes leading slashes and appends the path after /v1/data/ on the base URL with trailing slashes removed. No policy-existence check is made before accepting configuration.
             *
             * @default loxilb/l4
             */
            policy_path?: string;
            /**
             * @description Poll interval in seconds. Omitted, null, zero, or negative values use 30. Positive values have no explicit upper-bound validation before conversion to time.Duration; sufficiently large values can overflow and cause a background ticker failure. Safe product bounds and overflow rejection require implementation changes. The initial delay before the first poll is separately fixed at the watcher default of 10 seconds for this API.
             *
             * @default 30
             */
            poll_interval_sec?: number;
            /** @description Intended fail-open setting; currently ineffective. The watcher stores and reports the value but does not implement distinct failure behavior. Fetch failures preserve existing applied state regardless of this flag. Omitted or null becomes false, which does not imply a deny-all fallback. Do not present this field as an effective traffic safety control until implemented. */
            fail_open?: boolean;
          };
        };
      };
      responses: {
        /** @description Configuration accepted and background polling started; no successful fetch, application, or durability acknowledgment. */
        200: {
          content: {
            "application/json": {
              /** @description Always emitted as Success on this configuration acknowledgment. */
              result?: string;
            };
          };
        };
        /** @description Invalid JSON or field type, empty/missing opa_url, URL parse/hostname failure, or an address rejected by the limited IPv4 blocklist. This is not a complete URL-safety or connectivity validation result. */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Unsupported method after authentication; plain-text body. GET, POST, and DELETE are accepted; OPTIONS is handled globally. */
        405: {
          content: never;
        };
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
      };
    };
    /**
     * Stop and remove the OPA policy watcher
     * @description Cancels polling and removes the in-memory watcher configuration. Previously applied firewall rules and the persisted rule cache are retained. Succeeds when no watcher is configured. Stop cancels the context without joining the goroutine; the response is not proof that all in-flight work has finished.
     */
    delete: {
      responses: {
        /** @description Watcher cancellation requested and in-memory configuration removed, or no watcher existed; not a firewall cleanup acknowledgment. */
        200: {
          content: {
            "application/json": {
              /** @description Always emitted as Success, including when no watcher existed. */
              result?: string;
            };
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Management credential store unavailable */
        503: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
      };
    };
  };
  "/config/ai/apikey/{key_id}": {
    /**
     * Update an AI gateway API key
     * @description Updates the allowed model list and/or the enabled flag of an existing API key. Only the PATCH method on this path is handled by the middleware; the other API key operations are part of the generated specification. Omitted or null fields remain unchanged; an explicit empty allowed_models array removes the model restriction and allows all models subject to other controls. An empty object or top-level null currently performs no field update but still looks up the key and invalidates cached views on success. Implementation limitations: allowed_models and enabled use separate SQL statements without a transaction. If the second update fails, the first can remain committed and cache invalidation is skipped. A failure does not establish rollback; re-read state before declaring the final outcome. A concurrent deletion after lookup is not checked through affected-row counts. Successful updates evict local cached views synchronously; peer invalidation is best-effort, not cluster-wide acknowledgment. Model strings are stored as comma-separated text without lossless array encoding or item validation (see allowed_models). Direct cross-origin browser PATCH is also limited by the current CORS method list, which omits PATCH. Atomic updates, strict body/model validation, and CORS support require implementation changes; these descriptions do not supply those guarantees.
     */
    patch: {
      parameters: {
        path: {
          /** @description Existing stored key identifier. Empty or whitespace-only values are rejected; other values are used without trimming. The raw prefix dispatcher does not validate a single path segment or identifier grammar. Strict identifier validation requires an implementation decision. */
          key_id: string;
        };
      };
      /** @description Fields to update, with independent presence semantics. Neither field is individually required; the handler also accepts an empty object or top-level null as a no-field update. An absent body fails JSON decoding. Unknown fields are ignored and trailing JSON values are not checked; strict-object and nonempty-patch policies remain unresolved. */
      requestBody: {
        content: {
          "application/json": {
            /** @description Replacement model allowlist. Omitted or null leaves the current restriction unchanged. An empty array clears the restriction and allows all models subject to other gateway controls. Nonempty stored names match exactly and case-sensitively. Implementation limitation: comma joining/splitting does not preserve arbitrary model strings; ["a,b"] becomes two names, and [""] becomes an unrestricted list. Null array items decode to empty strings. No model-existence, nonempty-item, delimiter, uniqueness, or length validation is performed here. Do not infer that these malformed/lossy cases are supported model-name semantics; item validation or lossless storage requires implementation work. */
            allowed_models?: string[];
            /** @description Enable or disable the key. Omitted or null leaves the current state unchanged; false explicitly disables and true enables. Enabling does not remove or extend the key's expiration time. */
            enabled?: boolean;
          };
        };
      };
      responses: {
        /** @description Patch completed with no response body, including a no-field update. Local cache eviction has run; this is not cluster-wide invalidation acknowledgment or a guarantee against concurrent deletion. */
        204: {
          content: never;
        };
        /** @description Empty/whitespace-only key_id, missing/invalid JSON body, or incompatible field type; empty objects and top-level null are currently accepted. */
        400: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Missing or invalid management credential */
        401: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Authenticated principal is not authorized for this operation */
        403: {
          content: {
            "application/json": components["schemas"]["ManagementError"];
          };
        };
        /** @description Key lookup reported not found. The raw handler currently classifies errors by the substring "not found" rather than a typed sentinel. */
        404: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Lookup or update failed outside the recognized store-unavailable cases. A preceding model-list update may already be committed, with cache invalidation skipped. Do not infer rollback from this status. */
        500: {
          content: {
            "application/json": components["schemas"]["SimpleError"];
          };
        };
        /** @description Management credential store unavailable (ManagementError), or API-key store unconfigured/unavailable (SimpleError with error equal to ai_key_store_unconfigured or ai_key_store_unavailable). The reference covers both envelope shapes. Unclassified database statement errors can instead return 500; not every database outage is normalized to 503. */
        503: {
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
    /** @description Permissive schema for two alternative error envelopes. Management authentication/authorization emits code, message, result, and fields; raw JSON failures emit error instead. These are alternative shapes, not five jointly required fields. Does not describe the plain-text 405 body. */
    RawError: {
      /**
       * Format: int32
       * @description HTTP status in the management envelope; absent from SimpleError.
       */
      code?: number;
      /** @description Raw-handler failure message; absent from the management envelope. */
      error?: string;
      /** @description Empty array in the management envelope; absent from SimpleError. */
      fields?: string[];
      /** @description Management failure message, equal to result for these raw routes. */
      message?: string;
      /** @description Same management failure text as message. */
      result?: string;
    };
    /** @description Management authentication/authorization error. The raw helper always emits code, fields, message, and result; fields is an empty array and message equals result. Missing/invalid credentials and non-management principals return 401; insufficient role returns 403; a recognized credential-store outage returns 503. Other authentication errors may still be classified as 401. */
    ManagementError: {
      /**
       * Format: int32
       * @description HTTP response status code, always present in this envelope.
       */
      code?: number;
      /** @description Always emitted as an empty array by the raw management-auth helper. */
      fields?: string[];
      /** @description Always-emitted failure message; identical to result. */
      message?: string;
      /** @description Always-emitted failure message; identical to message. */
      result?: string;
    };
    /** @description Minimal JSON error envelope returned by raw handlers; error is always emitted. Does not cover ManagementError or plain-text method rejection. */
    SimpleError: {
      /** @description Raw-handler error message, always present. */
      error?: string;
    };
    /** @description DPU state, sampled aggregate counters, and optional detail. All top-level properties except flows and doca_entry_details are always emitted. Those two arrays use omission when empty. Maps, plugins, fdb_entries, route_entries, and acl_entries are normalized to non-null collections; no-provider state uses empty collections and zero/false scalars. Counters are sampled separately, not as an atomic snapshot. Every property of a returned entry row is emitted, including the documented placeholders. Unsigned counters require lossless 64-bit JSON-number handling; signed active counts must not be coerced unsigned. */
    DpuDebugResponse: {
      /** @description DPU manager enabled state; not proof of successful offload or hardware readiness. */
      enabled?: boolean;
      /**
       * Format: uint64
       * @description Sampled unsigned 64-bit manager offload-success counter.
       */
      offload_success?: number;
      /**
       * Format: uint64
       * @description Sampled unsigned 64-bit manager offload-failure counter.
       */
      offload_failure?: number;
      /**
       * Format: int64
       * @description Sampled signed 64-bit active count; sampled separately from per-pipe totals and hardware entries.
       */
      offload_active?: number;
      /** @description Unsigned 64-bit success counters by logical family ct, udp_ct, route, fdb, and acl when the manager is registered; empty without a provider. These keys differ from the hardware-pipe query allowlist. */
      offload_success_by_pipe?: {
        [key: string]: number;
      };
      /** @description Unsigned 64-bit failure counters for the same logical families as offload_success_by_pipe; empty without a provider. */
      offload_failure_by_pipe?: {
        [key: string]: number;
      };
      /** @description Signed 64-bit active counts by logical family ct, udp_ct, route, fdb, and acl, plus total as the sum sampled in this map. Empty without a provider. Concurrent updates can make total differ from the separately sampled offload_active scalar; this is not an atomic consistency check. */
      offload_active_by_pipe?: {
        [key: string]: number;
      };
      /** @description Registered plugin names, always an array; empty does not distinguish all initialization or capability failures. */
      plugins?: string[];
      /** @description Successfully collected entry counters, queried only with flows=1 outside filtered mode. Omitted when empty, including when requested but no rows were collected. Failed hardware queries are skipped. Rows can represent both directions; provider direction metadata is not exposed here. */
      flows?: {
          /** @description Raw provider key; current BF2 CT fields are concatenated without a formatted five-tuple representation. */
          flow_key?: string;
          /** @description Logical entry family, such as ct or route for BF2; not the hardware-pipe query enum or a direction label. */
          pipe_key?: string;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware byte count for the returned entry.
           */
          hw_bytes?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware packet count for the returned entry.
           */
          hw_pkts?: number;
        }[];
      /** @description Per-FDB-entry counters queried only with flows=1 outside filtered mode. Always an array; otherwise empty. Failed hardware queries may be skipped, so an empty or short list does not establish the complete hardware state. */
      fdb_entries?: {
          /** @description FDB MAC text with the internal fdb prefix removed by the BF2 collector. */
          mac?: string;
          /** @description Unsigned 16-bit hardware forwarding-port identifier (0 through 65535), not a TCP/UDP port. */
          port?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware byte count for this FDB entry.
           */
          hw_bytes?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware packet count for this FDB entry.
           */
          hw_pkts?: number;
        }[];
      /** @description Tracked routed CT-flow counters, queried only with flows=1 outside filtered mode; always an array and otherwise empty. BF2 can populate these rows, but they are not a separate FIB/LPM inventory. Failed hardware queries are skipped. Destination, next-hop MAC, and port metadata are not populated in the current BF2 implementation. */
      route_entries?: {
          /** @description Destination metadata placeholder; current BF2 rows emit an empty string. */
          dst?: string;
          /** @description Next-hop metadata placeholder; current BF2 rows emit an empty string. */
          next_hop_mac?: string;
          /** @description Unsigned 16-bit forwarding-port field; current BF2 rows emit placeholder 0, not a measured port identity. */
          port?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware byte count for the routed CT entry.
           */
          hw_bytes?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware packet count for the routed CT entry.
           */
          hw_pkts?: number;
        }[];
      /** @description ACL hardware entry counters, queried only with flows=1 outside filtered mode; always an array and otherwise empty. BF2 reads both deny and allow maps and skips failed hardware queries. Rule identity is not populated by the current collector, so these rows cannot identify individual firewall rules through rule_id. */
      acl_entries?: {
          /** @description Unsigned 32-bit rule identifier field (0 through 4294967295); current BF2 rows always emit placeholder 0. */
          rule_id?: number;
          /** @description BF2 reports DROP for deny entries and ALLOW for allow entries. */
          action?: string;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware byte count for the ACL entry.
           */
          hw_bytes?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware packet count for the ACL entry.
           */
          hw_pkts?: number;
        }[];
      /** @description True if any registered CB-capable plugin reports open; false without such a plugin is not a hardware-health verdict. */
      circuit_breaker_open?: boolean;
      /** @description Optional filtered-query rows from the first BF2 plugin. Omitted when empty, including disabled/unsupported collection or skipped failures. Selection order is unspecified and results may be partial. No warning header, completeness flag, truncation flag, or matching-total count is returned; missing detail must not be treated as proof of zero entries. */
      doca_entry_details?: {
          /** @description FNV-1a 64-bit handle hash as 16 hexadecimal characters for log correlation; not a capability token or durable identity. */
          entry_handle_hashed?: string;
          /** @description Raw BF2 CT key; despite the field name, current output concatenates fields without a formatted five-tuple representation. */
          "5_tuple"?: string;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware packet count for this successfully queried entry.
           */
          hw_pkts?: number;
          /**
           * Format: uint64
           * @description Unsigned 64-bit hardware byte count for this successfully queried entry.
           */
          hw_bytes?: number;
          /**
           * Format: uint64
           * @description Reserved age estimate; current BF2 adapter always returns 0 because age is not queried. Treat as unavailable, not measured zero age.
           */
          age_ms?: number;
          /** @description Logical entry key, such as ct or route; not a hardware-pipe identifier or forward/reply direction guarantee. */
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
