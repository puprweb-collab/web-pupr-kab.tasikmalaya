// Inisialisasi peta
const map = L.map('map').setView([-7.3274, 108.2207], 13); // Koordinat Tasikmalaya
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// IndexedDB untuk penyimpanan offline
let db;
const request = indexedDB.open('SurveyDB', 1);
request.onupgradeneeded = (event) => {
    db = event.target.result;
    const store = db.createObjectStore('locations', { keyPath: 'id', autoIncrement: true });
    store.createIndex('zone', 'zone', { unique: false });
};
request.onsuccess = (event) => {
    db = event.target.result;
    loadLocations();
};

// Fungsi untuk mendapatkan lokasi GPS
document.getElementById('getLocation').addEventListener('click', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 15);
            L.marker([lat, lng]).addTo(map).bindPopup('Lokasi Anda').openPopup();
            alert(`Koordinat: ${lat}, ${lng}`);
        });
    } else {
        alert('GPS tidak didukung.');
    }
});

// Tambah lokasi
document.getElementById('locationForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const description = document.getElementById('description').value;
    const zone = document.getElementById('zone').value;
    const location = { name, description, zone, lat: map.getCenter().lat, lng: map.getCenter().lng };
    addLocation(location);
    document.getElementById('locationForm').reset();
});

// Fungsi CRUD
function addLocation(location) {
    const transaction = db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    store.add(location);
    transaction.oncomplete = () => loadLocations();
}

function loadLocations() {
    const list = document.getElementById('locationList');
    list.innerHTML = '';
    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${cursor.value.name} (${cursor.value.zone}) - ${cursor.value.lat}, ${cursor.value.lng}</span>
                <button class="edit" onclick="editLocation(${cursor.key})">Edit</button>
                <button class="delete" onclick="deleteLocation(${cursor.key})">Hapus</button>
            `;
            list.appendChild(li);
            cursor.continue();
        }
    };
}

function editLocation(id) {
    // Logika edit sederhana (bisa diperluas)
    alert('Fitur edit belum lengkap. Gunakan console untuk debug.');
}

function deleteLocation(id) {
    const transaction = db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    store.delete(id);
    transaction.oncomplete = () => loadLocations();
}