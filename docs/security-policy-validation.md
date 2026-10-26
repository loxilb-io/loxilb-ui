# Security policy validation

IP Filter preserves explicit priority 0 and validates CIDR, priority and the supported zone before submitting. Firewall validates numeric ranges and SNAT combinations, keeps preference in each rule identity, and treats counters as read-only.

A successful write response means the request was accepted. IP-filter and firewall creation/deletion, and Security Rate updates, use bounded readback before displaying a confirmed result. A failed or malformed read cannot prove the change took effect; refresh and check the policy and traffic separately.

Security Rate offers aggregate budgets only when instance metadata declares all four fields. Zero disables an aggregate budget. Disable turns off per-source and aggregate protection and clears the whitelist without clearing statistics. Editing an existing configuration preserves omitted false/zero values.

Required API-key authentication can use valid cached keys during a policy-store outage until the cache entry expires. Validation that needs the unavailable store fails closed with 503.
