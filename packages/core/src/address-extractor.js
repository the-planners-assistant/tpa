export default class AddressExtractor {
  constructor() {
    this.ukPostcodeRegex = /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2}\b/gi;
    this.addressPatterns = [
      // UK address patterns
      /(\d+(?:\-\d+)?)\s+([A-Za-z\s]+(?:Road|Street|Lane|Avenue|Drive|Close|Way|Place|Gardens|Park|Square|Terrace|Crescent|Grove|Rise|View|Court|Mews|Hill|Green|Common|Walk|Row|End|Side|Vale|Heights|Fields|Meadow|House|Building|Centre|Estate))\b/gi,
      /([A-Za-z\s]+(?:Road|Street|Lane|Avenue|Drive|Close|Way|Place|Gardens|Park|Square|Terrace|Crescent|Grove|Rise|View|Court|Mews|Hill|Green|Common|Walk|Row|End|Side|Vale|Heights|Fields|Meadow))\s*,?\s*([A-Za-z\s]+)\s*,?\s*([A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][ABD-HJLNP-UW-Z]{2})/gi,
      // Property names
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:House|Building|Court|Lodge|Manor|Hall|Cottage|Farm|Mill|Works|Centre|Complex)\b/gi
    ];
    this.googleApiKey = null;
    this.geocodingCache = new Map();
  }

  setGoogleApiKey(apiKey) {
    this.googleApiKey = apiKey;
  }

  async extractAddresses(textContent) {
    const addresses = new Set();
    const addressDetails = [];

    // Extract postcodes first
    const postcodes = textContent.match(this.ukPostcodeRegex) || [];
    
    // Extract full addresses using patterns
    for (const pattern of this.addressPatterns) {
      const matches = [...textContent.matchAll(pattern)];
      for (const match of matches) {
        addresses.add(match[0].trim());
      }
    }

    // Process each unique address
    for (const address of addresses) {
      const addressDetail = {
        rawText: address,
        cleaned: this.cleanAddress(address),
        postcode: this.extractPostcode(address),
        confidence: this.calculateAddressConfidence(address),
        coordinates: null,
        formattedAddress: null,
        addressComponents: null
      };

      // Attempt geocoding if Google API key is available
      if (this.googleApiKey && addressDetail.confidence > 0.6) {
        try {
          const geocoded = await this.geocodeAddress(addressDetail.cleaned);
          if (geocoded) {
            addressDetail.coordinates = geocoded.coordinates;
            addressDetail.formattedAddress = geocoded.formattedAddress;
            addressDetail.addressComponents = geocoded.components;
            addressDetail.confidence = Math.min(addressDetail.confidence + 0.2, 1.0);
          }
        } catch (error) {
          console.warn('Geocoding failed for address:', addressDetail.cleaned, error);
        }
      }

      addressDetails.push(addressDetail);
    }

    // Sort by confidence
    addressDetails.sort((a, b) => b.confidence - a.confidence);

    return {
      addresses: addressDetails,
      primaryAddress: addressDetails[0] || null,
      postcodes: [...new Set(postcodes)],
      hasValidAddress: addressDetails.some(addr => addr.confidence > 0.7)
    };
  }

  cleanAddress(rawAddress) {
    return rawAddress
      .replace(/\s+/g, ' ')
      .replace(/[,;]\s*$/, '')
      .trim();
  }

  extractPostcode(address) {
    const match = address.match(this.ukPostcodeRegex);
    return match ? match[0].toUpperCase().replace(/\s+/g, ' ') : null;
  }

  calculateAddressConfidence(address) {
    let confidence = 0.3; // Base confidence

    // Has postcode
    if (this.ukPostcodeRegex.test(address)) {
      confidence += 0.3;
    }

    // Has street number
    if (/^\d+/.test(address.trim())) {
      confidence += 0.2;
    }

    // Has common UK street suffixes
    const streetSuffixes = /\b(Road|Street|Lane|Avenue|Drive|Close|Way|Place|Gardens|Park|Square|Terrace|Crescent|Grove|Rise|View|Court|Mews|Hill|Green|Common|Walk|Row|End|Side|Vale|Heights|Fields|Meadow)\b/i;
    if (streetSuffixes.test(address)) {
      confidence += 0.2;
    }

    // Length check (reasonable address length)
    if (address.length >= 10 && address.length <= 100) {
      confidence += 0.1;
    }

    // Has proper capitalization
    if (/^[A-Z]/.test(address)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  async geocodeAddress(address) {
    // Check cache first
    const cacheKey = address.toLowerCase();
    if (this.geocodingCache.has(cacheKey)) {
      return this.geocodingCache.get(cacheKey);
    }

    if (!this.googleApiKey) {
      return null;
    }

    try {
      const encodedAddress = encodeURIComponent(address + ', UK');
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.googleApiKey}&region=uk&components=country:GB`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        
        const geocoded = {
          coordinates: [
            result.geometry.location.lng,
            result.geometry.location.lat
          ],
          formattedAddress: result.formatted_address,
          components: this.parseAddressComponents(result.address_components),
          accuracy: this.assessGeocodeAccuracy(result),
          placeId: result.place_id,
          types: result.types
        };

        // Cache result
        this.geocodingCache.set(cacheKey, geocoded);
        
        return geocoded;
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  parseAddressComponents(components) {
    const parsed = {
      streetNumber: null,
      streetName: null,
      locality: null,
      administrativeArea: null,
      postalCode: null,
      country: null
    };

    for (const component of components) {
      const types = component.types;
      
      if (types.includes('street_number')) {
        parsed.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        parsed.streetName = component.long_name;
      } else if (types.includes('locality') || types.includes('postal_town')) {
        parsed.locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        parsed.administrativeArea = component.long_name;
      } else if (types.includes('postal_code')) {
        parsed.postalCode = component.long_name;
      } else if (types.includes('country')) {
        parsed.country = component.long_name;
      }
    }

    return parsed;
  }

  assessGeocodeAccuracy(result) {
    const types = result.types;
    
    if (types.includes('street_address')) {
      return 'high';
    } else if (types.includes('route')) {
      return 'medium';
    } else if (types.includes('locality') || types.includes('postal_town')) {
      return 'low';
    }
    
    return 'very_low';
  }

  async getSiteContext(coordinates) {
    if (!this.googleApiKey || !coordinates) {
      return null;
    }

    try {
      // Get nearby places of interest
      const placesContext = await this.getNearbyPlaces(coordinates);
      
      // Get street view if available
      const streetViewContext = await this.getStreetViewData(coordinates);
      
      return {
        coordinates: coordinates,
        nearbyPlaces: placesContext,
        streetView: streetViewContext,
        analysisDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting site context:', error);
      return null;
    }
  }

  async getNearbyPlaces(coordinates) {
    if (!this.googleApiKey) return null;

    try {
      const [lng, lat] = coordinates;
      const radius = 1000; // 1km radius
      
      // Search for relevant planning-related places
      const searchTypes = [
        'school', 'hospital', 'transit_station', 'bus_station',
        'shopping_mall', 'park', 'church', 'library', 'post_office'
      ];

      const allPlaces = [];

      for (const type of searchTypes) {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${this.googleApiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK') {
          for (const place of data.results.slice(0, 3)) { // Top 3 per type
            allPlaces.push({
              name: place.name,
              type: type,
              location: place.geometry.location,
              distance: this.calculateDistance(coordinates, [place.geometry.location.lng, place.geometry.location.lat]),
              rating: place.rating || null,
              priceLevel: place.price_level || null,
              placeId: place.place_id
            });
          }
        }
      }

      // Sort by distance
      allPlaces.sort((a, b) => a.distance - b.distance);
      
      return allPlaces.slice(0, 20); // Top 20 closest places
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      return null;
    }
  }

  async getStreetViewData(coordinates) {
    if (!this.googleApiKey) return null;

    try {
      const [lng, lat] = coordinates;
      
      // Check if street view is available
      const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${this.googleApiKey}`;
      
      const response = await fetch(metadataUrl);
      const metadata = await response.json();

      if (metadata.status === 'OK') {
        return {
          available: true,
          location: metadata.location,
          date: metadata.date,
          imageUrl: `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${lat},${lng}&key=${this.googleApiKey}`,
          copyright: metadata.copyright
        };
      }
      
      return { available: false };
    } catch (error) {
      console.error('Error fetching street view data:', error);
      return { available: false };
    }
  }

  calculateDistance(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Pattern matching for specific UK planning document formats
  extractPlanningApplicationRef(textContent) {
    // Common UK planning application reference patterns
    const patterns = [
      /\b\d{2}\/\d{4,5}\/[A-Z]{1,4}\b/g, // 20/12345/FUL
      /\b\d{4}\/\d{4,5}\/[A-Z]{1,4}\b/g, // 2020/12345/FUL
      /\bDC\/\d{2}\/\d{4,5}\b/g, // DC/20/12345
      /\bP\/\d{2}\/\d{4,5}\b/g, // P/20/12345
      /\b[A-Z]{2,4}\d{2}\/\d{4,5}\b/g // ABC20/12345
    ];

    const refs = [];
    for (const pattern of patterns) {
      const matches = textContent.match(pattern) || [];
      refs.push(...matches);
    }

    return [...new Set(refs)]; // Remove duplicates
  }

  extractLocalAuthority(textContent, addressData) {
    // Extract local authority from various sources
    const authorities = [];

    // From address components if geocoded
    if (addressData?.primaryAddress?.addressComponents?.administrativeArea) {
      authorities.push(addressData.primaryAddress.addressComponents.administrativeArea);
    }

    // From text patterns
    const authorityPatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Council|Borough|District|City|County)/gi,
      /London Borough of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
    ];

    for (const pattern of authorityPatterns) {
      const matches = [...textContent.matchAll(pattern)];
      for (const match of matches) {
        authorities.push(match[1]);
      }
    }

    return [...new Set(authorities)];
  }
}
