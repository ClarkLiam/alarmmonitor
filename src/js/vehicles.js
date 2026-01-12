/**
 * Fetch vehicle data from Google Sheets CSV export and return an array of objects.
 * Each vehicle object: { designation, callSign, status, kennzeichen, typ }
 */

const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1avBbHGh6RDgBvAvMULAhJq-I5fpow_X7fzIEkzL6L4E/export?format=csv';
const REFRESH_INTERVAL = 20000; // 30 seconds
let currentVehicles = [];

function parseCSV(csvText) {
    console.log('Parsing CSV...');
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 3) {
        console.warn('CSV has fewer than 3 rows');
        return [];
    }
    
    const rows = lines.map(line => {
        const cells = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim());
        return cells;
    });
    
    console.log('CSV rows:', rows.length);
    console.log('First row (designations):', rows[0]);
    console.log('Second row (call signs):', rows[1]);
    console.log('Third row (status):', rows[2]);
    
    const vehicles = [];
    
    for (let colIndex = 1; colIndex < rows[0].length; colIndex++) {
        const designation = rows[0]?.[colIndex] || '';
        const callSign = rows[1]?.[colIndex] || '';
        const status = rows[2]?.[colIndex] || '';
        const kennzeichen = rows[3]?.[colIndex] || '';
        const typ = rows[4]?.[colIndex] || '';
        
        // Skip empty columns
        if (!designation && !callSign && !status) continue;
        
        vehicles.push({ designation, callSign, status, kennzeichen, typ });
    }
    
    console.log('Parsed vehicles:', vehicles);
    return vehicles;
}

