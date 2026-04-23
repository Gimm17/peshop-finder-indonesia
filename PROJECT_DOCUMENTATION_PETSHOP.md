# Dokumentasi Proyek: Petshop Finder Indonesia

## 1. Tentang Proyek
**Petshop Finder Indonesia** adalah sebuah aplikasi web interaktif berbasis PWA (Progressive Web App) yang dirancang untuk membantu pengguna menemukan toko hewan peliharaan (petshop) terdekat di seluruh wilayah Indonesia. Aplikasi ini memungkinkan pengguna untuk melihat detail informasi seperti rating, jumlah review, informasi operasional (jam buka/tutup), serta membuat rute (navigasi) langsung ke lokasi petshop dari lokasi pengguna saat ini.

Meskipun pada nama folder terdapat istilah "dijkstra", perutean aktual dalam aplikasi ini memanfaatkan layanan komprehensif dari *Google Maps Directions Service* (yang secara fundamental di bawah permukaan memang memproses graf dengan optimasi jarak terpendek seperti A* atau Dijkstra).

## 2. Technology Stack (Teknologi yang Digunakan)
Aplikasi ini dikembangkan dengan arsitektur web yang modern, ringan, namun fungsional:

### Frontend (Klien):
- **HTML5 & CSS3**: Digunakan untuk menyusun kerangka antarmuka dan styling. Sistem layout menggunakan *Vanilla CSS* dengan variabel *custom* untuk tema tanpa bergantung pada framework CSS eksternal.
- **Vanilla JavaScript (ES6+)**: Logika utama antarmuka pengguna (`script.js`).
- **PWA (Progressive Web App)**: Dilengkapi dengan `manifest.json` dan *Service Worker* (`sw.js`) sehingga dapat diinstal langsung ke perangkat pintar pengguna layaknya aplikasi native mobile.

### Backend (Server/Proxy):
- **Node.js & Express.js**: Berperan sebagai *micro-server* (`server.js`) untuk melayani *static files* (HTML/CSS/JS) sekaligus bertindak sebagai *API Proxy*.
- **Google Maps Platform**:
  - *Maps JavaScript API*: Untuk memuat *instance* peta interaktif dan menampilkan *custom markers*.
  - *Places API*: Dieksekusi melalui *backend proxy* untuk fitur `textSearch` (pencarian kata), `nearbySearch` (pencarian berbasis radius terdekat), dan *Place Details* (detail lengkap lokasi).
  - *Directions API*: Dikelola di *frontend* untuk menggambar garis navigasi dari titik A (pengguna) ke titik B (petshop).

### Utilities:
- **dotenv**: Untuk melindungi dan mengelola *environment variables* (seperti `GOOGLE_MAPS_API_KEY`) di environment server.

## 3. Arsitektur Sistem
Proyek ini mengimplementasikan pola **Client-Server Proxy API** sederhana:

1. **Client (Browser/PWA)**: Bertugas berinteraksi dengan pengguna, menangani akses HTML5 Geolocation API, mengelola navigasi UI, me-render tampilan peta, dan melakukan perhitungan jarak algoritma Haversine lokal.
2. **Backend Proxy (Express Server)**: Berada di posisi tengah untuk menangani permintaan HTTP klien menuju layanan Google. *Client* dilarang memanggil `Places API` secara langsung. Ini dilakukan demi **keamanan** (menghindari ekspos *API Key* di *Network Tab* Klien) serta mencegah masalah larangan akses *CORS (Cross-Origin Resource Sharing)* dari Google.
3. **Data Source**: Server Google secara *real-time* menyediakan *metadata* tempat, lalu dikirimkan kembali sebagai JSON yang *clean* oleh Node.js ke antarmuka klien.

## 4. Detail Logic (Logika Sistem & Proses)

- **Sistem Pencarian Berbasis Lokasi & Radius**: 
  Aplikasi akan mencoba mendapatkan koordinat pengguna. Jika diizinkan, aplikasi membuat permintaan ke backend `/api/petshops` dengan parameter lintang (*lat*), bujur (*lng*), dan besaran *radius* (default: 5.000 meter / 5 km). Jika GPS ditolak, aplikasi akan *fallback* ke lokasi tengah Indonesia yang dikonfigurasi pada `/config.js`.

