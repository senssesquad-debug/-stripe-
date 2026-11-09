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
| **Аккаунты passtra** (email + пароль, отзываемые сессии) | встроено в API | `AUTH_JWT_SECRET` — случайная строка ≥ 32 символов (на Render генерируется автоматически). Смена секрета разлогинивает всех | — |
| **Отправка email-кодов** (подтверждение email, сброс пароля) | resend.com → API Keys; домен отправителя подтвердить (DNS: SPF/DKIM) | `RESEND_API_KEY`, `EMAIL_FROM` (например `passtra <no-reply@ваш-домен>`). Без ключа регистрация работает, но email остаётся «не подтверждён», а сброс пароля недоступен — интерфейс так и говорит | 3000 писем/мес бесплатно, далее от $20/мес |
| **Администраторы** | id пользователя из таблицы `users` (виден в `GET /v1/me`) **или** его email | `ADMIN_USER_IDS` и/или `ADMIN_EMAILS` (через запятую). Email даёт роль только после подтверждения кода. Вход в админку `/admin/` — тем же email и паролем | — |
| **REPORT_SALT** | любая случайная строка (`openssl rand -hex 32`) | сервер | — |
| **Хостинг API + worker** | Fly.io / Render / Railway / AWS ECS — образ `infra/Dockerfile`, два процесса | env хостинга | от ~$10–20/мес |
| **Apple Developer Program** | developer.apple.com | EAS (`eas credentials`) | $99/год |
| **Google Play Console** | play.google.com/console | EAS Submit (service account JSON) | $25 разово |
| **Expo / EAS** | expo.dev → `eas init` | `EAS_PROJECT_ID` (app.config.ts) | бесплатный план для старта |

## 2. Рекомендуется

### Уведомления, телефон, карты, ссылки

