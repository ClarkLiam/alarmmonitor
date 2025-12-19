/**
 * Fetch dienstplan (events) data from Google Sheets tagesplan sheet
 */

const TAGESPLAN_CSV_URL = 'https://docs.google.com/spreadsheets/d/1avBbHGh6RDgBvAvMULAhJq-I5fpow_X7fzIEkzL6L4E/export?format=csv&gid=1859359721';
const DIENSTPLAN_REFRESH_INTERVAL = 60000; // 60 seconds
let currentEvents = [];

function parseEventCSV(csvText) {
    console.log('Parsing dienstplan CSV...');
    const lines = csvText.trim().split('\n');
    
    if (lines.length < 2) {
        console.warn('CSV has fewer than 2 rows');
        return [];
    }
    
    // Parse header row to find column indices
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
    
    // For debugging: assume columns are in order 0, 1, 2, 3, 4
    // Based on user feedback: Title, Date, StartTime, EndTime, Participants
    const titleIdx = 0;
    const dateIdx = 2;
    const startIdx = 3;
    const endIdx = 4;
    const participantsIdx = 1;
    
    console.log('Using column indices - Title:', titleIdx, 'Date:', dateIdx, 'Start:', startIdx, 'End:', endIdx, 'Participants:', participantsIdx);
    
    // Parse event rows
    const events = [];
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
        
        const title = cells[titleIdx] || '';
        const date = cells[dateIdx] || '';
        const startTime = cells[startIdx] || '';
        const endTime = cells[endIdx] || '';
        const participants = cells[participantsIdx] || '';
        
        console.log(`Row ${row}: title="${title}", date="${date}", start="${startTime}", end="${endTime}", participants="${participants}"`);
        
        // Skip empty rows
        if (!title && !startTime && !endTime) continue;
        
        events.push({ title, date, startTime, endTime, participants });
    }
    
    console.log('Parsed events:', events);
    return events;
}

async function fetchDienstplanData() {
    try {
        console.log('Fetching dienstplan data from Google Sheets');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(TAGESPLAN_CSV_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();
        console.log('Fetch successful. CSV length:', csvText.length);
        const result = parseEventCSV(csvText);
        console.log('Events returned:', result);
        return result;
    } catch (error) {
        console.error('Error fetching dienstplan data:', error);
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        return [];
    }
}

function isEventPassed(event) {
    // Parse date (format: "DD.MM.YY")
    const [eventDay, eventMonth, eventYear] = event.date.split('.').map(Number);
    // Adjust year (YY format: assume 20YY)
    const eventYearFull = 2000 + eventYear;
    const eventDate = new Date(eventYearFull, eventMonth - 1, eventDay);
    
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // If event is on a past day, hide it
    if (eventDate < todayDate) {
        return true;
    }
    
    // If event is on a future day, don't hide it
    if (eventDate > todayDate) {
        return false;
    }
    
    // Event is today - check if end time has passed
    const [endHours, endMinutes] = event.endTime.split(':').map(Number);
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    const endTimeInMinutes = endHours * 60 + endMinutes;
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    
    return currentTimeInMinutes >= endTimeInMinutes;
}

function isEventCurrent(event) {
    // Current if: event.date is today AND startTime <= now < endTime
    const [eventDay, eventMonth, eventYear] = (event.date || '').split('.').map(Number);
    if (!eventDay || !eventMonth || isNaN(eventYear)) return false;
    const eventYearFull = 2000 + eventYear; // assumes YY
    const eventDate = new Date(eventYearFull, eventMonth - 1, eventDay);

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (eventDate.getTime() !== todayDate.getTime()) return false;

    const [startHours, startMinutes] = (event.startTime || '').split(':').map(Number);
    const [endHours, endMinutes] = (event.endTime || '').split(':').map(Number);
    if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) return false;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;

    return nowMinutes >= startMinutesTotal && nowMinutes < endMinutesTotal;
}

