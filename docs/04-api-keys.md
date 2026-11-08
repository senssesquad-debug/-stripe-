# Ключи и доступы: что подключить и куда положить

Приложение **уже работает без единого платного ключа** (OpenStreetMap, Wikidata, visitcyprus.com,
MET Norway, Nominatim, детерминированный умный поиск). Ключи ниже расширяют функциональность.
Правило: **секреты — только на сервере** (`apps/api/.env` или секреты хостинга). В приложение
попадают только публичные значения с префиксом `EXPO_PUBLIC_` и Android-ключ карт, ограниченный
пакетом и подписью.

## 1. Обязательно для продакшена

| Что | Где взять | Куда положить | Стоимость |
|---|---|---|---|
| **PostgreSQL 15+ с PostGIS** | Supabase (Database → Extensions → включить `postgis`, `pg_trgm`), Neon, AWS RDS, свой сервер | `DATABASE_URL` (сервер) | Supabase Pro от $25/мес |
| **Supabase Auth** (вход по коду на e-mail; Apple/Google опционально) | supabase.com → проект → Settings → API | Сервер: `AUTH_JWKS_URL` = `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`, `AUTH_ISSUER` = `https://<project>.supabase.co/auth/v1`. Приложение: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon-ключ публичен по дизайну; приложение не обращается к БД напрямую) | Бесплатно до 50k MAU |
| **Администраторы** | id пользователя из Supabase → Authentication → Users | `ADMIN_USER_IDS` (через запятую) | — |
| **REPORT_SALT** | любая случайная строка (`openssl rand -hex 32`) | сервер | — |
| **Хостинг API + worker** | Fly.io / Render / Railway / AWS ECS — образ `infra/Dockerfile`, два процесса | env хостинга | от ~$10–20/мес |
| **Apple Developer Program** | developer.apple.com | EAS (`eas credentials`) | $99/год |
| **Google Play Console** | play.google.com/console | EAS Submit (service account JSON) | $25 разово |
| **Expo / EAS** | expo.dev → `eas init` | `EAS_PROJECT_ID` (app.config.ts) | бесплатный план для старта |

## 2. Рекомендуется

| Ключ | Что даёт | Где взять / ограничения | Куда |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Живые рейтинг/часы Google на карточке места, поиск `place_id` | Google Cloud → APIs → включить **Places API (New)**; ограничить ключ: API = Places, приложения = IP серверов. Бесплатно ~10k Essentials / 5k Pro вызовов в месяц на SKU. **Не хранить контент Places** (уже соблюдено в коде) | сервер |
| `GOOGLE_MAPS_ANDROID_KEY` | Карта на Android (Maps SDK for Android) | Google Cloud → Maps SDK for Android; ограничить по пакету `app.passtra.android` + SHA-1 сертификата из `eas credentials`. Мобильные динамические карты бесплатны | env сборки EAS (`eas secret:create`) |
| `ANTHROPIC_API_KEY` | AI-интерпретация запросов (en/el/ru) с откатом на правила | console.anthropic.com → API Keys. Модель по умолчанию `claude-opus-5-5` (`ANTHROPIC_MODEL`), effort `low`, кеш интерпретаций в БД | сервер |
| `TICKETMASTER_API_KEY` | Коннектор Ticketmaster (покрытие Кипра ожидается малым — проверить) | developer.ticketmaster.com — бесплатно, 5000 вызовов/сутки | сервер |
| `EVENTBRITE_TOKEN` + organization IDs | События организаторов, подключивших Eventbrite | eventbrite.com → Account → Developer → private token; ID организаций добавить в админке: Sources → Eventbrite → `config.organizationIds` | сервер |
| `SENTRY_DSN` (по желанию) | Crash reporting | sentry.io; в приложении — `@sentry/react-native` (не подключён по умолчанию, см. чек-лист релиза) | env |

## 3. Для масштаба

| Что | Зачем |
|---|---|
| Свой **Overpass** (`OVERPASS_URL`) или импорт PBF Geofabrik | Публичный overpass-api.de имеет лимиты; для всей страны и частых обновлений — свой инстанс |
| Свой **Nominatim** (`NOMINATIM_URL`) | Публичный — не более 1 запроса/сек |
| `EXPO_ACCESS_TOKEN` | Усиленная защита push (Expo → Access tokens → enhanced security) |
| Redis | Распределённый rate limiting при нескольких экземплярах API |

## 4. Источники, требующие договорённости (не ключ, а разрешение)

| Источник | Что нужно |
|---|---|
| visitcyprus.com | Письменное подтверждение Deputy Ministry of Tourism на повторное использование календаря и изображений (страница Terms вернула 404). До этого изображения отключены (`allowImages: false`) |
| soldoutticketbox.com, ticketbox.com.cy, more.com | Партнёрский фид/API. Сайты не дают разрешения на автоматический сбор (403/JS) — парсинг не делаем |
| Площадки (Rialto, Pattihio, муниципальные театры) | Проверить Terms; при наличии JSON-LD/iCal — добавить источник в админке и отметить «Terms reviewed» |

## 5. Где что лежит

```
apps/api/.env              ← серверные секреты (шаблон: apps/api/.env.example)
apps/mobile/.env           ← EXPO_PUBLIC_* (шаблон: apps/mobile/.env.example)
eas secret:create          ← GOOGLE_MAPS_ANDROID_KEY, EAS_PROJECT_ID для облачных сборок
apps/mobile/eas.json       ← URL API по профилям (development / preview / production)
```

Проверка без раскрытия значений: админка → Overview → Integrations, либо `GET /v1/status`.
