const TOKEN_KEYS = ['zincro_admin_token', 'zincro_provider_token', 'zincro_sa_token'];

export function getAuthHeaders(): Record<string, string> {
    for (const key of TOKEN_KEYS) {
        const token = localStorage.getItem(key);
        if (token) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    }
    return { 'Content-Type': 'application/json' };
}