async function fetchVehicleData() {
    try {
        console.log('Fetching vehicle data from Google Sheets CSV');
        console.log('URL:', SHEETS_CSV_URL);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(SHEETS_CSV_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('Fetch successful. CSV length:', csvText.length);
        console.log('First 500 chars:', csvText.substring(0, 500));
        console.log('Calling parseCSV...');
        const result = parseCSV(csvText);
        console.log('parseCSV returned:', result);
        return result;
    } catch (error) {
        console.error('Error fetching vehicle data:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        return [];
    }
}

function renderVehicleProof(vehicles) {
    // Create or reuse container
    let container = document.getElementById('vehicle-data-proof');
    if (!container) {
        container = document.createElement('div');
        container.id = 'vehicle-data-proof';
        container.style.padding = '8px';
        container.style.border = '1px solid #ccc';
        container.style.margin = '8px 0';
        container.style.background = '#f9f9f9';
        // Append to body so it's visible on any page
        document.body.appendChild(container);
    }

    // Heading
    container.innerHTML = '<strong>Vehicle data (proof of receipt):</strong>';

    if (!vehicles || vehicles.length === 0) {
        const p = document.createElement('div');
        p.textContent = 'No vehicle data found.';
        container.appendChild(p);
        return;
    }

    // Build table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = '8px';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Designation', 'Call Sign', 'Status'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.border = '1px solid #ddd';
        th.style.padding = '6px 8px';
        th.style.textAlign = 'left';
        th.style.background = '#efefef';
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    vehicles.forEach(v => {
        const tr = document.createElement('tr');
        [v.designation, v.callSign, v.status].forEach(text => {
            const td = document.createElement('td');
            td.textContent = text || '-';
            td.style.border = '1px solid #ddd';
            td.style.padding = '6px 8px';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);

    // Also append JSON proof
    const pre = document.createElement('pre');
    pre.style.marginTop = '8px';
    pre.style.maxHeight = '200px';
    pre.style.overflow = 'auto';
    pre.textContent = JSON.stringify(vehicles, null, 2);
    container.appendChild(pre);
}

function vehiclesChanged(newVehicles, oldVehicles) {
    if (!oldVehicles || oldVehicles.length !== newVehicles.length) {
        return true;
    }
    
    // Compare each vehicle
    return newVehicles.some((newVehicle, index) => {
        const oldVehicle = oldVehicles[index];
        return (
            newVehicle.designation !== oldVehicle.designation ||
            newVehicle.callSign !== oldVehicle.callSign ||
            newVehicle.status !== oldVehicle.status ||
            newVehicle.kennzeichen !== oldVehicle.kennzeichen ||
            newVehicle.typ !== oldVehicle.typ
        );
    });
}

async function updateVehicleDataIfChanged() {
    try {
        const newVehicles = await fetchVehicleData();
        
        if (vehiclesChanged(newVehicles, currentVehicles)) {
            console.log('Vehicle data changed, updating UI...');
            currentVehicles = newVehicles;
            createVehicleBoxes(newVehicles);
            document.dispatchEvent(new CustomEvent('vehicleDataUpdated', { detail: newVehicles }));
        }
    } catch (error) {
        console.error('Error in updateVehicleDataIfChanged:', error);
    }
}

function getVehicleImagePath(callSign) {
    console.log('getVehicleImagePath called with callSign:', callSign);
    
    // Extract the vehicle type number from callSign format: 27/19-01 -> 19
    const match = callSign.match(/\/(\d+)-/);
    const typeNumber = match ? match[1] : null;
    console.log('Extracted type number:', typeNumber);
    
    // Map type number to image path
    const typeMap = {
        '19': 'src/images/vehicles/mtw.png',
        '43': 'src/images/vehicles/hlf.png',
        '26': 'src/images/vehicles/gtlf.png'
    };
    
    const result = typeMap[typeNumber] || 'src/images/vehicles/mtw.png';
    console.log('Returning image path:', result);
    return result;
}

function createVehicleBoxes(vehicles) {
    console.log('Creating vehicle boxes dynamically...');
    
    // Find the fahrzeuge container
    const fahrzeugeContainer = document.querySelector('.fahrzeuge');
    if (!fahrzeugeContainer) {
        console.warn('No .fahrzeuge container found');
        return;
    }
    
    // Clear existing boxes
    fahrzeugeContainer.innerHTML = '';
    
    // Create a box for each vehicle
    vehicles.forEach((vehicle, index) => {
        const status = vehicle.status || 'unknown';
        const boxId = 'status' + status;
        
        // Create main fahrzeug-box div
        const box = document.createElement('div');
        box.className = 'fahrzeug-box';
        box.id = boxId;
        
        // Status div
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status';
        const m = boxId.match(/\d+/);
        statusDiv.textContent = m ? m[0] : '';
        box.appendChild(statusDiv);
        
        // Info div
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';
        
        const h1 = document.createElement('h1');
        h1.textContent = `Florian Stuttgart ${vehicle.callSign} (${vehicle.designation})`;
        infoDiv.appendChild(h1);
        
        const h3 = document.createElement('h3');
        h3.textContent = `${vehicle.kennzeichen} | ${vehicle.typ}`;
        infoDiv.appendChild(h3);
        
        box.appendChild(infoDiv);
        
        // Image div (placeholder)
        const imageDiv = document.createElement('div');
        imageDiv.className = 'image';
        const img = document.createElement('img');
        img.src = getVehicleImagePath(vehicle.callSign);
        img.alt = vehicle.designation;
        img.style.width = '90%';
        img.style.paddingLeft = '5%';
        imageDiv.appendChild(img);
        box.appendChild(imageDiv);
        
        // Append to container
        fahrzeugeContainer.appendChild(box);
        console.log(`Created box ${index} with ID: ${boxId}`);
    });
}

async function initializeVehicleData() {
    const vehicles = await fetchVehicleData();
    currentVehicles = vehicles;
    console.log('Vehicle data (objects):', vehicles);

    // Render visible proof and dispatch an event for other scripts
    try {
        renderVehicleProof(vehicles);
        createVehicleBoxes(vehicles);
        document.dispatchEvent(new CustomEvent('vehicleDataLoaded', { detail: vehicles }));
    } catch (e) {
        console.error('Error rendering vehicle proof:', e);
    }
    
    // Start polling for changes
    console.log('Starting auto-refresh interval every', REFRESH_INTERVAL / 1000, 'seconds');
    setInterval(updateVehicleDataIfChanged, REFRESH_INTERVAL);

    return vehicles;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeVehicleData);
} else {
    setTimeout(initializeVehicleData, 100);
}
