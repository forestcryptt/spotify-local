# 🎵 Spotify Local (Spotify Library Parser & Playlist Sorter)

> Потужний TypeScript CLI-інструмент для локального парсингу вашої бібліотеки Spotify (Liked Songs) та автоматичного сортування треків по плейлістам (за жанрами, десятиліттями, артистами або кастомними правилами).

---

## 🚀 Можливості

- 🔐 **Зручна авторизація (OAuth2)**: локальний веб-сервер відкриває браузер і зберігає токени з автоматичним оновленням (auto-refresh).
- 📥 **Повний парсинг збереженої музики ("Liked Songs")**:
  - Завантажує всі треки користувача з пагінацією та захистом від rate-limit.
  - Автоматично витягує метадані виконавців та їхні жанри (Spotify присвоює жанри саме артистам).
- 💾 **Локальний кеш та офлайн-робота**:
  - Зберігає вашу бібліотеку в `data/library.json` та виконавців у `data/artists.json`.
  - Можна експериментувати та сортувати музику без повторних запитів до API.
- 🗂 **Гнучке сортування по плейлістам**:
  - **За жанрами (`--by genre`)**: розумний мапінг мікро-жанрів Spotify у базові категорії (Rock, Metal, Hip-Hop, Electronic, Pop, Indie & Folk, Jazz/Blues, Ambient/Lo-Fi, Classical, Ukrainian Music).
  - **За десятиліттями (`--by decade`)**: 70s, 80s, 90s, 2000s, 2010s, 2020s.
  - **За артистами (`--by artist`)**: окремі плейлісти для артистів, у яких збережено $\ge N$ треків.
  - **За кастомними правилами (`--by rules`)**: конфігурується через `config/default-rules.json` (за ключовими словами, назвами, жанрами чи діапазонами років).
- 🔍 **Безпечний Dry-run (попередній перегляд)**: переглядайте сформовані плейлісти у красивій таблиці терміналу перед додаванням у Spotify.
- 🔄 **Автоматична синхронізація (`--sync`)**: створює або оновлює плейлісти у вашому акаунті Spotify, додаючи треки батчами по 100 штук та уникаючи дублікатів.
- 📊 **Експорт даних**: експорт бібліотеки у CSV або JSON.

---

## 🛠 Швидкий старт

### 1. Встановлення залежностей

```bash
npm install
```

### 2. Створення додатку в Spotify Developer Dashboard

1. Перейдіть до [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) та увійдіть зі своїм акаунтом Spotify.
2. Натисніть **"Create App"**:
   - **App name**: `Spotify Local Sorter` (або будь-яка інша назва)
   - **App description**: `Local playlist manager`
   - **Redirect URIs**: додайте:
     ```text
     http://127.0.0.1:8888/callback
     ```
   - Увімкніть **Web API** та погодьтеся з умовами.
3. У налаштуваннях додатку (Settings) скопіюйте **Client ID** та **Client Secret**.

### 3. Налаштування `.env`

Скопіюйте `.env.example` у `.env` та вкажіть отримані ключі:

```bash
cp .env.example .env
```

Відкрийте `.env` і заповніть:
```env
SPOTIFY_CLIENT_ID=ваш_client_id
SPOTIFY_CLIENT_SECRET=ваш_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
PORT=8888
PLAYLIST_PREFIX=[Auto] 
```

---

## 💻 Використання

### Крок 1. Авторизація у Spotify

```bash
npm run login
```
*Відкриється сторінка у браузері для надання дозволу. Після успіху токени збережуться локально у `.cache/tokens.json`.*

Перевірити статус підключення:
```bash
npm run status
```

---

### Крок 2. Завантаження бібліотеки (Fetch)

```bash
npm run fetch
```
*Завантажує всі ваші "Улюблені треки" та жанри артистів, зберігаючи їх у `data/library.json`.*

---

### Крок 3. Сортування та попередня оцінка (Dry Run)

Побачити таблицю згенерованих плейлістів без змін у Spotify:

