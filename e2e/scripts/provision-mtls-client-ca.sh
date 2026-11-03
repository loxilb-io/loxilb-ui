#!/usr/bin/env bash
#---------------------------------------------------------
# Provision the client CA the frontend-mTLS E2E specs point at.
#
#   e2e/scripts/provision-mtls-client-ca.sh <gateway-container>
#
# cicd/httpsproxy-mtls and cicd/e2ehttpsproxy-mtls create a fullproxy rule
# with client_cert_mode=required and client_ca_path set to
# E2E_MTLS_CLIENT_CA_PATH (default /opt/loxilb/cert/client_ca.crt). The
# gateway loads that bundle when the rule is applied. On a bed where the
# file does not exist the data plane logs "Failed to load client CA bundle"
# and the create is refused with 412.
#
# The script generates a throwaway self-signed CA and copies only its
# certificate into the gateway container. The private key is never written
# outside a temporary directory and is deleted on exit; no client is ever
# issued from it, because the specs check configuration, not a handshake.
# Running it again replaces the bundle, so it is safe to repeat.
#---------------------------------------------------------
set -euo pipefail

container="${1:?usage: $0 <gateway-container>}"
target="${E2E_MTLS_CLIENT_CA_PATH:-/opt/loxilb/cert/client_ca.crt}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 30 \
	-subj "/CN=loxilb-ui e2e client CA" \
	-addext "basicConstraints=critical,CA:TRUE" \
	-addext "keyUsage=critical,keyCertSign,cRLSign" \
	-keyout "$work/ca.key" -out "$work/ca.crt" 2>/dev/null

dir="$(dirname "$target")"
# A deployment usually mounts the certificate directory read-only (the
# compose stack mounts a named volume at /opt/loxilb/cert). Write through the
# volume behind that mount then, using the container's own image, so the
# gateway sees the file without a restart. Otherwise copy into the container.
volume="$(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "'"$dir"'"}}{{if eq .Type "volume"}}{{.Name}}{{end}}{{end}}{{end}}')"
if [ -n "$volume" ]; then
	image="$(docker inspect "$container" --format '{{.Config.Image}}')"
	docker run --rm -i --entrypoint sh -v "$volume:/target" "$image" \
		-c "cat > '/target/$(basename "$target")' && chmod 0644 '/target/$(basename "$target")'" < "$work/ca.crt"
else
	docker exec "$container" mkdir -p "$dir"
	docker cp "$work/ca.crt" "$container:$target"
	docker exec "$container" chmod 0644 "$target"
fi
docker exec "$container" sh -c "openssl x509 -in '$target' -noout -subject -enddate"
echo "client CA provisioned at $container:$target"
