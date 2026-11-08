const en = {
  common: {
    retry: 'Try again', cancel: 'Cancel', save: 'Save', saved: 'Saved', done: 'Done', continue: 'Continue', skip: 'Skip', back: 'Back',
    seeAll: 'See all', share: 'Share', km: 'km', min: 'min', loading: 'Loading…', offlineCached: 'Offline — showing data from {{time}}',
    demo: 'DEMO', free: 'Free', usuallyFree: 'Usually free', priceUnknown: 'Price not listed', close: 'Close', apply: 'Apply', clear: 'Clear',
  },
  tabs: { today: 'Today', explore: 'Explore', map: 'Map', saved: 'Saved', profile: 'Profile' },
  onboarding: {
    welcomeTitle: 'What’s happening around you, right now.',
    welcomeBody: 'Concerts, places, markets, beaches and everyday essentials — from verified sources, with the time they were last checked.',
    language: 'Language',
    interestsTitle: 'What are you into?',
    interestsBody: 'Pick a few — it helps us suggest better. You can change this anytime.',
    locationTitle: 'See what’s near you',
    locationBody: 'Allow location to find events and places around you. Your location is used only for each search and is never stored.',
    allowLocation: 'Allow location',
    chooseCity: 'Choose a city instead',
    start: 'Start exploring',
  },
  today: {
    title: 'Today near you', subtitle: 'What’s happening around you?', surprise: 'Surprise me', plan: 'Plan my day',
    changeCity: 'Change', nearYou: 'Near you', inCity: 'in {{city}}',
    locationOff: 'Location is off — showing {{city}}.', enableLocation: 'Turn on',
    empty: 'Nothing listed nearby right now. Try a bigger radius or another city.',
  },
  card: { now: 'Now', unconfirmedTime: 'Time unconfirmed', cancelled: 'Cancelled', postponed: 'Postponed', away: '{{km}} km', open: 'Open', closed: 'Closed' },
  verification: {
    confirmed: 'Verified', likely: 'Likely accurate', unverified: 'Unverified', conflicting: 'Sources disagree',
    checked: 'Checked {{ago}}', sourcesTitle: 'Where this comes from', official: 'Official',
    conflictTitle: 'Sources disagree on {{field}}', conflictHelp: 'We show every version instead of guessing. Check with the organiser.',
    field_starts_at: 'the start time', field_ends_at: 'the end time', field_local_start_date: 'the date', field_location: 'the location', field_status: 'the status', field_price_min: 'the price', field_price_max: 'the price', field_is_free: 'whether it is free', field_city: 'the city', field_local_end_date: 'the end date',
    report: 'Report a problem', reportThanks: 'Thanks — a moderator will check it.',
  },
  detail: {
    tickets: 'Tickets', website: 'Website', directions: 'Directions', call: 'Call', googleMaps: 'Google Maps', appleMaps: 'Apple Maps',
    when: 'When', where: 'Where', price: 'Price', organizer: 'Organiser', hours: 'Opening hours', about: 'About', upcomingHere: 'Coming up here',
    approxLocation: 'Approximate location', cityOnly: 'Exact venue location not provided', ageLimit: '{{age}}+',
    googleTitle: 'From Google', googleRating: '{{rating}} ★ · {{count}} reviews', reviews: 'passtra reviews', writeReview: 'Rate this place',
    timezoneNote: 'Times are local Cyprus time ({{tz}}).',
  },
  report: {
    title: 'Report a problem', cancelled: 'It’s cancelled', wrong_time: 'Wrong date or time', wrong_location: 'Wrong location', wrong_price: 'Wrong price',
    closed: 'Permanently closed', duplicate: 'Duplicate', inappropriate: 'Inappropriate', other: 'Something else', messagePlaceholder: 'What’s wrong? A link to the source helps.', send: 'Send report',
  },
  search: {
    placeholder: 'Try “live music tonight” or “pharmacy open now”', understood: 'We understood', ai: 'AI', results: '{{count}} results',
    examples: 'Try asking', noResults: 'No matches. Try fewer words or a wider area.',
    ex1: 'Where is there live music tonight?', ex2: 'Best restaurants near me', ex3: 'Things to do with kids today', ex4: 'Concerts in Limassol this weekend', ex5: 'Free events', ex6: 'Which shops are open now?',
  },
  explore: { title: 'Explore the city', all: 'All', radius: 'Radius', openNow: 'Open now', freeOnly: 'Free', events: 'Events', places: 'Places', when: 'When', any: 'Any time', noResults: 'Nothing matches these filters.' },
  time: { now: 'Now', today: 'Today', tonight: 'Tonight', tomorrow: 'Tomorrow', weekend: 'Weekend', next_7_days: 'Next 7 days', this_week: 'This week' },
  map: { searchArea: 'Search this area', list: 'List', map: 'Map', zoomIn: 'Zoom in to see places', webNote: 'The interactive map is available in the iOS and Android apps.' },
  saved: { title: 'Saved', empty: 'Save events and places to find them here.', localNote: 'Saved on this device. Sign in to sync across devices.', places: 'Places', events: 'Events', past: 'Past' },
  surprise: { title: 'Surprise me', again: 'Shuffle again', empty: 'Nothing open or on soon nearby. Try again later or widen your area.' },
  plan: {
    title: 'Plan my day', from: 'From', to: 'Until', budget: 'Budget per person', noLimit: 'No limit', interests: 'Interests', transport: 'Getting around',
    walk: 'Walk', drive: 'Drive', auto: 'Auto', build: 'Build my plan', total: 'Known costs {{amount}}', unknownPrices: '{{count}} with unknown price',
    travel: '≈ {{min}} min {{mode}}', walking: 'walking', driving: 'by car', meal: 'Meal', hoursUnknown: 'Hours not listed', fixedTime: 'Fixed time',
    empty: 'We couldn’t build a plan for this time window. Try a longer window or other interests.',
  },
  profile: {
    title: 'Profile', signIn: 'Sign in', signOut: 'Sign out', signInBody: 'Sync saved places and get personal alerts. No password — we email you a code.',
    email: 'Email', sendCode: 'Send code', code: '6-digit code', verify: 'Verify', language: 'Language', interests: 'Interests', budget: 'Budget',
    budget_free: 'Free only', budget_low: 'Low', budget_medium: 'Medium', budget_high: 'Any', age: 'Age (optional)', age_hint: 'Only used to hide 18+ content.',
    notifications: 'Notifications', privacy: 'Privacy & data', aboutData: 'About our data', forOrganisers: 'For organisers', addEvent: 'Add an event',
    appearance: 'Appearance', system: 'System', light: 'Light', dark: 'Dark', version: 'Version {{v}}', authUnavailable: 'Accounts are not configured on this build.',
  },
  notifications: {
    enabled: 'Allow notifications', maxPerDay: 'At most per day', quiet: 'Quiet hours', newInCity: 'New events in my city', favorites: 'Events at places I saved',
    explain: 'We only notify you about verified events that match your interests. Never more than you choose.', denied: 'Notifications are blocked in system settings.',
  },
  privacy: {
    personalization: 'Personalised suggestions', personalizationHelp: 'Uses what you open and save (kept 180 days). Turning it off deletes this history.',
    export: 'Download my data', delete: 'Delete my account', deleteConfirm: 'This permanently deletes your account, saved items and history.', deleted: 'Your account was deleted.',
    location: 'Location is used only to answer each request and is never stored.', policy: 'Privacy policy',
  },
  about: {
    title: 'About our data', body: 'passtra combines official and open sources. Every event shows where it came from and when it was last checked. We never invent dates, prices or opening hours — if something is unknown, we say so.',
    sources: 'Sources', attributions: 'Attributions', lastUpdate: 'Last update {{ago}}',
  },
  submit: {
    title: 'Add an event', body: 'Events are reviewed by a moderator before they appear.', name: 'Event name', category: 'Category', venue: 'Venue', city: 'City',
    date: 'Date (YYYY-MM-DD)', start: 'Start time (HH:MM, optional)', end: 'End time (optional)', free: 'Free entry', priceFrom: 'Price from (€)', ticketUrl: 'Ticket link',
    organizer: 'Organiser', contact: 'Contact email', send: 'Submit for review', sent: 'Thanks! We’ll review it shortly.', signInFirst: 'Sign in to submit events.',
  },
  errors: {
    network: 'Can’t reach passtra right now.', server: 'Something went wrong on our side.', notFound: 'This item is no longer available.',
    locationDenied: 'Location permission denied.', locationOutside: 'passtra currently covers Cyprus. Showing Limassol.',
  },
  ago: { justNow: 'just now', minutes: '{{count}} min ago', hours: '{{count}} h ago', days: '{{count}} d ago' },
};

export default en;
export type Strings = typeof en;
