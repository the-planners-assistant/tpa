import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * ConstraintMap
 * Props:
 *  - site: { latitude, longitude, geometry? (GeoJSON) }
 *  - constraints: [{ id, name, geometry, severity, category, type }]
 */
export function ConstraintMap({ site, constraints = [], onSelectLocation, tileStyleUrl }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const center = site?.coordinates || { latitude: 52.5, longitude: -1.5 };
    const styleUrl = tileStyleUrl || 'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap.json';
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [center.longitude, center.latitude],
      zoom: 9
    });

    mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right');
    let fallbackAdded = false;

    function addFallbackRaster(){
      const map = mapRef.current;
      if (!map || fallbackAdded) return;
      fallbackAdded = true;
      try {
        if (!map.getSource('osm-raster')) {
          map.addSource('osm-raster', {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          });
          map.addLayer({ id: 'osm-raster-layer', type: 'raster', source: 'osm-raster' }, map.getStyle()?.layers?.[0]?.id);
        }
      } catch (e) {
        // ignore
      }
    }

    mapRef.current.on('load', () => {
      // If style has no sources/layers, inject fallback
      const st = mapRef.current.getStyle();
      if (!st?.sources || Object.keys(st.sources).length === 0 || !st.layers || st.layers.length === 0) {
        addFallbackRaster();
      }
    });
    mapRef.current.on('error', (e) => {
      // Network errors in fetching style or tiles -> fallback
      if (!fallbackAdded) addFallbackRaster();
    });
    // Basic click handler for spatial search selection
    mapRef.current.on('click', e => {
      if (typeof onSelectLocation === 'function') {
        onSelectLocation({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      }
    });
  }, [site]);

  // Add/update sources & layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      const onLoad = () => addData();
      map.on('load', onLoad);
      return () => map.off('load', onLoad);
    }
    addData();

    function addData(){
      // Site geometry
      if (site?.geometry) {
        const siteId = 'site-geom';
        if (map.getSource(siteId)) map.removeLayer(siteId+'-fill');
        if (map.getSource(siteId)) map.removeSource(siteId);
        map.addSource(siteId, { type: 'geojson', data: site.geometry });
        map.addLayer({ id: siteId+'-fill', type: 'fill', source: siteId, paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.25 } });
      } else if (site?.coordinates) {
        const markerEl = document.createElement('div');
        markerEl.className = 'tpa-site-marker';
        markerEl.style.cssText = 'width:10px;height:10px;border:2px solid #2563eb;border-radius:50%;background:#fff;';
        new maplibregl.Marker({ element: markerEl }).setLngLat([site.coordinates.longitude, site.coordinates.latitude]).addTo(map);
      }

      // Constraints collection - ensure constraints is an array
      const featCollection = { type: 'FeatureCollection', features: [] };
      const constraintsArray = Array.isArray(constraints) ? constraints : [];
      constraintsArray.forEach(c => {
        if (!c.geometry) return;
        const feature = { type: 'Feature', geometry: c.geometry, properties: { id: c.id, name: c.name, severity: c.severity, type: c.type } };
        featCollection.features.push(feature);
      });
      const srcId = 'constraints';
      if (map.getSource(srcId)) {
        map.getSource(srcId).setData(featCollection);
      } else {
        map.addSource(srcId, { type: 'geojson', data: featCollection });
        map.addLayer({ id: srcId+'-poly', type: 'fill', source: srcId, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': ['match', ['get','severity'], 'critical', '#dc2626', 'high', '#ea580c', 'medium', '#d97706', 'low', '#16a34a', '#6b7280'], 'fill-opacity': 0.35 } });
        map.addLayer({ id: srcId+'-line', type: 'line', source: srcId, paint: { 'line-color': ['match', ['get','severity'], 'critical', '#b91c1c', 'high', '#c2410c', 'medium', '#b45309', 'low', '#15803d', '#374151'], 'line-width': 1.2 } });
        map.addLayer({ id: srcId+'-point', type: 'circle', source: srcId, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': ['match', ['get','severity'], 'critical', '#dc2626', 'high', '#ea580c', 'medium', '#d97706', 'low', '#16a34a', '#6b7280'], 'circle-radius': 4, 'circle-stroke-width':1, 'circle-stroke-color':'#fff' } });

        map.on('click', srcId+'-poly', e => showPopup(e));
        map.on('click', srcId+'-line', e => showPopup(e));
        map.on('click', srcId+'-point', e => showPopup(e));
      }

      // Fit bounds if we have features
      if (featCollection.features.length) {
        const bbox = turf.bbox(featCollection);
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 30, maxZoom: 14 });
      }
    }

    function showPopup(e){
      const feature = e.features?.[0];
      if (!feature) return;
      new maplibregl.Popup({ closeButton: true })
        .setLngLat(e.lngLat)
        .setHTML(`<div class='text-xs'><strong>${feature.properties.name}</strong><br/><em>${feature.properties.type}</em><br/>Severity: ${feature.properties.severity}</div>`)
        .addTo(map);
    }
  }, [constraints, site]);

  return <div ref={containerRef} className="w-full h-full" />;
}

export default ConstraintMap;
