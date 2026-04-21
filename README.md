# 108 Again

A clean, offline-first meditation tracker designed specifically for **Ngöndro practice**.
Track repetitions, visualize progress, estimate completion dates, and sync across devices.

---

# ✨ Features

## Core Features

* Track multiple practices
* Add or edit practices
* Circular swipe navigation between practices
* Quick add repetitions
* Target date estimation
* Progress visualization
* Calendar-based tracking
* Practice history with all-time stats
* Daily streak tracking
* Celebration animations when reaching targets

---

## Advanced Features

* Offline-first architecture
* SQLite local database
* Supabase cloud sync
* Write queue for safe syncing
* Soft delete support
* Backup export / import (JSON)
* GDPR-compliant privacy modal
* Account management
* Responsive UI (phones + tablets)

---

# 📱 Screens

## Dashboard

* Multiple practices overview
* Progress bars
* Total / target counts
* Target date estimation
* Quick add buttons
* Streak tracking

## Practice Detail

* Circular swipe navigation
* Practice image
* Total progress
* Quick add repetitions
* Editable target date
* Calendar view
* Practice history view
* Edit practice view
* Daily adjustments

## Account Screen

* User info
* Sync status
* Sync now
* Sign out
* Privacy & Data
* Delete account

## About Screen

* App information
* Version number
* Developer info
* Contact details

---

# 🧠 Architecture

## Tech Stack

* React Native (Expo)
* TypeScript
* Expo Router
* SQLite (local)
* Supabase (cloud sync)

---

## Database

### Local (SQLite)

Tables:

* practices
* sessions
* deleted_records
* profile
* app_meta

### Remote (Supabase)

Tables:

* practices
* sessions
* user_profiles

---

# 🔄 Sync Architecture

* Offline-first
* Write queue
* Mutex-protected writes
* Soft delete sync
* Supabase cron cleanup

Cleanup schedule:

* sessions → 30 days
* practices → 60 days

---

# 💾 Backup System

* Export JSON
* Import JSON
* Validation
* Versioning
* Error handling

---

# 🎨 UI Features

* Responsive design
* Tablet support
* Centered layouts
* Modal system
* Header navigation
* Touch-friendly interactions

---

# 🔐 Privacy

* GDPR compliant
* Local-first data storage
* Optional cloud sync
* Account deletion
* Privacy policy modal

---

# 🚀 Getting Started

Install dependencies:

```
npm install
```

Start development:

```
npx expo start
```

Run on device:

```
npx expo run:android
npx expo run:ios
```

---

# 📱 Supported Platforms

* iOS
* Android
* Tablet layouts supported

---

# 🧭 Navigation

* Tap header title to return to dashboard
* Swipe between practices
* 3-dot menu for advanced options

---

# 🔧 Development

Useful commands:

```
npm start
npx expo start -c
npx depcheck
```

---

# 👤 Developer

Gian Piero Bandieramonte
