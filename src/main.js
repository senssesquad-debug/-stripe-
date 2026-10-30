import { createApp } from 'vue'
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/300-italic.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource-variable/manrope/wght.css'
import './styles/main.css'
import App from './App.vue'
import { router } from './router.js'
import { watchForNewBuild } from './composables/useFreshness.js'

createApp(App).use(router).mount('#app')
watchForNewBuild()
