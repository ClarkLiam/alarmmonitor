/**
 * Fetch Einsätze from Google Sheets
 */

const EINSÄTZE_CSV_URL = "https://docs.google.com/spreadsheets/d/1avBbHGh6RDgBvAvMULAhJq-I5fpow_X7fzIEkzL6L4E/export?format=csv&gid=2011332130";
const EINSÄTZE_UPDATE_INTERVAL = 15000; // 15 seconds
let currentEinsätze = [];

function parseEinsätzeCSV(csvText) {
    console.log('Parsing einsätze CSV...');
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) {
        console.warn('CSV has fewer than 2 rows');
        return [];
    }
    
    const headerLine = lines[0];
    const headerCells = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < headerLine.length; i++) {
        const char = headerLine[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            headerCells.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    headerCells.push(current.trim());
    
    console.log('Headers:', headerCells);
    console.log('Total columns:', headerCells.length);
    
    const typeIdx = 1;
    const descIdx = 2;
    const timeIdx = 4;
    const locIdx = 5;
    const vehiclesIdx = 6;
    const startTimeIdx = 4;  // Start time
    const statusIdx = 7;     // Status: armed, demo, completed, active
    
    console.log('Using column indices - Type:', typeIdx, 'Description:', descIdx, 'StartTime:', startTimeIdx, 'Time:', timeIdx, 'Location:', locIdx, 'Vehicles:', vehiclesIdx, 'Status:', statusIdx);
    
    const einsätze = [];
    for (let row = 1; row < lines.length; row++) {
        const cells = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < lines[row].length; i++) {
            const char = lines[row][i];
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
        
        console.log(`Row ${row} all cells:`, cells);
        
        const type = cells[typeIdx] || '';
        const description = cells[descIdx] || '';
        const time = cells[timeIdx] || '';
        const location = cells[locIdx] || '';
        const vehicles = cells[vehiclesIdx] || '';
        const startTime = cells[startTimeIdx] || '';
        const status = (cells[statusIdx] || '').toLowerCase();
        
        console.log(`Row ${row}: type="${type}", description="${description}", time="${time}", location="${location}", vehicles="${vehicles}", startTime="${startTime}", status="${status}"`);
        if (!type && !description && !time) continue;
        
        einsätze.push({ type, description, time, location, vehicles, startTime, status });
    }
    
    console.log('Parsed einsätze:', einsätze);
    return einsätze;
}

async function fetchEinsätzeData() {
    try {
        console.log('Fetching Einsatz data from Google Sheets');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(EINSÄTZE_CSV_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('Fetch successful. CSV length:', csvText.length);
        const result = parseEinsätzeCSV(csvText);
        console.log('Einsätze returned:', result);
        return result;
    } catch (error) {
        console.error('Error fetching Einsatz data:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        return [];
    }
}

function shouldShowEinsatz(einsatz) {
    const status = (einsatz.status || '').toLowerCase();
    
    if (status === 'demo') return true;             // Demo: show
    if (status === 'completed') return true;        // Completed: show
    if (status === 'active') return true;           // Active: show
    if (status === 'armed') {                       // Armed: only show if current time >= start time
        const now = new Date(); 
        const [hh, mm] = (einsatz.startTime || '00:00').split(':').map(Number);
        if (isNaN(hh) || isNaN(mm)) return false;
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = hh * 60 + mm;
        return currentMinutes >= startMinutes;
    }
    
    // Unknown status: hide
    return false;
}

function sortEinsätzeByStatusAndTime(einsätze) {        // Priority order: demo > active > completed
    const statusOrder = {
        'demo': 0,
        'active': 1,
        'completed': 2
    };
    
    return einsätze.sort((a, b) => {
        const statusA = (a.status || '').toLowerCase();
        const statusB = (b.status || '').toLowerCase();
        
        const orderA = statusOrder[statusA] !== undefined ? statusOrder[statusA] : 3;
        const orderB = statusOrder[statusB] !== undefined ? statusOrder[statusB] : 3;
        
        // sort by status priority
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        
        // Within, sort by time
        const timeA = a.time ? a.time.split(':').map(Number) : [0, 0];
        const timeB = b.time ? b.time.split(':').map(Number) : [0, 0];
        const minutesA = timeA[0] * 60 + timeA[1];
        const minutesB = timeB[0] * 60 + timeB[1];
        
        return minutesB - minutesA; // Most recent (later time) first
    });
}

function renderEinsätze(einsätze) {
    console.log('Rendering einsätze...');
    
    // Find container
    const container = document.querySelector('.einsätze');
    if (!container) {
        console.warn('No .einsätze container found');
        return;
    }
    
    // Filter by status
    const visibleEinsätze = einsätze.filter(shouldShowEinsatz);
    console.log(`Showing ${visibleEinsätze.length} of ${einsätze.length} einsätze`);
    
    // Sort by 'priority' (demo > active > completed) + time
    const sortedEinsätze = sortEinsätzeByStatusAndTime(visibleEinsätze);
    
    // Clear existing
    container.innerHTML = '';
    
    // Create div for Einsatz -> limit to 4
    const displayEinsätze = sortedEinsätze.slice(0, 4);
    displayEinsätze.forEach((einsatz, index) => {
        const einsatzDiv = document.createElement('div');
        einsatzDiv.className = 'einsatz';
        
        // Modify Style for completed
        if ((einsatz.status || '').toLowerCase() === 'completed') {
            einsatzDiv.style.opacity = '0.85';
            einsatzDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            einsatzDiv.style.color = '#0e0e0eff';
            einsatzDiv.style.maxHeight = '50px';
            einsatzDiv.style.overflow = 'hidden';
            einsatzDiv.style.paddingTop = '15px';   
        }
        
        // Information
        const infoDiv = document.createElement('div');
        infoDiv.className = 'einsatzinfo';
        
        // Type and description
        const h1 = document.createElement('h1');
        h1.textContent = `${einsatz.type} - ${einsatz.description}`;
        infoDiv.appendChild(h1);
        
        // Time
        const h4 = document.createElement('h4');
        h4.textContent = `Alarmierung um ${einsatz.time}`;
        infoDiv.appendChild(h4);
        
        // Location (only show if not completed)
        if ((einsatz.status || '').toLowerCase() !== 'completed') {
            const h3 = document.createElement('h3');
            h3.textContent = einsatz.location;
            infoDiv.appendChild(h3);
        }
        
        einsatzDiv.appendChild(infoDiv);
        
        // Fahrzeug section
        const vehiclesDiv = document.createElement('div');
        vehiclesDiv.className = 'fahrzeuge';
        
        if (einsatz.vehicles) {
            const vehicleList = einsatz.vehicles.split(',').map(v => v.trim());     // Split vehicles by comma
            vehicleList.forEach(vehicle => {
                const vehicleSpan = document.createElement('div');
                vehicleSpan.className = 'fzg';
                vehicleSpan.textContent = vehicle;
                vehiclesDiv.appendChild(vehicleSpan);
            });
        }
        
        einsatzDiv.appendChild(vehiclesDiv);
        container.appendChild(einsatzDiv);
        
        console.log(`Created einsatz ${index}: ${einsatz.type} (status: ${einsatz.status})`);
    });
};

async function updateEinsätzeIfChanged() {
    try {
        const newEinsätze = await fetchEinsätzeData();

        if (JSON.stringify(newEinsätze) !== JSON.stringify(currentEinsätze)) {
            console.log('Einsätze data changed, updating UI...');
            currentEinsätze = newEinsätze;
            renderEinsätze(newEinsätze);
            document.dispatchEvent(new CustomEvent('einsätzeUpdated', { detail: newEinsätze }));
        }
    } catch (error) {
        console.error('Error in updateEinsätzeIfChanged:', error);
    }
}

async function initializeEinsätze() {
    const einsätze = await fetchEinsätzeData();
    currentEinsätze = einsätze;
    console.log('Initial einsätze data loaded:', einsätze);

    try {
        renderEinsätze(einsätze);
        document.dispatchEvent(new CustomEvent('einsätzeLoaded', { detail: einsätze }));
    } catch (e) {
        console.error('Error rendering einsätze:', e);
    }
    
    console.log('Starting auto-refresh interval for .einsätze every', EINSÄTZE_UPDATE_INTERVAL / 1000, 'seconds');
    setInterval(updateEinsätzeIfChanged, EINSÄTZE_UPDATE_INTERVAL);

    return einsätze;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEinsätze);
} else {
    setTimeout(initializeEinsätze, 100);
}