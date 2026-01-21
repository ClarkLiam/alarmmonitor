var map = L.map('map', {zoomControl: false, dragging: false, doubleClickZoom: false, attributionControl: false}).setView([48.846141, 9.157327], 13);

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', {
    attribution: ''
}).addTo(map);

// Firehouse fallback coordinates (Stammheimerstraße 140, Stuttgart)
const FIREHOUSE_FALLBACK_COORDS = Geo.FIREHOUSE_FALLBACK_COORDS;

// Static marker for firehouse (transparent red circle)
const firehouseCircle = L.circleMarker([FIREHOUSE_FALLBACK_COORDS.lat, FIREHOUSE_FALLBACK_COORDS.lon], {
    radius: 10,
    fillColor: '#ff0000',
    color: '#cc0000',
    weight: 2,
    opacity: 0.4,
    fillOpacity: 0.2
}).addTo(map).bindPopup('Feuerwache');

function updateFirehouseCircleVisibility() {
    const z = map.getZoom();
    const visible = z >= 14;
    firehouseCircle.setStyle({
        opacity: visible ? 0.4 : 0,
        fillOpacity: visible ? 0.2 : 0
    });
}

var polygon = L.polygon([
    [48.86009, 9.146855],
    [48.860817, 9.153528],
    [48.857076, 9.154762],
    [48.856701, 9.158120],
    [48.855636, 9.161178],
    [48.854083, 9.159740],
    [48.853101, 9.160083],
    [48.851379, 9.163806],
    [48.851527, 9.164729],
    [48.850821, 9.165984],
    [48.852219, 9.168881],
    [48.852240, 9.169814],
    [48.849571, 9.171048],
    [48.847383, 9.176016],
    [48.849501, 9.176853],
    [48.848689, 9.179824],
    [48.849360, 9.180404],
    [48.848682, 9.182453],
    [48.849656, 9.183183],
    [48.849225, 9.184545],
    [48.842377, 9.177239],
    [48.838281, 9.176295],
    [48.836473, 9.175694],
    [48.831699, 9.174771],
    [48.832434, 9.169632],
    [48.832187, 9.166649],
    [48.832180, 9.165019],
    [48.832723, 9.162454],
    [48.833126, 9.159075],
    [48.832427, 9.157530],
    [48.833797, 9.154311],
    [48.833825, 9.150213],
    [48.833310, 9.146265],
    [48.831064, 9.137725],
    [48.831304, 9.136684],
    [48.832158, 9.138400],
    [48.834913, 9.137714],
    [48.837130, 9.139398],
    [48.837533, 9.140171],
    [48.838698, 9.140171],
    [48.839573, 9.137907],
    [48.839715, 9.138046],
    [48.839905, 9.136716],
    [48.842779, 9.134678],
    [48.844121, 9.132660],
    [48.844820, 9.133444],
    [48.843732, 9.135600],
    [48.844128, 9.136190],
    [48.844008, 9.141898],
    [48.845180, 9.142992],
    [48.849783, 9.139624],
    [48.851901, 9.139055],
    [48.852784, 9.137574],
    [48.854040, 9.135729],
    [48.854075, 9.133841],
    [48.857565, 9.133832],
    [48.856215, 9.140909],
    [48.859965, 9.140667],
    [48.859910, 9.141101],
    [48.861910, 9.141266]
]).addTo(map);

// --- Einsatz marker handling ---
const einsatzMarkerIcons = {
    active: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [16, 26],
        iconAnchor: [8, 26],
        shadowSize: [24, 24]
    }),
    completed: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [16, 26],
        iconAnchor: [8, 26],
        shadowSize: [24, 24]
    })
};

function getEinsatzMarkerIcon(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'completed') return einsatzMarkerIcons.completed;
    return einsatzMarkerIcons.active;
}

const einsatzMarkers = [];
const markerClusterGroup = L.markerClusterGroup({
    disableClusteringAtZoom: 0
});
map.addLayer(markerClusterGroup);
let lastDisplayedAddresses = [];
let updateDebounceTimer = null;
let firehouseCoords = null;
let autoZoomEnabled = true;
let lastBoundsKey = null;
let routingControl = null;
const routeLines = [];

