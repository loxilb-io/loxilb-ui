# Snapshot actions and read state

Snapshot actions remain disabled until the snapshot list has a trusted successful read. A failed refresh disables actions even when the page still shows cached rows. Retry the read to restore the controls. Schedule additionally requires a successful read of its own configuration.

An already open creation, upload, schedule or deletion confirmation rechecks the current read state before submission. Deletion still requires the exact nonempty snapshot name; pinned snapshots must be unpinned first.

Recovery scope inspects the stored document and follows the same read-state guard. It does not verify external stores or prove that separate database and certificate backups exist.
