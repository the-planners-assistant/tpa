import PlanItAPI from './planit-api.js';
import { getDatabase } from './database.js';

/**
 * LocalAuthorityManager
 * Handles discovery & caching of local authority metadata and (future) local plan policies.
 */
export default class LocalAuthorityManager {
  constructor(db = getDatabase(), planIt = new PlanItAPI()) {
    this.db = db;
    this.planIt = planIt;
  }

  /**
   * Seed a baseline list of planning authorities if table empty (or force=true).
   * Attempts dynamic discovery via PlanIt /api/areas using area_type=planning.
   * Falls back to a minimal static list if network fails.
   */
  async seedAuthorities({ force = false, max = 100 } = {}) {
    const table = this.db.localAuthorityData;
    if (!table) return 0;
    if (!force) {
      const existing = await table.count();
      if (existing > 0) return 0;
    }
    let discovered = [];
    try {
      const resp = await this.planIt.searchAreas({ area_type: 'planning', pg_sz: Math.min(max, 200) });
      const records = resp?.records || [];
      discovered = records
        .filter(r => (r.is_planning === true) || (r.area_type && r.area_type.toLowerCase().includes('planning')))
        .slice(0, max)
        .map(r => ({
          code: r.area_name,
            name: r.long_name || r.area_name,
          area_type: r.area_type,
          in_region: r.in_region || r.region,
          lastSync: null
        }));
    } catch (e) {
      // swallow, will fallback
    }
    if (!discovered.length) {
      // Minimal fallback list (removed broad static list to reduce maintenance)
      discovered = [
        { code: 'Hackney', name: 'Hackney' },
        { code: 'Manchester', name: 'Manchester' },
        { code: 'Birmingham', name: 'Birmingham' }
      ].map(a => ({ ...a, lastSync: null }));
    }
    await table.bulkPut(discovered);
    return discovered.length;
  }

  /** Sync a single authority metadata & boundary using PlanIt area search */
  async syncAuthority(authorityName) {
    if (!authorityName) return null;
    try {
      const areas = await this.planIt.searchAreas({ auths: authorityName, pg_sz: 5 });
      const record = areas?.records?.find(r => (r.area_name || '').toLowerCase() === authorityName.toLowerCase()) || (areas?.records||[])[0];
      if (!record) return null;
      const areaDetail = await this.planIt.getArea(record.area_name || record.area_id || authorityName);
      const entry = {
        code: areaDetail.area_name || authorityName,
        name: areaDetail.long_name || areaDetail.area_name || authorityName,
        boundaries: areaDetail.borders || areaDetail.boundary || null,
        area_type: areaDetail.area_type,
        in_region: areaDetail.in_region,
        totalApplications: areaDetail.total,
        validDates: areaDetail.valid_dates,
        validLocations: areaDetail.valid_locations,
        mapit_code: areaDetail.mapit_code,
        gss_code: areaDetail.gss_code,
        lastSync: new Date().toISOString()
      };
      await this.db.localAuthorityData.put(entry);
      return entry;
    } catch (e) {
      console.warn('syncAuthority failed', authorityName, e.message);
      return null;
    }
  }

  /** Placeholder: fetch local plan policies (not implemented yet) */
  async fetchLocalPlanPolicies(authorityName) {
    if (!authorityName) return [];
    try {
      const nameLower = authorityName.toLowerCase();
      // Find matching local plan(s) by authorityCode or name fuzzy match
      const plans = await this.db.localPlans?.toArray?.() || [];
      const matchingPlans = plans.filter(p => {
        const code = (p.authorityCode || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        return code === nameLower || name === nameLower ||
          code.includes(nameLower) || name.includes(nameLower) ||
          nameLower.includes(code) || nameLower.includes(name);
      });
      if (!matchingPlans.length) return [];
      const planIds = matchingPlans.map(p => p.id);
      // Fetch policies for all matching plans
      let policies = [];
      for (const pid of planIds) {
        const planPolicies = await this.db.localPlanPolicies.where('planId').equals(pid).toArray();
        policies.push(...planPolicies);
      }
      // Lightweight relevance scoring fields (used later in filtering)
      return policies.map(p => ({
        planId: p.planId,
        id: p.id,
        ref: p.policyRef || p.ref || p.title,
        policyRef: p.policyRef || p.ref || p.title,
        title: p.title,
        category: p.category,
        text: p.content,
        content: p.content,
        requirements: p.requirements || [],
        _source: 'local_plan_db'
      }));
    } catch (e) {
      console.warn('fetchLocalPlanPolicies failed', authorityName, e.message);
      return [];
    }
  }
}
