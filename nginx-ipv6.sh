# Sourced by the entrypoint. IPv6 is optional on Linux kernels without AF_INET6.
configure_ipv6_listeners() {
    IPV6_HTTP_LISTEN=""
    IPV6_HTTPS_LISTEN=""
    if [ -s "${1:-/proc/net/if_inet6}" ]; then
        IPV6_HTTP_LISTEN="listen [::]:${HTTP_PORT};"
        IPV6_HTTPS_LISTEN="listen [::]:${HTTPS_PORT} ssl;"
    fi
    export IPV6_HTTP_LISTEN IPV6_HTTPS_LISTEN
}
