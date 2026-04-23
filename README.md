# 🐾 Petshop Finder Indonesia

Petshop Finder Indonesia adalah aplikasi web interaktif berbasis Progressive Web App (PWA) yang dirancang untuk membantu kamu menemukan petshop terdekat di seluruh Indonesia. Terintegrasi dengan layanan Google Maps Platform (Places & Directions API) untuk menampilkan detail lengkap petshop, termasuk rute terpendek dari lokasimu saat ini.

---

## 🎯 Fitur Utama

- 📍 **Pencarian Terdekat Berbasis Radius**: Temukan petshop dalam radius 3 km hingga 50 km dari koordinat GPS kamu.
- 🚦 **Navigasi & Rute**: Kalkulasi rute langsung ke petshop pilihanmu dari titik awal.
- 📊 **Detail Petshop**: Melihat rating (bintang), jumlah ulasan, jam operasional (buka/tutup), foto tempat, hingga nomor telepon/website.
- 🔍 **Filter Otomatis**: Saring daftar petshop spesifik untuk kebutuhan *Grooming*, *Pet Hotel*, *Vaksin*, atau *Pet Food*.
- 📱 **Mendukung PWA**: Bisa diinstal secara *native* ke homescreen *smartphone* kamu untuk pengalaman full-screen.
- 🌗 **UI/UX Modern**: Desain peta dengan gaya gelap (Dark Theme) kustom dan interaksi map yang responsif.
- ⚡ **Kinerja Optimal**: Menggunakan *caching* berlapis (In-Memory di Backend & LocalStorage di Frontend) agar hemat pemanggilan API Google Maps.

---

## 🚀 Instalasi & Menjalankan di Local

*Perhatian: Meskipun pada versi sebelumnya menggunakan Python untuk local server, repositori ini sekarang berjalan penuh dengan server **Node.js**.*

### Prasyarat
1. Pastikan **[Node.js](https://nodejs.org/en)** (beserta npm) sudah terinstal di komputermu.
2. Memiliki **Google Maps API Key** yang aktif (membutuhkan akses layanan: *Maps JavaScript API, Places API, dan Directions API*).

### Langkah-langkah
1. **Clone repositori ini**:
   ```bash
   git clone https://github.com/Gimm17/peshop-finder-indonesia.git
   cd peshop-finder-indonesia
   ```

2. **Instal dependensi NPM**:
   ```bash
   npm install
   ```
   *(Library yang digunakan sangat minim, seperti `express` dan `dotenv`)*

3. **Atur Environment Variables**:
   Buat file bernama `.env` di *root directory* dan tambahkan Google Maps API Key kamu:
   ```env
   GOOGLE_MAPS_API_KEY=KODE_API_KEY_GOOGLE_MAPS_KAMU
   PORT=3000
   ```

4. **Jalankan Aplikasi**:
   ```bash
   npm run dev
   ```
   *(Atau secara manual menggunakan command `node server.js`)*

5. **Akses lewat Browser**:
   Buka peramban (browser) kamu ke alamat:
   👉 **http://localhost:3000**

---

## 🛠️ Technology Stack
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (ES6)
- **Backend / API Proxy**: Node.js, Express.js
- **Third Party Services**: Google Maps Platform 
- **Utilities**: `dotenv` untuk variabel rahasia.

---

## 📁 Struktur Folder Utama
```text
/
├── server.js              # Entry point utama (Node.js & Express server proxy)
├── package.json           # Informasi & dependencies proyek
├── index.html             # UI utama halaman web
├── sw.js                  # PWA Service Worker (caching files)
├── manifest.json          # PWA App Manifest
├── .env                   # Tempat menyimpan Google Maps API Key
├── PROJECT_DOCUMENTATION.md # Penjelasan teknis detail arsitektur aplikasi
└── static/                # Folder asset
    ├── css/style.css      # Gaya layout (Dark Mode default)
    ├── js/script.js       # Core logic interaksi peta & aplikasi client
    └── icons/             # Kumpulan icon untuk PWA
```

## 📜 Lisensi
Dikembangkan untuk keperluan portofolio, tugas, dan pemanfaatan sistem GIS *(Geographic Information System)* sederhana. Silakan *fork* dan kembangkan lebih lanjut!