function getTooltipDirection(markerLatlng) {
    // Get available directions to position tooltip (top, left, right)
    const directions = ['top', 'left', 'right'];
    
    // Simple rotation: spread tooltips in different directions
    // For now, use a hash-based approach to distribute evenly
    const hash = (markerLatlng.lat + markerLatlng.lng).toString().charCodeAt(0);
    return directions[hash % directions.length];
}

function getTooltipOffset(direction) {
    // Adjust offset based on direction
    switch(direction) {
        case 'top': return [0, -45];
        case 'left': return [-10, -12];
        case 'right': return [10, -12];
        default: return [0, -45];
    }
}

function clearEinsatzMarkers() {
    einsatzMarkers.forEach(marker => markerClusterGroup.removeLayer(marker));
    einsatzMarkers.length = 0;
}

function clearRoutes() {
    routeLines.forEach(route => {
        if (route && map.hasLayer(route)) {
            map.removeLayer(route);
        }
    });
    routeLines.length = 0;
}

function createRoute(fromCoords, toCoords, einsatzType) {
    // Create a routing control without the UI panel
    const waypoints = [
        L.latLng(fromCoords.lat, fromCoords.lon),
        L.latLng(toCoords.lat, toCoords.lon)
    ];

    const router = L.Routing.control({
        waypoints: waypoints,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            profile: 'driving'
        }),
        lineOptions: {
            styles: [
                { color: '#ff0000', opacity: 0.8, weight: 4 }
            ],
            addWaypoints: false
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        showAlternatives: false,
        createMarker: function() { return null; } // Don't create waypoint markers
    }).addTo(map);

    // Hide the routing instructions panel
    const container = router.getContainer();
    if (container) {
        container.style.display = 'none';
    }

    routeLines.push(router);
    return router;
}

function pickDisplayedEinsätze(einsaetze) {
    const eligible = Array.isArray(einsaetze) ? einsaetze : [];

    if (typeof shouldShowEinsatz === 'function') {
        // Mirror UI visibility rules
        const filtered = eligible.filter(shouldShowEinsatz);
        const sorted = typeof sortEinsätzeByStatusAndTime === 'function'
            ? sortEinsätzeByStatusAndTime([...filtered])
            : filtered;
        return sorted.slice(0, 4);
    }

    // Fallback: show the first 4 entries
    return eligible.slice(0, 4);
}

async function updateEinsatzMarkers(einsaetze) {
    clearEinsatzMarkers();
    clearRoutes();

    const displayed = pickDisplayedEinsätze(einsaetze);
    const currentAddresses = displayed.map(e => (e.location || '').trim());
    
    if (JSON.stringify(currentAddresses) === JSON.stringify(lastDisplayedAddresses)) return;
    lastDisplayedAddresses = currentAddresses;

    const results = await Promise.all(displayed.map(async einsatz => {
        const rawCoords = await Geo.geocodeAddress(einsatz.location);
        const locationText = (einsatz.location || '').toLowerCase();
        const isFirehouseLocation = Geo.isFirehouseLocation(locationText);

        // If it's the firehouse, force coordinates to the known firehouse point
        const coords = isFirehouseLocation
            ? (firehouseCoords || FIREHOUSE_FALLBACK_COORDS)
            : rawCoords;

        if (!coords) return { einsatz, coords: null };

        return { einsatz, coords };
    }));

    results.forEach(({ einsatz, coords }) => {
        if (!coords) return;

        const marker = L.marker([coords.lat, coords.lon], { icon: getEinsatzMarkerIcon(einsatz.status) });
        const label = einsatz.type || 'Einsatz';
        const direction = getTooltipDirection(L.latLng(coords.lat, coords.lon));
        const offset = getTooltipOffset(direction);
        marker.bindTooltip(label, { permanent: true, direction: direction, offset: offset, className: 'einsatz-marker-label' });
        marker.bindPopup(`<strong>${einsatz.type || 'Einsatz'}</strong><br>${einsatz.description || ''}<br>${einsatz.location || ''}`, { maxWidth: 200, maxHeight: 150 });
        markerClusterGroup.addLayer(marker);
        einsatzMarkers.push(marker);

        // Create route from firehouse to alarm location (only for active alarms)
        const isActive = (einsatz.status || '').toLowerCase() !== 'completed';
        const firehouseForRoute = firehouseCoords || FIREHOUSE_FALLBACK_COORDS;
        if (isActive && firehouseForRoute && coords) {
            // Don't create route if alarm is at the firehouse
            const locationText = (einsatz.location || '').toLowerCase();
            const isFirehouseLocation = Geo.isFirehouseLocation(locationText);
            if (!isFirehouseLocation) {
                createRoute(firehouseForRoute, coords, einsatz.type);
            }
        }
    });

    // Zoom to fit all displayed markers + firehouse, or reset to default if none
    if (!autoZoomEnabled) return;
    
    const allMarkersWithCoords = results.filter(({ coords }) => coords);
    
    if (allMarkersWithCoords.length > 0 || firehouseCoords) {
        const boundsArray = allMarkersWithCoords.map(({ coords }) => [coords.lat, coords.lon]);
        const firehouseForBounds = firehouseCoords || FIREHOUSE_FALLBACK_COORDS;
        if (firehouseForBounds) {
            boundsArray.push([firehouseForBounds.lat, firehouseForBounds.lon]);
        }
        const bounds = L.latLngBounds(boundsArray);
        const key = JSON.stringify({
            sw: bounds.getSouthWest(),
            ne: bounds.getNorthEast()
        });

        if (key !== lastBoundsKey) {
            map.fitBounds(bounds, { padding: [38, 38], maxZoom: 19 });
            lastBoundsKey = key;
        }
        updateFirehouseCircleVisibility();
    } else {
        // No alarms with coordinates: reset to default view
        map.setView([48.846141, 9.157327], 13);
        lastBoundsKey = null;
        updateFirehouseCircleVisibility();
    }
}

