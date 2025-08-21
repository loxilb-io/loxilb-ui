//---------------------------------------------------------
// API Proxy Utilities
//---------------------------------------------------------

/**
 * Converts a direct API URL to use the nginx proxy to avoid CORS issues
 * @param url - The original API URL (e.g., "http://instance-server:8080/api/endpoint")
 * @param instanceId - The instance ID for OAM proxy routing (optional)
 * @returns The proxied URL (e.g., "/api/oam/loxilbs/123/netlox/v1/endpoint")
 */
export function getProxiedUrl(url: string, instanceId?: string | number): string {
    // If the URL is already relative (starts with /), return as-is
    if (url.startsWith('/')) {
        return url;
    }
    
    // In development mode, return the original URL (let the dev server handle CORS)
    if (process.env.NODE_ENV === 'development') {
        return url;
    }
    
    // In production (Docker), use the OAM proxy to avoid CORS issues
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // If instanceId is provided, use the new OAM proxy pattern
        if (instanceId) {
            // Extract the path from the original URL (everything after /netlox/v1/)
            const netloxMatch = url.match(/.*\/netlox\/v1\/(.*)$/);
            if (netloxMatch) {
                const endpoint = netloxMatch[1];
                return `/api/oam/loxilbs/${instanceId}/netlox/v1/${endpoint}`;
            }
            // Fallback: if it doesn't match netlox pattern, use the old proxy method
            return `/api/proxy/${url}`;
        }
        // Legacy: use the old proxy method for backward compatibility
        return `/api/proxy/${url}`;
    }
    
    // If it's a relative URL without leading slash, add one
    return `/${url}`;
}

/**
 * Checks if we're running in production (Docker) environment
 * @returns true if in production, false if in development
 */
export function isProduction(): boolean {
    return process.env.REACT_APP_ENV === 'production' || process.env.NODE_ENV === 'production';
}

/**
 * Gets the appropriate API base URL based on environment
 * @returns The API base URL
 */
export function getApiBaseUrl(): string {
    return process.env.REACT_APP_API_URL || '/api/oam';
}
