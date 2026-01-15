// Variabel global
let db;
let markers = []; // Array untuk marker lokasi
let drawnPolygons = []; // Array untuk polygon zona
let drawControl; // Kontrol draw polygon

// Inisialisasi peta
const map = L.map('map').setView([-7.3274, 108.2207], 13); // Koordinat Tasikmalaya
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Tambah kontrol draw untuk polygon
drawControl = new L.Control.Draw({
    draw: {
        polygon: true,
        marker: false,
        circle: false,
        rectangle: false,
        polyline: false
    },
    edit: {
        featureGroup: new L.FeatureGroup().addTo(map)
    }
});
map.addControl(drawControl);

// Event saat polygon selesai digambar
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    layer.addTo(map);
    const latlngs = layer.getLatLngs()[0];
    const zoneName = prompt('Nama zona polygon ini?');
    if (zoneName) {
        drawnPolygons.push({ name: zoneName, layer: layer });
        document.getElementById('polygonInfo').innerHTML += `<p>Zona "${zoneName}" dibuat dengan ${latlngs.length} titik.</p>`;
    }
});

// IndexedDB untuk penyimpanan offline
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

// Event untuk pencarian real-time
document.getElementById('search').addEventListener('input', loadLocations);

// Event untuk tombol draw polygon
document.getElementById('drawPolygon').addEventListener('click', () => {
    new L.Draw.Polygon(map, drawControl.options.draw).enable();
});

// Event untuk tombol hapus polygon
document.getElementById('deletePolygon').addEventListener('click', () => {
    if (drawnPolygons.length === 0) {
        alert('Tidak ada zona polygon untuk dihapus.');
        return;
    }
    const zoneNames = drawnPolygons.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const choice = prompt(`Pilih zona untuk hapus (masukkan nomor):\n${zoneNames}`);
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < drawnPolygons.length) {
        map.removeLayer(drawnPolygons[index].layer);
        drawnPolygons.splice(index, 1);
        document.getElementById('polygonInfo').innerHTML = '';
        alert('Zona dihapus.');
    } else {
        alert('Pilihan tidak valid.');
    }
});

// Tambah lokasi
document.getElementById('locationForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const description = document.getElementById('description').value;
    const existingZone = document.getElementById('zone').value;
    const newZone = document.getElementById('newZone').value;
    const zone = newZone || existingZone;
    if (!zone) {
        alert('Pilih zona existing atau buat zona baru!');
        return;
    }
    const location = { name, description, zone, lat: map.getCenter().lat, lng: map.getCenter().lng };
    addLocation(location);
    document.getElementById('locationForm').reset();
});

// Fungsi CRUD
function addLocation(location) {
    const transaction = db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    store.add(location);
    transaction.oncomplete = (event) => {
        const addedId = event.target.result;
        loadLocations();
        const marker = L.marker([location.lat, location.lng]).addTo(map)
            .bindPopup(`${location.name} (${location.zone})`);
        marker.options.customId = addedId;
        markers.push(marker);
    };
}

function loadLocations() {
    const list = document.getElementById('locationList');
    const zoneSelect = document.getElementById('zone');
    const searchValue = document.getElementById('search').value.toLowerCase();
    list.innerHTML = '';
    zoneSelect.innerHTML = '<option value="">Pilih Zona Existing</option>';
    const zones = new Set();

    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const loc = cursor.value;
            zones.add(loc.zone);

            if (loc.name.toLowerCase().includes(searchValue) || loc.zone.toLowerCase().includes(searchValue)) {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${loc.name} (${loc.zone}) - ${loc.lat}, ${loc.lng}</span>
                    <button class="edit" onclick="editLocation(${cursor.key})">Edit</button>
                    <button class="delete" onclick="deleteLocation(${cursor.key})">Hapus</button>
                `;
                list.appendChild(li);

                const marker = L.marker([loc.lat, loc.lng]).addTo(map)
                    .bindPopup(`${loc.name} (${loc.zone})`);
                marker.options.customId = cursor.key;
                markers.push(marker);
            }
            cursor.continue();
        } else {
            zones.forEach(zone => {
                const option = document.createElement('option');
                option.value = zone;
                option.textContent = zone;
                zoneSelect.appendChild(option);
            });
        }
    };
}

function editLocation(id) {
    const transaction = db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const request = store.get(id);
    request.onsuccess = (event) => {
        const location = event.target.result;
        const newName = prompt('Edit nama lokasi:', location.name);
        const newDesc = prompt('Edit deskripsi:', location.description);
        const newZone = prompt('Edit zona:', location.zone);
        const newLat = parseFloat(prompt('Edit latitude:', location.lat));
        const newLng = parseFloat(prompt('Edit longitude:', location.lng));
        if (newName && newDesc && newZone && !isNaN(newLat) && !isNaN(newLng)) {
            const updatedLocation = { ...location, name: newName, description: newDesc, zone: newZone, lat: newLat, lng: newLng };
            const updateTransaction = db.transaction(['locations'], 'readwrite');
            const updateStore = updateTransaction.objectStore('locations');
            updateStore.put(updatedLocation);
            updateTransaction.oncomplete = () => loadLocations();
        }
    };
}

function deleteLocation(id) {
    markers = markers.filter(marker => {
        if (marker.options.customId === id) {
            map.removeLayer(marker);
            return false;
        }
        return true;
    });
    const transaction = db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    store.delete(id);
    transaction.oncomplete = () => loadLocations();
}