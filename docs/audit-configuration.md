# Audit configuration and readback

Open an AI Gateway instance and choose **Maintenance → Audit Trail**.
Administrators can change the audit policy and collectors; operators can read
these settings. Use **Refresh** to read the selected instance's policy,
compliance collector, named collectors, and audit status again. The page does
not poll configuration while a form is being edited.

A successful write is followed by a configuration read. The result distinguishes
matching settings, different settings, an unreadable readback, and a change with
no response. Keep the submitted values and check the current state before
repeating a change whose outcome is unknown.

An explicit JSON object `{}` can mean no compliance collector or no running
writer, according to the endpoint. A null, missing, scalar, array, or no-content
configuration response is an unreadable result. It must not be presented as an
empty configuration or used to confirm that a collector was stopped. A named
collector's individual GET returning 404 is the absence check after deletion.

The policy sends all six values together. Segment limits, retention limits,
free-space reserve, and pruning batch size have different meanings; read each
field's help before changing it. The policy is held in memory and must be read
and reapplied after a restart. CA and optional client certificate/key paths
refer to files readable in the Gateway's runtime filesystem.

Collector configuration readback and TLS connection state do not establish
collector storage. Compare new source records with the receiver's stored records
and check framing and parsing errors before accepting delivery. The current
producer contracts provide no dedicated collector connection-test operation;
configuration saving is not a connection test.