function eventStartDateObj(event) {
    // Build a Date from event.date (DD.MM.YY) and event.startTime (HH:MM)
    if (!event || !event.date || !event.startTime) return new Date(0);
    const [d, m, y] = event.date.split('.').map(Number);
    const yearFull = 2000 + (isNaN(y) ? 0 : y);
    const [hh, mm] = event.startTime.split(':').map(Number);
    return new Date(yearFull, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

function sortEventsByDateTime(events) {
    // Returns a new array sorted by date then start time
    return [...events].sort((a, b) => {
        const da = eventStartDateObj(a).getTime();
        const db = eventStartDateObj(b).getTime();
        if (da !== db) return da - db;
        // Tie-breaker: end time if available
        const [aeH, aeM] = (a.endTime || '00:00').split(':').map(Number);
        const [beH, beM] = (b.endTime || '00:00').split(':').map(Number);
        const ae = (aeH || 0) * 60 + (aeM || 0);
        const be = (beH || 0) * 60 + (beM || 0);
        return ae - be;
    });
}

function filterAndLimitEvents(events, maxEvents = 8) {
    // Filter out passed events
    const upcomingEvents = events.filter(event => !isEventPassed(event));
    
    // Limit to maxEvents
    return upcomingEvents.slice(0, maxEvents);
}

function renderEvents(events) {
    console.log('Rendering events...');
    
    // Sort, then filter and limit events
    const sorted = sortEventsByDateTime(events);
    const eventsToShow = filterAndLimitEvents(sorted, 8);
    console.log(`Showing ${eventsToShow.length} of ${events.length} events`);
    
    // Find the upcoming-events container
    const container = document.querySelector('.upcoming-events');
    if (!container) {
        console.warn('No .upcoming-events container found');
        return;
    }
    
    // Clear existing events
    container.innerHTML = '';
    
    // Create an event div for each event
    eventsToShow.forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event';
        eventDiv.style.display = 'flex';
        eventDiv.style.justifyContent = 'space-between';
        eventDiv.style.alignItems = 'center';
        eventDiv.style.padding = '8px 12px';
        eventDiv.style.marginBottom = '6px';
        eventDiv.style.paddingBottom = '6px';

        // Store data attributes for live highlighting
        eventDiv.dataset.date = event.date;
        eventDiv.dataset.start = event.startTime;
        eventDiv.dataset.end = event.endTime;

        // Apply current class if happening now
        if (isEventCurrent(event)) {
            eventDiv.classList.add('current');
        }
        
        // Left section (title and participants)
        const leftDiv = document.createElement('div');
        leftDiv.style.flex = '1';
        
        // Event title
        const h1 = document.createElement('h1');
        h1.textContent = event.title;
        h1.style.margin = '0 0 4px 0';
        leftDiv.appendChild(h1);
        
        // Participants text
        if (event.participants) {
            const participantsText = document.createElement('p');
            participantsText.style.fontSize = '0.85em';
            participantsText.style.fontWeight = 'normal';
            participantsText.style.margin = '0';
            participantsText.style.marginTop = '-5px';
            participantsText.style.opacity = '0.85';
            participantsText.textContent = 'Betrifft: ' + event.participants;
            leftDiv.appendChild(participantsText);
        }
        
        eventDiv.appendChild(leftDiv);
        
        // Right section (date - time)
        const timeDiv = document.createElement('div');
        timeDiv.className = 'time';
        timeDiv.style.textAlign = 'right';
        
        // Top line: Date - Start time
        const dateTimeSpan = document.createElement('a');
        dateTimeSpan.textContent = `${event.date} - ${event.startTime}`;
        dateTimeSpan.style.display = 'block';
        dateTimeSpan.style.marginBottom = '2px';
        timeDiv.appendChild(dateTimeSpan);
        
        // End time
        const endSpan = document.createElement('a');
        endSpan.textContent = event.endTime;
        endSpan.style.display = 'block';
        timeDiv.appendChild(endSpan);
        
        eventDiv.appendChild(timeDiv);
        container.appendChild(eventDiv);
        
        console.log(`Created event ${index}: ${event.title}`);
    });
}

function markCurrentEventsInDOM() {
    const items = document.querySelectorAll('.upcoming-events .event');
    const now = new Date();
    items.forEach(item => {
        const date = item.dataset.date || '';
        const start = item.dataset.start || '';
        const end = item.dataset.end || '';
        const [d, m, y] = date.split('.').map(Number);
        const yearFull = 2000 + y;
        const eventDate = new Date(yearFull, (m || 1) - 1, d || 1);
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let isCurrent = false;
        if (eventDate.getTime() === todayDate.getTime()) {
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const sMin = sh * 60 + sm;
                const eMin = eh * 60 + em;
                isCurrent = nowMin >= sMin && nowMin < eMin;
            }
        }
        item.classList.toggle('current', isCurrent);
    });
}

async function updateDienstplanIfChanged() {
    try {
        const newEvents = await fetchDienstplanData();
        
        // Simple change detection: compare JSON strings
        if (JSON.stringify(newEvents) !== JSON.stringify(currentEvents)) {
            console.log('Dienstplan data changed, updating UI...');
            currentEvents = newEvents;
            renderEvents(newEvents);
            document.dispatchEvent(new CustomEvent('dienstplanUpdated', { detail: newEvents }));
        }
    } catch (error) {
        console.error('Error in updateDienstplanIfChanged:', error);
    }
}

async function initializeDienstplan() {
    const events = await fetchDienstplanData();
    currentEvents = events;
    console.log('Initial dienstplan data loaded:', events);

    try {
        renderEvents(events);
        // Initial marking of current events
        markCurrentEventsInDOM();
        document.dispatchEvent(new CustomEvent('dienstplanLoaded', { detail: events }));
    } catch (e) {
        console.error('Error rendering dienstplan:', e);
    }
    
    // Start polling for changes
    console.log('Starting dienstplan auto-refresh interval every', DIENSTPLAN_REFRESH_INTERVAL / 1000, 'seconds');
    setInterval(updateDienstplanIfChanged, DIENSTPLAN_REFRESH_INTERVAL);
    // Refresh current-event markers every 30s
    setInterval(markCurrentEventsInDOM, 30000);

    return events;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDienstplan);
} else {
    setTimeout(initializeDienstplan, 100);
}
