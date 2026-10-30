// Interface strings. Everything under `original` is copied verbatim from the
// current jzbarbershop.com interface in each language; `ui` holds the few
// new navigation/accessibility labels the redesign needs.
export const LANGS = ['lv', 'en', 'ru']
export const DEFAULT_LANG = 'lv'

const original = {
  lv: {
    nav: { home: 'Galvenā', team: 'Komanda', services: 'Pakalpojumi', prices: 'Cenas', contacts: 'Kontakti', booking: 'Pieraksts' },
    viewServices: 'Skatīt pakalpojumus',
    bookOnline: 'Rezervēt tiešsaistē',
    zoom: 'Pietuvināt',
    open: 'Atvērt',
    contactUs: 'Sazinies ar mums:',
    privacy: 'Privātuma politika',
    contactsTitle: 'Kontakti',
    workingHours: 'Darba laiks',
    closed: 'Slēgts',
    viewOnMap: 'Skatīt kartē',
    days: ['Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena', 'Svētdiena'],
    steps: ['1. Izvēlies pakalpojumu', '2. Izvēlies meistaru', '3. Izvēlies datumu', '4. Ievadi savu numuru un vārdu'],
  },
  en: {
    nav: { home: 'Home', team: 'Team', services: 'Services', prices: 'Prices', contacts: 'Contacts', booking: 'Booking' },
    viewServices: 'View services',
    bookOnline: 'Book online',
    zoom: 'Zoom',
    open: 'Open',
    contactUs: 'Contact us:',
    privacy: 'Privacy Policy',
    contactsTitle: 'Contacts',
    workingHours: 'Working hours',
    closed: 'Closed',
    viewOnMap: 'View on map',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    steps: ['1. Choose a service', '2. Choose a barber', '3. Choose a date', '4. Enter your phone number and name'],
  },
  ru: {
    nav: { home: 'Главная', team: 'Команда', services: 'Услуги', prices: 'Цены', contacts: 'Контакты', booking: 'Запись' },
    viewServices: 'Посмотреть услуги',
    bookOnline: 'Забронировать онлайн',
    zoom: 'Увеличить',
    open: 'Открыть',
    contactUs: 'Свяжись с нами:',
    privacy: 'Политика конфиденциальности',
    contactsTitle: 'Контакты',
    workingHours: 'Часы работы',
    closed: 'Закрыто',
    viewOnMap: 'Посмотреть на карте',
    days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
    steps: ['1. Выберите услугу', '2. Выберите мастера', '3. Выберите дату', '4. Введите свой номер и имя'],
  },
}

const ui = {
  lv: { menu: 'Izvēlne', close: 'Aizvērt', skip: 'Pāriet uz saturu', scroll: 'Ritini', language: 'Valoda', prev: 'Iepriekšējais', next: 'Nākamais', today: 'Šodien', top: 'Uz augšu' },
  en: { menu: 'Menu', close: 'Close', skip: 'Skip to content', scroll: 'Scroll', language: 'Language', prev: 'Previous', next: 'Next', today: 'Today', top: 'Back to top' },
  ru: { menu: 'Меню', close: 'Закрыть', skip: 'Перейти к содержанию', scroll: 'Листайте', language: 'Язык', prev: 'Назад', next: 'Далее', today: 'Сегодня', top: 'Наверх' },
}

export function messages(lang) {
  const l = LANGS.includes(lang) ? lang : DEFAULT_LANG
  return { ...original[l], ui: ui[l] }
}
