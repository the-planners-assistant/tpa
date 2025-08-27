export default class PlanItAPI {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://www.planit.org.uk';
    this.cache = new Map();
    this.ttl = options.ttl || 6 * 60 * 60 * 1000; // 6 hours
  }

  _key(path, params) { return path + ':' + JSON.stringify(params || {}); }

  async _fetch(path, params = {}, { force = false } = {}) {
    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([k, v]) => (v !== undefined && v !== null && v !== '') && url.searchParams.append(k, v));
    const k = this._key(path, params);
    const now = Date.now();
    if (!force && this.cache.has(k)) {
      const e = this.cache.get(k); if (now - e.t < this.ttl) return e.d;
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`PlanIt request failed ${res.status}`);
    const data = await res.json();
    this.cache.set(k, { d: data, t: now });
    return data;
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
    return this._fetch(`/planapplic/${encodeURIComponent(applicName)}/json`);
  }

  /** Get full application details by anyid@planarea pattern */
  async getApplicationByComposite(anyid, planarea) {
    return this._fetch(`/planapplic/${encodeURIComponent(anyid)}@${encodeURIComponent(planarea)}/json`);
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
}
