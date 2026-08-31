#!/usr/bin/env bash
#
# Container smoke test: security headers + inline-script hygiene.
#
# Asserts, against a RUNNING loxilb-ui container:
#   1. every HTML/route response carries the exact certified
#      Content-Security-Policy plus the companion security headers
#      (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — including
#      responses from location blocks that declare their own add_header, which
#      in nginx silently drops every inherited header (the /health and /static/
#      trap this test exists to guard);
#   2. the served SPA shell contains no inline <script> — the CSP has no
#      script-src 'unsafe-inline', so an inline runtime chunk (CRA's
#      INLINE_RUNTIME_CHUNK default) would blank every page.
#
# Usage: scripts/container-smoke.sh <base-url>     e.g. http://127.0.0.1:8080
# Exits non-zero on the first grouped failure; prints one PASS/FAIL per check.

set -u

BASE="${1:?usage: container-smoke.sh <base-url>}"
BASE="${BASE%/}"
PUBLIC_PATH="${PUBLIC_PATH:-/netlox}"

# The certified policy — keep byte-identical with nginx-security-headers.conf.
EXPECTED_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"

pass=0 fail=0

report() { # status name detail
    if [ "$1" = 0 ]; then
        echo "PASS: $2"; pass=$((pass + 1))
    else
        echo "FAIL: $2${3:+ — $3}"; fail=$((fail + 1))
    fi
}

header_of() { # url header-name -> value (first occurrence, CR stripped)
    curl -sS -o /dev/null -D - --max-time 10 "$1" \
        | awk -v h="$(echo "$2" | tr '[:upper:]' '[:lower:]')" '
            BEGIN { FS=": " }
            { name = tolower($1) }
            name == h { sub(/^[^:]*: /, ""); sub(/\r$/, ""); print; exit }'
}

check_security_headers() { # url label
    local url="$1" label="$2" csp xfo xcto rp
    csp=$(header_of "$url" Content-Security-Policy)
    [ "$csp" = "$EXPECTED_CSP" ]
    report $? "CSP exact match on ${label}" "got: ${csp:-<missing>}"
    xfo=$(header_of "$url" X-Frame-Options)
    [ "$xfo" = "SAMEORIGIN" ]
    report $? "X-Frame-Options on ${label}" "got: ${xfo:-<missing>}"
    xcto=$(header_of "$url" X-Content-Type-Options)
    [ "$xcto" = "nosniff" ]
    report $? "X-Content-Type-Options on ${label}" "got: ${xcto:-<missing>}"
    rp=$(header_of "$url" Referrer-Policy)
    [ "$rp" = "strict-origin-when-cross-origin" ]
    report $? "Referrer-Policy on ${label}" "got: ${rp:-<missing>}"
}

echo "== container-smoke against ${BASE} (PUBLIC_PATH=${PUBLIC_PATH}) =="

# Wait for the container to accept connections.
for _ in $(seq 1 30); do
    curl -sf -o /dev/null --max-time 2 "${BASE}/health" && break
    sleep 1
done
curl -sf -o /dev/null --max-time 2 "${BASE}/health"
report $? "container is serving /health"

# 1. Routes that must carry the full security-header set.
check_security_headers "${BASE}${PUBLIC_PATH}/" "SPA shell ${PUBLIC_PATH}/"
check_security_headers "${BASE}${PUBLIC_PATH}/dashboard" "client route ${PUBLIC_PATH}/dashboard"
check_security_headers "${BASE}/" "root redirect /"
check_security_headers "${BASE}/health" "/health (own add_header block)"
check_security_headers "${BASE}/no-such-file-$$.txt" "SPA fallback for unknown path"

# A real content-hashed asset: pull its path out of the served shell.
ASSET=$(curl -sS --max-time 10 "${BASE}${PUBLIC_PATH}/" \
    | grep -oE '/static/js/[A-Za-z0-9._-]+\.js' | head -1)
if [ -n "${ASSET}" ]; then
    check_security_headers "${BASE}${ASSET}" "hashed asset ${ASSET} (own add_header block)"
else
    report 1 "hashed asset discovered in SPA shell" "no /static/js/*.js reference found"
fi

# Missing hashed assets must 404 (never the SPA shell) and still carry headers.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${BASE}/static/js/definitely-missing.js")
[ "$code" = 404 ]
report $? "missing hashed asset returns 404" "got HTTP ${code}"

# 2. No inline <script> in the served shell (script-src 'self' would block it).
#    Every <script> opening tag must carry src= — a srcless tag is inline code.
SHELL_HTML=$(curl -sS --max-time 10 "${BASE}${PUBLIC_PATH}/")
INLINE=$(printf '%s' "$SHELL_HTML" | grep -oE '<script[^>]*>' | grep -cv 'src=' || true)
[ "${INLINE:-0}" = 0 ]
report $? "SPA shell has no inline <script>" "${INLINE} srcless <script> tag(s)"

echo "== result: ${pass} passed, ${fail} failed =="
[ "$fail" = 0 ]
