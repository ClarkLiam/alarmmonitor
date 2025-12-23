/**
 * Fetch personal data from Google Sheets
 */

const PERSONAL_CSV_URL = "https://docs.google.com/spreadsheets/d/1avBbHGh6RDgBvAvMULAhJq-I5fpow_X7fzIEkzL6L4E/export?format=csv&gid=1073488461";
const PERSONAL_UPDATE_INTERVAL = 120000; // 120 seconds
let currentPersonal = [];

function parsePersonalCSV(csvText) {
    console.log('Parsing personal CSV...');
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
    
    const maschinenIdx = 1;      
    const gruppenIdx = 2;        
    const jugendwärteIdx = 3;    
    const jugendlicheIdx = 4;    
    
    console.log('Using column indices - Maschinisten:', maschinenIdx, 'Gruppenführer:', gruppenIdx, 'Jugendwärte:', jugendwärteIdx, 'Jugendliche:', jugendlicheIdx);
    
    const allRows = [];
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
        
        // Log all cells for debugging
        console.log(`Row ${row} all cells:`, cells);
        allRows.push(cells);
    }
    
    const personal = [];
    
    if (allRows.length >= 3) {
        const nahRow = allRows[0];      
        const mittelnahRow = allRows[1];
        const fernRow = allRows[2];     
        
        // Maschinisten
        personal.push({
            category: 'Maschinisten',
            nah: nahRow[maschinenIdx] || '0',
            mittelnah: mittelnahRow[maschinenIdx] || '0',
            fern: fernRow[maschinenIdx] || '0'
        });
        
        // Gruppenführer
        personal.push({
            category: 'Gruppenführer',
            nah: nahRow[gruppenIdx] || '0',
            mittelnah: mittelnahRow[gruppenIdx] || '0',
            fern: fernRow[gruppenIdx] || '0'
        });
        
        // Jugendwärte
        personal.push({
            category: 'Jugendwärte',
            nah: nahRow[jugendwärteIdx] || '0',
            mittelnah: mittelnahRow[jugendwärteIdx] || '0',
            fern: fernRow[jugendwärteIdx] || '0'
        });
        
        // Jugendliche
        personal.push({
            category: 'Jugendliche',
            nah: nahRow[jugendlicheIdx] || '0',
            mittelnah: mittelnahRow[jugendlicheIdx] || '0',
            fern: fernRow[jugendlicheIdx] || '0'
        });
    }
    
    console.log('Parsed personal:', personal);
    return personal;
}

async function fetchPersonalData() {
    try {
        console.log('Fetching personal data from Google Sheets');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(PERSONAL_CSV_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        return parsePersonalCSV(csvText);
    } catch (error) {
        console.error('Error fetching personal data:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        return [];
    }
}

function updatePersonalDisplay(personal) {
    console.log('Updating personal display...');
    
    // Find all personal-box elements
    const personalBoxes = document.querySelectorAll('#personal .personal-box');
    
    personalBoxes.forEach((box, index) => {
        const h2 = box.querySelector('h2');
        if (!h2) return;
        
        const categoryName = h2.textContent.trim();
        console.log(`Looking for category: ${categoryName}`);
        
        // Find matching data from parsed personal array
        const data = personal.find(p => p.category === categoryName);
        
        if (data) {
            console.log(`Found data for ${categoryName}:`, data);
            
            // Update the three values
            const amounts = box.querySelectorAll('.amount a');
            if (amounts.length >= 5) {
                amounts[0].textContent = data.nah;
                amounts[2].textContent = data.mittelnah;
                amounts[4].textContent = data.fern;
                console.log(`Updated ${categoryName}: nah=${data.nah}, mittelnah=${data.mittelnah}, fern=${data.fern}`);
            }
        } else {
            console.warn(`No data found for category: ${categoryName}`);
        }
    });
}

async function updatePersonalIfChanged() {
    const personal = await fetchPersonalData();
    
    if (personal.length === 0) {
        console.warn('No personal data received');
        return;
    }
    
    // Check if data has changed
    const personalJSON = JSON.stringify(personal);
    const currentJSON = JSON.stringify(currentPersonal);
    
    if (personalJSON !== currentJSON) {
        console.log('Personal data has changed, updating display');
        currentPersonal = personal;
        updatePersonalDisplay(personal);
    } else {
        console.log('Personal data unchanged');
    }
}

async function initializePersonalData() {
    console.log('Initializing personal data...');
    await updatePersonalIfChanged();
    
    // Set up periodic updates
    setInterval(updatePersonalIfChanged, PERSONAL_UPDATE_INTERVAL);
    console.log(`Personal data will refresh every ${PERSONAL_UPDATE_INTERVAL / 1000} seconds`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePersonalData);
} else {
    initializePersonalData();
}
