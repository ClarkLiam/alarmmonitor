function startTime() {
    const today = new Date();
    let h = today.getHours();
    let m = today.getMinutes();
    let s = today.getSeconds();
    m = checkTime(m);
    s = checkTime(s);
    document.getElementById('clock').innerHTML =  h + ":" + m + ":" + s;
    document.getElementById('clock-bar').textContent =  h + ":" + m + ":" + s;
    setTimeout(startTime, 1000);
}

function checkTime(i) {
    if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
    return i;
}

function getDate() {
    const today = new Date();
    const weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    let day = weekday[today.getDay()];
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return day + ", " + today.toLocaleDateString(undefined, options);
}
function getDateBar() {
    const today = new Date();
    const options = { day: 'numeric', month: 'numeric', year: 'numeric' };
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
}

function startDate() {
    document.getElementById('date').innerHTML = getDate();
    document.getElementById('date-bar').innerHTML = getDateBar();
}