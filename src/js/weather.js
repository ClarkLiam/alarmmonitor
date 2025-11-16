const apiKey = 'e7901d338ed7c62071bd19935f80be00';
const apiUrl = 'https://api.openweathermap.org/data/2.5/weather';





const locationElement = document.getElementById('location');
const temperatureElement = document.getElementById('temperature');
const iconElement = document.getElementById('icon');
const windElement = document.getElementById('wind');
const rainElement = document.getElementById('rain');
const cloudElement = document.getElementById('cloud');
const visibilityElement = document.getElementById('visibility');
const humidityElement = document.getElementById('humidity');
const pressureElement = document.getElementById('pressure');


function fetchWeather(location) {
    const url = `${apiUrl}?q=${location}&appid=${apiKey}&units=metric`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            locationElement.textContent = data.name;
            temperatureElement.textContent = `${Math.round(data.main.temp)}°C`;
            windElement.textContent = `${data.wind.speed} km/h`;
            rainElement.textContent = data.rain ? `${data.rain['1h']} mm` : '0 mm';
            cloudElement.textContent = data.clouds ? `${data.clouds.all}%` : '0%';
            iconElement.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}.png`;
            visibilityElement.textContent = `${data.visibility / 1000} km`;
            humidityElement.textContent = `${data.main.humidity}%`;
            pressureElement.textContent = `${data.main.pressure} hPa`;

        })
        .catch(error => {
            console.error('Error fetching weather data:', error);
        });
}