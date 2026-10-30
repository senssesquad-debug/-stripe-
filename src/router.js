import { createRouter, createWebHistory } from 'vue-router'
import { LANGS } from './data/i18n.js'
import { preferredLang, setRoute, rememberChoice } from './composables/useSite.js'
import snapshot from './data/snapshot.json'

const PAGES = ['home', 'team', 'services', 'prices', 'contacts', 'booking', 'privacy-policy']

const page = (name, loader) => ({ path: name, name, component: loader, meta: { page: name } })

// Paths mirror the original site so existing links, bookmarks and the
// sitemap keep resolving: /:lang/:dept/{home,team,services,prices,contacts,booking,privacy-policy}
const routes = [
  { path: '/', name: 'root', component: () => import('./pages/LocationPage.vue'), meta: { page: 'root' } },
  {
    path: '/:lang/:dept',
    component: () => import('./pages/DepartmentLayout.vue'),
    beforeEnter(to) {
      const { lang, dept } = to.params
      if (!snapshot.departmentCodes.includes(dept)) return '/'
      if (!LANGS.includes(lang)) return `/${preferredLang()}/${dept}/${PAGES.includes(to.path.split('/')[3]) ? to.path.split('/')[3] : 'home'}`
    },
    children: [
      { path: '', redirect: (to) => `/${to.params.lang}/${to.params.dept}/home` },
      page('home', () => import('./pages/HomePage.vue')),
      page('team', () => import('./pages/TeamPage.vue')),
      page('services', () => import('./pages/ServicesPage.vue')),
      page('prices', () => import('./pages/PricesPage.vue')),
      page('contacts', () => import('./pages/ContactsPage.vue')),
      page('booking', () => import('./pages/BookingPage.vue')),
      page('privacy-policy', () => import('./pages/PrivacyPage.vue')),
    ],
  },
  {
    path: '/:dept',
    redirect: (to) => (snapshot.departmentCodes.includes(to.params.dept) ? `/${preferredLang()}/${to.params.dept}/home` : '/'),
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Scrolling is owned by the smooth-scroll controller (see useScroll.js).
  scrollBehavior: () => false,
})

router.beforeEach((to) => {
  if (to.params.lang && to.params.dept) {
    setRoute(to.params.lang, to.params.dept)
    rememberChoice(to.params.lang, to.params.dept)
  }
})