| Что | Зачем / ограничения | Куда |
|---|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS-код для привязки телефона. Без них номер нельзя подтвердить: интерфейс показывает «отправка SMS не подключена», номер **не** привязывается. Twilio: ~$0.05–0.10 за SMS на Кипр; `TWILIO_FROM` — купленный номер или одобренный Sender ID | сервер |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` (VAPID) | Web Push в браузере. Если не заданы — пара создаётся и хранится в БД (`app_settings`). Задайте явно (`npx web-push generate-vapid-keys`), иначе при пересоздании БД все подписки браузеров перестанут работать. `WEB_PUSH_SUBJECT` — `mailto:` контакт | сервер |
| `EXPO_ACCESS_TOKEN` + `EAS_PROJECT_ID` | Push в iOS/Android-приложениях (Expo Push → APNs/FCM). Без `EAS_PROJECT_ID` в сборке экран уведомлений честно пишет «Push не настроен в этой сборке» | сервер / EAS |
| `PUBLIC_WEB_URL` | Адрес сайта в ссылках «Поделиться» и превью (Open Graph) | сервер |
| `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` + `APP_LINK_HOST` | Universal Links / App Links: ссылка `/event/…`, `/place/…` открывает установленное приложение, иначе — сайт. Сервер отдаёт `/.well-known/apple-app-site-association` и `assetlinks.json` только когда значения заданы. SHA-256 — из `eas credentials` (Android) | сервер + env сборки |
| `ROUTING_URL` | Маршруты внутри приложения. По умолчанию публичный OSRM FOSSGIS (`routing.openstreetmap.de`, пешком/авто): бесплатно, без ключа, «разумное использование», без SLA. Для нагрузки — свой OSRM/Valhalla или платный сервис (GraphHopper, Mapbox Directions). Если сервис недоступен, приложение показывает оценку по прямой с явной пометкой | сервер |
| Тайлы карты (веб) | OpenFreeMap (`tiles.openfreemap.org`): без ключа и лимитов, атрибуция OpenStreetMap на карте. Альтернатива для SLA — MapTiler/Stadia (ключ) | — |
| Карты iOS/Android | Apple Maps — без ключа; Android — `GOOGLE_MAPS_ANDROID_KEY` (ниже) | — |

**Ограничения веб-версии уведомлений.** Push приходят, пока запущен браузер (вкладка passtra может быть закрыта).
iPhone/iPad: только если сайт добавлен на экран «Домой» (iOS 16.4+). Напоминания отправляет сервер — он должен
работать в момент напоминания. **Render Free засыпает через 15 минут без запросов**, и напоминания будут приходить
с опозданием до пробуждения. Для точных напоминаний: платный инстанс (Starter, $7/мес) или внешний пинг
`/v1/health` раз в 10 минут (например, cron-job.org / UptimeRobot).

| Ключ | Что даёт | Где взять / ограничения | Куда |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Живые рейтинг/часы Google на карточке места, **фото мест из Google** (с авторством), поиск `place_id`, **проверка адресов** через Geocoding (без ключа — Nominatim) | Google Cloud → APIs → включить **Places API (New)** и **Geocoding API**; ограничить ключ: API = Places + Geocoding, приложения = IP серверов. Бесплатно ~10k Essentials / 5k Pro вызовов в месяц на SKU. **Не хранить контент Places** (уже соблюдено в коде) | сервер |
| `GOOGLE_MAPS_ANDROID_KEY` | Карта на Android (Maps SDK for Android) | Google Cloud → Maps SDK for Android; ограничить по пакету `app.passtra.android` + SHA-1 сертификата из `eas credentials`. Мобильные динамические карты бесплатны | env сборки EAS (`eas secret:create`) |
| `ANTHROPIC_API_KEY` | AI-интерпретация запросов (en/el/ru) с откатом на правила; короткие описания карточек (принимаются только если все числа есть в фактах); AI-модерация отзывов и аватаров (без ключа — только правила + ручная очередь) | console.anthropic.com → API Keys. Модель по умолчанию `claude-opus-5-5` (`ANTHROPIC_MODEL`), effort `low`, кеш интерпретаций в БД | сервер |
| `TICKETMASTER_API_KEY` | Коннектор Ticketmaster (покрытие Кипра ожидается малым — проверить) | developer.ticketmaster.com — бесплатно, 5000 вызовов/сутки | сервер |
| `EVENTBRITE_TOKEN` + organization IDs | События организаторов, подключивших Eventbrite | eventbrite.com → Account → Developer → private token; ID организаций добавить в админке: Sources → Eventbrite → `config.organizationIds` | сервер |
| `SENTRY_DSN` (по желанию) | Crash reporting | sentry.io; в приложении — `@sentry/react-native` (не подключён по умолчанию, см. чек-лист релиза) | env |

### Общественный транспорт

Расписания автобусов Кипра — открытые GTFS-фиды Motion (CC BY 4.0, 7 операторов), импортируются автоматически
каждые 12 часов, ключ не нужен. Живые позиции автобусов (GTFS-Realtime) пока **не подключены**: фид отдаётся
только по HTTP с IP-адреса без документации и SLA — в приложении показывается расписание, а не реальное
опоздание.

### Instagram и Facebook

Сбор с сайтов Instagram/Facebook запрещён их условиями — не делаем. Легальный путь — Meta Graph API:
нужен **Instagram Professional-аккаунт passtra, связанный с Facebook-страницей**, приложение в Meta for Developers
и прохождение App Review (права `instagram_basic`, `pages_read_engagement`, функция Business Discovery).
Business Discovery отдаёт публичные посты других бизнес-аккаунтов (не события как структуру) — из них можно
извлекать афиши AI-разбором с обязательной проверкой модератором. События Facebook-страниц доступны только
с функцией Page Public Content Access (отдельное одобрение Meta, выдаётся редко) или если организатор сам
подключит свою страницу.

## 3. Для масштаба

| Что | Зачем |
|---|---|
| Места OpenStreetMap | Импортируются из ежедневного файла Geofabrik (`download.geofabrik.de/europe/cyprus-latest.osm.pbf`, ODbL), одна загрузка в сутки, без ключа. Режим Overpass (`config.mode = "overpass"`, `OVERPASS_URL`) оставлен запасным |
| Свой **Nominatim** (`NOMINATIM_URL`) | Публичный — не более 1 запроса/сек |
| `EXPO_ACCESS_TOKEN` | Усиленная защита push (Expo → Access tokens → enhanced security) |
| Redis | Распределённый rate limiting при нескольких экземплярах API |
| Платный инстанс Render (Starter) | Free засыпает через 15 мин: первый запрос ждёт ~1 мин, импорт OSM и напоминания идут только пока сервис не спит |

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
