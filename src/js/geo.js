(function (window) {
    const FIREHOUSE_ADDRESS = 'Stammheimerstraße 140, Stuttgart';
    const FIREHOUSE_FALLBACK_COORDS = { lat: 48.7519, lon: 9.1819 };
    const nearbyCities = ['stuttgart', 'kornwestheim', 'korntal', 'korntal-münchingen', 'ludwigsburg', 'fellbach', 'ditzingen'];
    const geocodeCache = new Map();

    function normalizeAddress(address) {
        const base = (address || '').trim();
        if (!base) return '';

        const lower = base.toLowerCase();
        if (nearbyCities.some(city => lower.includes(city)) || /70\d{3}/.test(base)) return base;

        if (lower.includes('stammheimerstr') || lower.includes('stammheimerstraße')) {
            return 'Stammheimer Str. 140, 70439 Stuttgart, Germany';
        }

        return `${base}, Baden-Württemberg, Germany`;
    }

    function parseStreetAndNumber(address) {
        const match = (address || '').trim().match(/^(.*?)(\s+)(\d+[a-zA-Z]?)(.*)$/);
        if (!match) return null;
        const street = (match[1] + (match[4] || '')).trim();
        const houseNumber = match[3].trim();
        if (!street || !houseNumber) return null;
        return { street, houseNumber };
    }

    function isFirehouseLocation(text) {
        const lower = (text || '').toLowerCase();
        return lower.includes('stammheimerstr') || lower.includes('stammheimerstraße') || lower.includes('durscht 4');
    }

    async function geocodeAddress(address, timeout = 8000) {
        const normalized = normalizeAddress(address);
        if (!normalized) return null;
        if (geocodeCache.has(normalized)) return geocodeCache.get(normalized);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const viewbox = '8.85,48.70,9.55,49.05';
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(normalized)}&countrycodes=de&bounded=1&viewbox=${viewbox}&addressdetails=1`;
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Geocoding failed with status ${response.status}`);

            let results = await response.json();

            const parsed = parseStreetAndNumber(normalized);
            const houseNumber = parsed ? parsed.houseNumber : null;

            const missingHouseMatch = Array.isArray(results) && results.length > 0
                ? (houseNumber && !(results[0].display_name || '').includes(houseNumber))
                : true;

            if (!Array.isArray(results) || results.length === 0 || missingHouseMatch) {
                if (parsed) {
                    const structuredUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&street=${encodeURIComponent(parsed.houseNumber + ' ' + parsed.street)}&state=Baden-Württemberg&country=Germany&bounded=1&viewbox=${viewbox}&addressdetails=1`;
                    const structuredResp = await fetch(structuredUrl, {
                        signal: controller.signal,
                        headers: { 'Accept': 'application/json' }
                    });
                    if (structuredResp.ok) {
                        const structuredResults = await structuredResp.json();
                        if (Array.isArray(structuredResults) && structuredResults.length > 0) {
                            results = structuredResults;
                        }
                    }
                }
            }

            if (!Array.isArray(results) || results.length === 0) {
                geocodeCache.set(normalized, null);
                return null;
            }

            const { lat, lon, display_name } = results[0];
            const coords = { lat: parseFloat(lat), lon: parseFloat(lon), displayName: display_name };
            geocodeCache.set(normalized, coords);
            return coords;
        } catch (err) {
            geocodeCache.set(normalized, null);
            return null;
        }
    }

    window.Geo = {
        FIREHOUSE_ADDRESS,
        FIREHOUSE_FALLBACK_COORDS,
        geocodeAddress,
        isFirehouseLocation,
        normalizeAddress
    };
})(window);
