# App Store privacy label & Google Play Data safety — answers

These answers match the implemented behaviour (see `privacy-policy.md`). Re-check them whenever data collection changes.

## Apple — App Privacy ("nutrition label")

**Data used to track you:** None. (No IDFA, no cross-app tracking → no ATT prompt needed.)

**Data linked to you** (only when the user creates an account):
| Category | Type | Purpose |
|---|---|---|
| Contact Info | Email Address | App Functionality (sign-in) |
| User Content | Other User Content (saved items, lists, reviews, reports, event submissions) | App Functionality |
| Identifiers | User ID | App Functionality |
| Usage Data | Product Interaction (opened/saved/hidden items; only if personalisation is on) | Product Personalization |

**Data not linked to you:**
| Category | Type | Purpose |
|---|---|---|
| Location | Coarse Location (rounded ~100 m, not stored) | App Functionality |
| Diagnostics | Crash Data, Performance Data (if Sentry is enabled) | App Functionality |
| Search History | Search queries (cached without identifiers) | App Functionality |

Precise location is **not** collected (coordinates are rounded on the device before sending).
Account deletion is available in the app (Guideline 5.1.1(v)).

`app.json` already includes `NSLocationWhenInUseUsageDescription`, no background location, and a privacy manifest entry for `UserDefaults` (CA92.1). Run `npx expo prebuild` and review the generated `PrivacyInfo.xcprivacy` for third-party SDK entries before submission.

## Google Play — Data safety form

- **Does your app collect or share user data?** Yes (collect). **Shared with third parties:** No (processors acting on our behalf are not "sharing" under Play's definition).
- **Encrypted in transit:** Yes (HTTPS only).
- **Users can request deletion:** Yes — in app (Profile → Privacy & data → Delete my account) and by e-mail. Provide the web deletion URL required by Play: `https://passtra.app/delete-account` (page to be published with the website).

| Data type | Collected | Optional? | Purpose | Ephemeral? |
|---|---|---|---|---|
| Location → Approximate location | Yes | Optional (permission) | App functionality | **Yes — processed ephemerally, not stored** |
| Personal info → Email address | Yes | Optional (account) | Account management | No |
| Personal info → User IDs | Yes | Optional (account) | Account management | No |
| App activity → App interactions | Yes | Optional (personalisation toggle) | Personalization | No (180 days) |
| App activity → In-app search history | Yes | Required for search | App functionality | No (30 days, unlinked) |
| App activity → Other user-generated content (reviews, reports, submissions) | Yes | Optional | App functionality | No |
| App info and performance → Crash logs, Diagnostics | Yes (if Sentry enabled) | Required | App functionality | No |
| Device or other IDs → Push token | Yes | Optional (notifications) | App functionality | No |

**Permissions declared:** `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (foreground only; the app rounds coordinates), `POST_NOTIFICATIONS`. `ACCESS_BACKGROUND_LOCATION` is explicitly blocked in `app.json`.
If Google Play review asks why fine location is requested: it improves distance accuracy for "near me" results; consider removing `ACCESS_FINE_LOCATION` if coarse accuracy proves sufficient in testing.
