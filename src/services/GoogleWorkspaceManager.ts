import { toast } from 'sonner';

export enum GoogleServiceStatus {
    IDLE = 'IDLE',
    AUTHORIZING = 'AUTHORIZING',
    AUTHORIZED = 'AUTHORIZED',
    ERROR = 'ERROR'
}

export class GoogleWorkspaceManager {
    public accessToken: string | null = null;
    public tokenExpiry: number = 0;
    private _isRefreshing: boolean = false;
    private _refreshTimer: any = null;
    private _status: GoogleServiceStatus = GoogleServiceStatus.IDLE;
    private _clientId: string | null = null;
    private _refreshFn: (() => Promise<string | null>) | null = null;

    constructor() {
        const storedToken = localStorage.getItem('google_access_token');
        const storedExpiry = parseInt(localStorage.getItem('google_token_expiry') || '0');
        
        if (storedToken && storedExpiry > Date.now()) {
            this.accessToken = storedToken;
            this.tokenExpiry = storedExpiry;
            this._status = GoogleServiceStatus.AUTHORIZED;
            this.scheduleRefresh();
        } else {
            this.accessToken = null;
            this.tokenExpiry = 0;
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
        }
    }

    setClientId(clientId: string) {
        this._clientId = clientId;
    }

    setRefreshFn(fn: () => Promise<string | null>) {
        this._refreshFn = fn;
    }

    getStatus() {
        return this._status;
    }

    isTokenValid() {
        return !!this.accessToken && this.tokenExpiry > Date.now() + 30000; // 30s buffer
    }

    async ensureValidToken(): Promise<string | null> {
        if (this.isTokenValid()) return this.accessToken;

        if (this._isRefreshing) {
            let attempts = 0;
            while (this._isRefreshing && attempts < 50) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
            if (this.isTokenValid()) return this.accessToken;
        }

        return await this.refreshAccessToken();
    }

    async refreshAccessToken(): Promise<string | null> {
        if (!this._refreshFn) return null;

        if (this._isRefreshing) return null;
        this._isRefreshing = true;

        try {
            const newToken = await this._refreshFn();
            return newToken;
        } catch (e) {
            console.error("[GoogleManager] Refresh failed", e);
            return null;
        } finally {
            this._isRefreshing = false;
        }
    }

    setToken(token: string, expiresInSeconds: number) {
        this.accessToken = token;
        this.tokenExpiry = Date.now() + (expiresInSeconds * 1000);
        this._status = GoogleServiceStatus.AUTHORIZED;
        localStorage.setItem('google_access_token', token);
        localStorage.setItem('google_token_expiry', this.tokenExpiry.toString());
        this.scheduleRefresh();
    }

    logout() {
        this.accessToken = null;
        this.tokenExpiry = 0;
        this._status = GoogleServiceStatus.IDLE;
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        if (this._refreshTimer) clearTimeout(this._refreshTimer);
    }

    private scheduleRefresh() {
        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        
        const timeToExpiry = this.tokenExpiry - Date.now();
        const refreshThreshold = 10 * 60 * 1000; // 10 minutes before
        const waitTime = Math.max(0, timeToExpiry - refreshThreshold);

        if (waitTime > 0 && waitTime < 24 * 60 * 60 * 1000) {
            this._refreshTimer = setTimeout(() => {
                this.refreshAccessToken();
            }, waitTime);
        }
    }

    async callAPI(url: string | URL | Request, options: RequestInit = {}): Promise<Response> {
        if (window.location.protocol === 'file:') {
            const msg = 'OAuth requires a local server (http/https).';
            throw new Error(msg);
        }

        const token = await this.ensureValidToken();
        if (!token) {
            throw new Error("AUTH_REQUIRED: Authentication required for Google services. Please grant permission in Settings.");
        }

        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        
        const fetchOptions = { ...options, headers };
        let response = await fetch(url, fetchOptions);

        if (response.status === 401) {
            const freshToken = await this.refreshAccessToken();
            if (freshToken) {
                headers.set('Authorization', `Bearer ${freshToken}`);
                response = await fetch(url, { ...options, headers });
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            let errorJson;
            try { errorJson = JSON.parse(errorText); } catch { errorJson = null; }
            
            const errorMessage = errorJson?.error?.message || errorJson?.error || errorText || response.statusText;
            
            if (response.status === 403 && (errorMessage.includes('disabled') || errorMessage.includes('permission'))) {
                const gcpLink = errorMessage.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/[a-z.]+\/overview\?project=\d+/)?.[0];
                const serviceName = url.toString().includes('sheets') ? 'Google Sheets API' : 'Google Drive API';
                
                toast.error(`${serviceName} error`, {
                    description: errorMessage,
                    action: gcpLink ? {
                        label: 'Enable API',
                        onClick: () => window.open(gcpLink, '_blank')
                    } : undefined
                });
            }
            
            throw new Error(errorMessage);
        }

        return response;
    }
}

export const googleManager = new GoogleWorkspaceManager();