```bash
# Сортування за жанрами (за замовчуванням)
npm run sort -- --by genre

# Сортування за десятиліттями (80s, 90s, 2000s, 2010s, тощо)
npm run sort -- --by decade

# Сортування за артистами (мінімум 5 треків)
npm run sort -- --by artist --min-tracks 5

# Сортування за правилами з конфігураційного файлу
npm run sort -- --by rules
```

Параметри команди `sort`:
- `-b, --by <genre|decade|artist|rules>` — режим сортування.
- `-p, --prefix <string>` — префікс перед назвою створеного плейліста (за замовчуванням `[Auto] `).
- `-m, --min-tracks <number>` — мінімальна кількість треків для створення плейліста (за замовчуванням: 5).
- `-r, --rules <path>` — власний JSON-файл із правилами.
- `-e, --export` — зберегти сформовані плейлісти у `data/sorted_playlists.json`.
- `-s, --sync` — створити / оновити плейлісти безпосередньо у Spotify!

---

### Крок 4. Синхронізація у Spotify

Коли ви задоволені результатом попереднього перегляду:

```bash
# Відправити плейлісти за жанрами у Spotify:
npm run sort -- --by genre --sync

# Або спеціальною командою sync:
npm run sync -- --by genre
```

*Скрипт перевірить, чи вже існують такі плейлісти у вашому акаунті: якщо існують — додасть лише нові треки (без дублікатів); якщо ні — створить нові приватні плейлісти.*

---

### Крок 5. Експорт бібліотеки

Експортувати всю збережену музику у CSV (для Excel/Google Sheets):
```bash
npm run export -- --format csv
```
Файл буде збережено у `data/library.csv`.

---

## ⚙️ Кастомні правила (`config/default-rules.json`)

Ви можете створити власні плейлісти з будь-якими критеріями у файлі `config/default-rules.json`:

```json
[
  {
    "id": "synthwave-vibes",
    "name": "Night Drive & Synthwave",
    "description": "Retrowave, synthwave and darksynth tracks",
    "genres": ["synthwave", "retrowave", "darksynth", "outrun"]
  },
  {
    "id": "ukrainian-rock",
    "name": "Ukrainian Rock",
    "genres": ["ukrainian rock", "ukrainian alternative"]
  },
  {
    "id": "acoustic",
    "name": "Acoustic & Unplugged",
    "keywords": ["acoustic", "unplugged", "live"]
  }
]
```

---

## 📁 Структура проекту

```
spotify-local/
├── .env.example          # Зразок конфігурації
├── .gitignore            # Захист токенів та локальних кешів
├── package.json          # Скрипти та залежності
├── tsconfig.json         # Налаштування TypeScript (NodeNext / ES2022)
├── README.md             # Документація проекту
├── config/
│   └── default-rules.json# Правила сортування за замовчуванням
├── src/
│   ├── index.ts          # CLI-інтерфейс (Commander)
│   ├── config.ts         # Завантаження та валідація змінних середовища
│   ├── auth/
│   │   ├── oauth.ts      # Авторизаційний сервер та обмін токенів
│   │   ├── token-storage.ts # Збереження та перевірка строку дії токенів
│   │   └── types.ts      # Типи токенів
│   ├── api/
│   │   ├── client.ts     # Клієнт Spotify API (retry, rate-limit, pagination)
│   │   └── types.ts      # Типи об'єктів Spotify API та внутрішньої моделі
│   ├── services/
│   │   ├── library.ts    # Завантаження та кешування треків і виконавців
│   │   ├── genre-mapper.ts# Класифікація мікро-жанрів Spotify
│   │   ├── sorter.ts     # Логіка сортування (жанри, декади, артисти, правила)
│   │   ├── playlist-sync.ts # Синхронізація зі Spotify (дедуплікація, батчі)
│   │   └── exporter.ts   # Експорт у CSV / JSON
│   └── utils/
│       ├── cache.ts      # Читання/запис локальних файлів
│       └── logger.ts     # Стилізований вивід у термінал
```

---

## 📄 Ліцензія

MIT
