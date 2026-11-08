# Этап 7 — Чек-лист выпуска в App Store и Google Play

Статус: **код готов к сборке; приложение НЕ опубликовано.** Публикация требует действий в ваших
аккаунтах разработчика (ниже). Отмечайте пункты по мере выполнения.

## A. Инфраструктура
- [ ] Postgres с PostGIS (Supabase/Neon/RDS); `DATABASE_URL`
- [ ] Развернуть образ `infra/Dockerfile`: процесс **api** (`node dist/server.js`) и **worker** (`node dist/worker.js`); миграции применяются автоматически при старте
- [ ] Домен `api.passtra.app` + HTTPS; `CORS_ORIGINS`, `TRUST_PROXY=true`
- [ ] Supabase Auth: включить Email OTP (шаблон письма с кодом), при желании Sign in with Apple (обязателен на iOS, если есть другие соцвходы) и Google; `AUTH_JWKS_URL`, `AUTH_ISSUER`
- [ ] `ADMIN_USER_IDS`, `REPORT_SALT`; админка — `https://api.passtra.app/admin/`
- [ ] Ключи из `docs/04-api-keys.md` (минимум: Google Maps Android key; рекомендовано: Places, Anthropic, Ticketmaster)
- [ ] Письменное подтверждение от visitcyprus.com на использование календаря; затем в админке «Mark terms reviewed» и, если разрешено, `allowImages: true`
- [ ] Первичная загрузка мест: в админке Sources → OpenStreetMap → Run now (режим `overpass`), затем Wikidata
- [ ] Мониторинг: аптайм `/v1/ready`, алерты на `consecutive_failures ≥ 5` (видно в админке), бэкапы БД

## B. Сборки (EAS)
```bash
cd apps/mobile
npm i -g eas-cli && eas login
eas init                                  # создаёт projectId → EAS_PROJECT_ID
eas secret:create --name GOOGLE_MAPS_ANDROID_KEY --value <key>
eas build --profile preview --platform all     # внутреннее тестирование
eas build --profile production --platform all
eas submit --profile production --platform ios
eas submit --profile production --platform android
```
- [ ] `eas.json`: заменить URL API и `ascAppId`
- [ ] Android: SHA-1 сертификата (`eas credentials`) → ограничение ключа Maps SDK
- [ ] Иконка/сплэш уже настроены (`assets/images/*`, генерируются `pnpm brand:render`)
- [ ] Версия: `app.json` `version` + `appVersionSource: remote` (EAS увеличивает build number)

## C. App Store Connect
- [ ] Создать приложение (bundle id `app.passtra.ios`), категория Travel
- [ ] App Privacy — ответы из `docs/release/data-safety.md`
- [ ] Privacy Policy URL (опубликовать `privacy-policy.md` после юридической проверки), Support URL
- [ ] Удаление аккаунта в приложении — есть (Profile → Privacy & data)
- [ ] Скриншоты 6.9" и 6.5" с реальной сборки; тексты en/el/ru из `store-listing.md`
- [ ] Возрастной рейтинг (ночная жизнь/алкоголь → 12+); казино-категория — проверить соответствие Guideline 5.3 (мы только показываем места, без азартных игр)
- [ ] TestFlight: внутренние, затем внешние тестировщики; затем «Submit for Review»
- [ ] Review notes: «Location is optional; city can be chosen manually. No account required. Test account: <email + code flow description>»

## D. Google Play Console
- [ ] Приложение `app.passtra.android`; Data safety (из `data-safety.md`); целевая аудитория 13+
- [ ] Страница удаления аккаунта (web URL) — опубликовать
- [ ] Обоснование разрешений геолокации (foreground only)
- [ ] Feature graphic `brand/png/play-feature-graphic.png`, иконка 512² (`brand/png/icon.png` уменьшить), скриншоты
- [ ] Internal testing → Closed testing (для новых личных аккаунтов Play требует 12+ тестировщиков 14 дней) → Production

## E. Проверки качества перед отправкой
- [ ] Реальные устройства: iPhone (маленький и большой экран), Android среднего класса
- [ ] Отказ в геолокации → выбор города работает; геолокация вне Кипра → сообщение и Лимассол
- [ ] Режим самолёта → баннер «нет сети, данные от …» из кеша
- [ ] VoiceOver/TalkBack на Today и деталях; крупный системный шрифт
- [ ] Тёмная тема; три языка (особенно длинные греческие строки в табах)
- [ ] Push: включение, тихие часы, не больше лимита в день
- [ ] Вход по коду, синхронизация избранного, экспорт и удаление аккаунта
- [ ] Нагрузочный тест API (k6) — p95 < 400 мс для `/v1/feed/today`
- [ ] Crash reporting: подключить `@sentry/react-native` (`npx expo install @sentry/react-native`) и DSN

## F. После запуска
- [ ] Ежедневно: очередь проверки, конфликты, жалобы, заявки организаторов (админка)
- [ ] Еженедельно: ошибки интеграций, свежесть источников, новые партнёры-источники
- [ ] Не включать `FEATURE_PROMOTIONS` и платные функции, пока ядро не стабильно (`docs/05-product-strategy.md`)
