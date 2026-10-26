# Listener limits and KV confirmation

For full-proxy listeners, Advanced Settings exposes Concurrent Connection Limit and Header Deadline only when instance metadata declares the corresponding fields. Both accept integers from 0 through 4294967295, or a blank value. Invalid input blocks submission.

A blank or zero connection limit means unlimited TCP connections. HTTP/2 streams share a connection. A blank or zero header deadline uses the Gateway default of 10000 milliseconds for accumulating L7 headers. The details panel shows reported values; configuration readback does not prove runtime enforcement.

New exact-KV rules and changes to their KV contract require confirmation that the block/page size matches the live engine. Unrelated edits to an existing rule do not require a new confirmation. This confirmation does not test engine residency or cache reuse.
