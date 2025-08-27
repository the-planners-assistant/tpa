/**
 * ImageRetriever
 * Provides supplementary site imagery using OpenStreetMap (tile reference) and Wikimedia Commons.
 * Designed for static hosting compatibility (GitHub Pages) without proprietary tokens.
 */
export default class ImageRetriever {
  constructor(opts = {}) {
    this.enableCommons = opts.enableCommons !== false;
  }

  async retrieve(coordinates) {
    if (!coordinates) return { images: [], retrievedCount: 0 };
    const [lng, lat] = coordinates; // stored as [lng, lat]
    const images = [];

    // OSM tile (single representative tile)
    const z = 16;
    const xtile = Math.floor((lng + 180) / 360 * Math.pow(2, z));
    const ytile = Math.floor(
      (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z)
    );
    images.push({
      id: `osm_${z}_${xtile}_${ytile}`,
      type: 'map',
      url: `https://tile.openstreetmap.org/${z}/${xtile}/${ytile}.png`,
      attribution: '© OpenStreetMap contributors',
      source: 'openstreetmap',
      zoom: z,
      coordinates: { lat, lng }
    });

    if (this.enableCommons) {
      try {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=500&ggslimit=5&iiprop=url`;
        const res = await fetch(commonsUrl);
        const data = await res.json();
        if (data?.query?.pages) {
          for (const page of Object.values(data.query.pages)) {
            const info = page.imageinfo?.[0];
            if (info?.url) {
              images.push({
                id: `commons_${page.pageid}`,
                type: 'photo',
                url: info.url,
                title: page.title,
                attribution: 'Wikimedia Commons',
                source: 'wikimedia'
              });
            }
          }
        }
      } catch (e) {
        // non-fatal
        console.warn('Commons retrieval failed:', e.message);
      }
    }

    return { images, retrievedCount: images.length };
  }
}