- **Mekanisme *Caching* Bertingkat**:
  Untuk mengefisienkan panggilan API berbayar:
  1. ***Backend In-Memory Cache***: Node.js menyimpan hasil pencarian (*Search*) selama 10 menit, dan detail tempat spesifik (*Details*) selama 30 menit ke memori internal (`Map`).
  2. ***Frontend LocalStorage Cache***: Browser menyimpan histori *response* yang berhasil (maks. 5 lokasi) di `localStorage` (TTL: 5 menit). Ketika pengguna me-refresh halaman, aplikasi akan me-*load* data lokal ini terlebih dahulu.

- **Proxy Foto *(Photo Proxy)***:
  Google membatasi akses URL asli gambar secara langsung. Backend membuat *endpoint* `/api/photo?ref={photo_reference}`. Express.js akan me-*request* URL tersebut, menangkap respons *HTTP Redirect* (3xx) dari Google, lalu meneruskan pengalihan URL aslinya ke klien agar foto bisa di-render di antarmuka UI.

- **Perhitungan Jarak & Pengurutan (Sorting)**:
  Terdapat fitur pengurutan (Terdekat, Populer, Rating, dll). Untuk urutan "Terdekat", Klien melakukan *filtering* dan kalkulasi ulang secara mandiri membandingkan koordinat GPS pengguna dengan properti tiap penanda (marker) menggunakan rumus matematika **Haversine Formula**.

- **Algoritma Filter (Tagging Berbasis Kata Kunci)**:
  Pengguna bisa mempersempit daftar petshop berdasarkan tag (contoh: *Grooming*, *Hotel*, *Vaksin*, atau *Pet Food*). Di balik layar, JS melakukan fungsi *Substring Matching* yang mengecek apakah properti `nama`, `alamat`, atau `tipe data (types)` Google Places memiliki kecocokan (*match*) dengan *array of string keyword*.

- **Deduplikasi Array Objek (Penghapusan Duplikat)**:
  Pada Backend, gabungan data antara `textSearch` dan `nearbySearch` sering menghasilkan titik kembar. Server menyelesaikan masalah ini dengan *Data Structure: Set()*, sehingga iterasi ID (menggunakan `place_id`) yang sama akan langsung diabaikan / diblokir dari array final.

## 5. Models (Struktur Data)
Aplikasi ini bersifat *stateless* (tidak terikat DB seperti MySQL atau MongoDB) karena bertumpu pada sumber data API eksternal yang di-*proxy*. Di sisi aplikasi (klien JS), model data Petshop dinormalisasi (*normalization*) menjadi objek seperti berikut:

```javascript
// Representasi Data Objek Model Petshop di state.places
{
  "id": "ChI...", // ID Spesifik Google Place
  "dedupeKey": "nama-toko|-6.2|106.8", // Kunci Unik Pencegah Duplikasi
  "name": "Klinik & Petshop Anabul Sejahtera",
  "lat": -6.2144, // Garis Lintang
  "lng": 106.8451, // Garis Bujur
  "rating": 4.8, // Rating bintang Google Maps (1.0 - 5.0)
  "userRatingsTotal": 310, // Total ulasan oleh pengguna
  "address": "Jl. Kucing Persia No. 1",
  "openNow": true, // Boolean (Sedang Buka atau Tutup)
  "types": ["pet_store", "point_of_interest", "establishment"],
  "distanceMeters": 1500, // Hasil kalkulasi Haversine di Klien
  "popularityScore": 540 // Hasil komputasi dari: (Rating x Total Review)
}
```

## 6. Fitur & Kelebihan Ekstra
1. **Dukungan Progressive Web Apps (PWA)**: Menampilkan *banner* instalasi otomatis di perangkat *mobile*. Saat di-*install*, aplikasi terasa dan beroperasi tanpa antarmuka *browser URL bar*.
2. **Dark Theme Custom Maps**: Tampilan peta tidak menggunakan gaya generik Google, melainkan diinjeksi dengan array *JSON stylers* khusus (`#1d2c4d`, `#283d6a`) untuk *ambience mode gelap*.
3. **Optimasi Asset Custom Marker (SVG)**: Marker penunjuk lokasi (*pin*) tidak mengambil file eksternal (seperti `.png`), melainkan di-*render* langsung dari *XML String path SVG* berbentuk wajah kucing. Ini menghemat satu ekstra *HTTP Request* yang sering menimbulkan masalah performa UI pada pemuatan awal.