function debouncedUpdateMarkers(einsaetze) {
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = setTimeout(() => {
        updateEinsatzMarkers(einsaetze);
    }, 300);
}

document.addEventListener('einsätzeLoaded', (event) => {
    // Geocode firehouse on first load
    if (!firehouseCoords) {
        Geo.geocodeAddress(Geo.FIREHOUSE_ADDRESS).then(coords => {
            firehouseCoords = coords || FIREHOUSE_FALLBACK_COORDS;
            if (firehouseCoords) {
                firehouseCircle.setLatLng([firehouseCoords.lat, firehouseCoords.lon]);
            }
        });
    }
    updateEinsatzMarkers(event.detail);
    updateFirehouseCircleVisibility();
});

document.addEventListener('einsätzeUpdated', (event) => {
    debouncedUpdateMarkers(event.detail);
});

map.on('zoomend', updateFirehouseCircleVisibility);

// Add reset map button control
const ResetMapControl = L.Control.extend({
    options: {
        position: 'bottomright'
    },

    onAdd: function (map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        container.style.backgroundColor = '#3388ff';
        container.style.border = 'none';
        container.style.borderRadius = '4px';
        container.style.overflow = 'hidden';

        const button = L.DomUtil.create('button', '', container);
        button.innerHTML = '⊡';
        button.style.width = '32px';
        button.style.height = '32px';
        button.style.padding = '0';
        button.style.backgroundColor = '#3388ff';
        button.style.border = 'none';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.style.fontSize = '16px';
        button.style.color = 'white';
        button.title = 'Toggle map zoom';

        button.addEventListener('click', () => {
            autoZoomEnabled = !autoZoomEnabled;
            if (!autoZoomEnabled) {
                map.setView([48.846141, 9.157327], 13);
                button.style.opacity = '0.7';
            } else {
                button.style.opacity = '1';
                if (einsatzMarkers.length > 0 || firehouseCoords) {
                    const boundsArray = einsatzMarkers.map(m => m.getLatLng()).map(latlng => [latlng.lat, latlng.lng]);
                    const firehouseForBounds = firehouseCoords || FIREHOUSE_FALLBACK_COORDS;
                    if (firehouseForBounds) boundsArray.push([firehouseForBounds.lat, firehouseForBounds.lon]);
                    if (boundsArray.length > 0) {
                        const bounds = L.latLngBounds(boundsArray);
                        map.fitBounds(bounds, { padding: [38, 38], maxZoom: 19 });
                    }
                }
            }
        });

        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#2b6ec7';
        });

        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#3388ff';
        });

        return container;
    }
});

map.addControl(new ResetMapControl());