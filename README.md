# 🚀 KroGram - Serverless Chat & VoIP Platform

Это техническая документация о текущем состоянии архитектуры проекта, специально подготовленная для разработчиков и AI-кодеров (например, c0dex), чтобы быстро погрузиться в проект без лишних вопросов.

---

## 🏙 Общая архитектура
KroGram полностью мигрировал со старой серверной архитектуры (Python/FastAPI + Docker) на современную **Serverless-модель**. 

- **Frontend:** React + Vite + Typescript + Zustand (сборка на Vercel).
- **Backend / Database:** Supabase (глобально распределенная БД PostgreSQL).
- **CI/CD pipeline:** Любые локальные изменения пушатся через скрипт `update_cloud.bat` на GitHub, откуда Vercel автоматически перехватывает код и делает деплой в сеть (`https://krogram.vercel.app`).
- **УСТАРЕВШЕЕ:** Папка `backend` и файлы `run.bat` / `docker-compose.yml` больше не используются для деплоя или работы в интернете. Оставлены исключительно как архив.

---

## 🔑 Ключи доступа и Конфигурация (Supabase)
Всё взаимодействие происходит напрямую через библиотеку `@supabase/supabase-js` во фронтенде (файл `frontend/src/services/supabase.ts`).

- **Project URL:** `https://fjiufsyrzoymdhrabnog.supabase.co`
- **Anon Public API Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqaXVmc3lyem95bWRocmFibm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTYwMDcsImV4cCI6MjA4OTU5MjAwN30.sm4lzrBjPI2YDyVM9yfKmxkFOqA8oRXrirgaqb_HlTQ`
- *Безопасность (RLS):* На данный момент **Row Level Security ВЫКЛЮЧЕНО** (`DISABLE ROW LEVEL SECURITY`) для всех таблиц, чтобы обеспечить беспрепятственную работу API без сложной настройки политик Supabase Auth на прототипе.

---

## 💾 Структура Базы Данных (PostgreSQL)
Все таблицы управляются напрямую в Supabase:

1. **`users`** - Профили (`id`, `username`, `password`, `avatar_url`, `created_at`). *Примечание: `phone` столбец стал необязательным после перехода на Login/Password.*
2. **`servers`** - Серверные сообщества (`id`, `name`, `icon_url`, `owner_id`).
3. **`channels`** - Текстовые и голосовые комнаты внутри серверов или DM (`id`, `name`, `type`, `server_id`, `is_dm`).
4. **`user_server`** - Связь многие-ко-многим (какие юзеры на каких серверах).
5. **`user_dm_channel`** - Кто находится в конкретном DM-канале.
6. **`messages`** - Все сообщения платформы (`id`, `content`, `media_url`, `media_type`, `sender_id`, `channel_id`).
7. **`friend_requests`** - Запросы в друзья (`id`, `from_user_id`, `to_phone`, `status`). *Важно: колонка `to_phone` используется как legacy-контейнер для хранения `username` того пользователя, которому отправлен запрос.*

---

## 🔥 Ключевые Фичи и Модули

### 1. Unified API Wrapper (`frontend/src/services/api.ts`)
Все старые Axios запросы сымитированы через методы Supabase. При вызове `api.get` или `api.post` мост обращается к нужной таблице PostgreSQL. Возвращает объект в формате `{ data: { ... } }`, поэтому ни один React-компонент переписывать не пришлось.

### 2. Realtime Мессенджер (`frontend/src/services/socket.ts`)
Работает без классических кастомных WebSockets. Использует нативный `supabase.channel('messages').on('postgres_changes', ...)`:
- Мгновенно слушает `INSERT` и `DELETE` в таблице `messages` по всей базе.
- Прокидывает данные в `useChatStore`.

### 3. Peer-to-Peer Звонки (WebRTC) (`frontend/src/services/callService.ts`)
Интегрирована бесшовная VoIP связь "компьютер-компьютер" через протокол WebRTC:
- Сигнальным сервером выступает `supabase.channel('calls_global')` через функцию **Broadcast** (отправка JSON-пакетов поверх WebSockets).
- *Отправка:* Офферы (Offer), ответы (Answer), и сетевые пути (ICE Candidates).
- *Очередь ICE (Queue):* Написана защита от Racing Conditions (когда координаты прилетают быстрее, чем браузер успевает повесить `RemoteDescription`). Асинхронные кандидаты ставятся в pending-хранилище и выстреливают по готовности.
- *UI:* `ActiveCall.tsx` контролирует звонилку, а `useCallStore.ts` хранит `MediaStream` (ваш микрофон) и `RTCPeerConnection`. Реализована кнопка Mute с физическим выключением audio-потоков.

### 4. Авторизация (`useAuthStore.ts` + `LoginPage.tsx`)
- Переход с SMS-кодов на пару Логин/Пароль.
- Токены на клиенте запоминаются в `localStorage` за счет Middleware `zustand/persist`. Токеном в данном прототипе выступает строковый `user.id`.

---

## 🛠️ Как деплоить новые изменения или дописывать код
1. Разработчик вносит изменения в кодовую базу `frontend/`.
2. Тестирует локально, если необходимо (`npm run dev`).
3. Кликает по файлу **`update_cloud.bat`** в корне проекта.
4. Скрипт пробивает Git Cache и пушит коммит `Migrated to Pure Supabase Serverless` (или другой текст) на GitHub `main`.
5. Хостинг Vercel автоматически собирает проект и выкатывает его в онлайн (`krogram.vercel.app`).
6. *Если меняем структуру БД:* Запускаем SQL напрямую в браузере платформы Supabase.

> **Статус системы:** Стабильная рабочая бета-версия (Serverless Prototype). 100% готовность к горизонтальному масштабированию благодаря разделению базы и хостинга фронтенда.
