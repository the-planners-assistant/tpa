export default class PlanItAPI {
  constructor(options = {}) {
  this.baseUrl = options.baseUrl || 'https://www.planit.org.uk';
  this.proxyBase = (typeof window !== 'undefined') ? '/api/planit' : null; // local proxy for browser
    this.cache = new Map();
    this.ttl = options.ttl || 6 * 60 * 60 * 1000; // 6 hours
  }

  _key(path, params) { return path + ':' + JSON.stringify(params || {}); }

  async _fetch(path, params = {}, { force = false } = {}) {
    const directUrl = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([k, v]) => (v !== undefined && v !== null && v !== '') && directUrl.searchParams.append(k, v));
    const k = this._key(path, params);
    const now = Date.now();
    if (!force && this.cache.has(k)) {
      const e = this.cache.get(k); if (now - e.t < this.ttl) return e.d;
    }
    // Try direct first (server or Node), if CORS in browser fallback to proxy
    let lastErr;
    for (const attempt of [ 'direct', 'proxy' ]) {
      if (attempt === 'proxy' && !this.proxyBase) continue;
      try {
        const target = attempt === 'direct' ? directUrl.toString() : `${this.proxyBase}${path}${directUrl.search}`;
        const res = await fetch(target, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.cache.set(k, { d: data, t: now });
        return data;
      } catch (err) {
        lastErr = err;
        if (attempt === 'proxy') break; // give up after proxy
        // on direct failure in browser (likely CORS) continue to proxy
      }
    }
    throw new Error(`PlanIt request failed: ${lastErr?.message}`);
  }

  /**
   * Search planning applications using /api/applics/json endpoint
   * params supports documented keys (auth, search, id_match, lat, lng, krad, bbox, boundary, recent, start_date, etc.)
   */
  async searchApplications(params = {}) {
    const { pg_sz = params.pageSize || 25, page = params.page || 1, ...rest } = params;
    return this._fetch('/api/applics/json', { pg_sz, page, ...rest });
  }

  /** Convenience simple text search */
  async simpleSearch(query, opts = {}) {
    return this.searchApplications({ search: query, pg_sz: opts.pg_sz || opts.pageSize || 25 });
  }

  /** Get full application details by unique application name */
  async getApplicationByName(applicName) {
  const data = await this._fetch(`/planapplic/${encodeURIComponent(applicName)}/json`);
  return this._augmentGeometry(data);
  }

  /** Get full application details by anyid@planarea pattern */
  async getApplicationByComposite(anyid, planarea) {
  const data = await this._fetch(`/planapplic/${encodeURIComponent(anyid)}@${encodeURIComponent(planarea)}/json`);
  return this._augmentGeometry(data);
  }

  /** Search planning areas */
  async searchAreas(params = {}) {
    const { pg_sz = params.pageSize || 10, page = params.page || 1, ...rest } = params;
    return this._fetch('/api/areas/json', { pg_sz, page, ...rest });
  }

  /** Get area details by name or id */
  async getArea(planarea) {
    return this._fetch(`/planarea/${encodeURIComponent(planarea)}/json`);
  }

  /** Nearby applications via circular search */
  async nearbyApplications({ lat, lng, krad = 1, pg_sz = 50 } = {}) {
    if (lat == null || lng == null) throw new Error('lat & lng required');
    return this.searchApplications({ lat, lng, krad, pg_sz });
  }

  /** Internal: attempt to normalise any geometry/footprint fields to GeoJSON */
  _augmentGeometry(data){
    if (!data || typeof data !== 'object') return data;
    // Common possible geometry fields (speculative) - adapt as real structure known
    const geomFields = ['geojson', 'geometry', 'site_geometry', 'footprint'];
    for (const f of geomFields) {
      if (data[f]) {
        try {
          if (typeof data[f] === 'string') {
            const parsed = JSON.parse(data[f]);
            if (parsed && parsed.type && parsed.coordinates) {
              data.normalizedGeometry = { type: parsed.type, coordinates: parsed.coordinates };
              break;
            }
          } else if (data[f].type && data[f].coordinates) {
            data.normalizedGeometry = data[f];
            break;
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
    return data;
  }
}
