/* Happy Panda — interactions, 3D scroll, cart, reservations */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const CATS = window.HP_CATEGORIES;
  const DISHES = window.HP_DISHES;
  const I18N = window.HP_I18N;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
  };

  const DELIVERY_FEE = 2.5, FREE_FROM = 35, MIN_ORDER = 15, PICKUP_DISCOUNT = 0.1;

  /* ---------------- i18n ---------------- */
  const browserLang = (navigator.language || "en").slice(0, 2);
  let lang = store.get("hp-lang", ["lv", "ru", "en"].includes(browserLang) ? browserLang : "en");
  const t = key => (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  const money = n => "€" + n.toFixed(2);

  function applyLang() {
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    $$(".lang button").forEach(b => b.classList.toggle("is-active", b.dataset.lang === lang));
    renderTabs(); renderDishes(); renderRing(); renderCart();
    if (hasGsap) ScrollTrigger.refresh();
  }
  $$(".lang button").forEach(b => b.addEventListener("click", () => {
    lang = b.dataset.lang; store.set("hp-lang", lang); applyLang();
  }));

  /* ---------------- Menu ---------------- */
  let activeCat = CATS[0].id;
  const dishMedia = d => d.img
    ? `<img src="${d.img}" alt="${d.name.en}" loading="lazy" width="700" height="525">`
    : `<div class="dish__placeholder"><span class="hanzi">${d.hanzi}</span></div>`;

  function renderTabs() {
    $("#tabs").innerHTML = CATS.map(c => `
      <button class="tab ${c.id === activeCat ? "is-active" : ""}" role="tab" aria-selected="${c.id === activeCat}" data-cat="${c.id}">
        <span class="hanzi">${c.hanzi}</span>${c.name[lang]}
      </button>`).join("");
  }

  function renderDishes(animate) {
    const list = DISHES.filter(d => d.cat === activeCat);
    $("#dishes").innerHTML = list.map(d => `
      <article class="dish" data-id="${d.id}">
        <div class="dish__media">
          ${dishMedia(d)}
          <div class="dish__tags">
            ${d.spicy ? `<span class="tag">🌶 ${t("menu.spicy")}</span>` : ""}
            ${d.veg ? `<span class="tag tag--veg">${t("menu.veg")}</span>` : ""}
          </div>
        </div>
        <div class="dish__body">
          <span class="dish__hanzi">${d.hanzi}</span>
          <h3 class="dish__name">${d.name[lang]}</h3>
          <p class="dish__desc">${d.desc[lang]}</p>
          <div class="dish__foot">
            <span class="price">${money(d.price)}</span>
            <button class="add-btn" data-add="${d.id}">+ ${t("menu.add")}</button>
          </div>
        </div>
      </article>`).join("");
    bindTilt($$(".dish"), 8);
    if (animate && hasGsap && !reduceMotion) {
      gsap.fromTo(".dish", { opacity: 0, y: 40, rotateX: -25 }, { opacity: 1, y: 0, rotateX: 0, duration: .7, stagger: .06, ease: "power3.out" });
    }
  }

  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab"); if (!b) return;
    activeCat = b.dataset.cat; renderTabs(); renderDishes(true);
    if (hasGsap) ScrollTrigger.refresh();
  });

  /* ---------------- Cart ---------------- */
  let cart = store.get("hp-cart", {});
  let orderType = store.get("hp-type", "delivery");
  const byId = id => DISHES.find(d => d.id === id);

  function cartLines() {
    return Object.entries(cart).filter(([id, q]) => q > 0 && byId(id)).map(([id, q]) => ({ d: byId(id), q }));
  }
  function totals() {
    const subtotal = cartLines().reduce((s, l) => s + l.d.price * l.q, 0);
    const fee = orderType === "delivery" && subtotal > 0 && subtotal < FREE_FROM ? DELIVERY_FEE : 0;
    const discount = orderType === "pickup" ? subtotal * PICKUP_DISCOUNT : 0;
    return { subtotal, fee, discount, total: subtotal + fee - discount };
  }

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.q, 0);
    const badge = $("#cartCount");
    badge.textContent = count; badge.classList.toggle("is-visible", count > 0);

    $("#cartItems").innerHTML = lines.length ? lines.map(({ d, q }) => `
      <div class="citem">
        <div class="citem__thumb">${d.img ? `<img src="${d.img.replace("w=700&h=700", "w=120&h=120")}" alt="">` : d.hanzi}</div>
        <div><div class="citem__name">${d.name[lang]}</div><div class="citem__price">${money(d.price)} × ${q}</div></div>
        <div class="qty"><button data-dec="${d.id}" aria-label="−">−</button><span>${q}</span><button data-inc="${d.id}" aria-label="+">+</button></div>
      </div>`).join("")
      : `<div class="drawer__empty"><span class="hanzi">空</span>${t("cart.empty")}</div>`;

    const tt = totals();
    const belowMin = orderType === "delivery" && tt.subtotal > 0 && tt.subtotal < MIN_ORDER;
    $("#totals").innerHTML = `
      <div><span>${t("cart.subtotal")}</span><span>${money(tt.subtotal)}</span></div>
      ${orderType === "delivery" ? `<div><span>${t("cart.fee")}</span><span>${tt.fee ? money(tt.fee) : t("cart.free")}</span></div>` : ""}
      ${tt.discount ? `<div><span>${t("cart.discount")}</span><span>−${money(tt.discount)}</span></div>` : ""}
      <div class="total"><span>${t("cart.total")}</span><span>${money(tt.total)}</span></div>
      ${belowMin ? `<div class="warn">${t("cart.min")}</div>` : ""}`;

    $("#checkoutBtn").disabled = !lines.length || belowMin;
    $("#checkoutBtn").style.opacity = $("#checkoutBtn").disabled ? .5 : 1;
    $$("#orderType button").forEach(b => b.classList.toggle("is-active", b.dataset.type === orderType));
    $("#drawer").classList.toggle("is-pickup", orderType === "pickup");
    store.set("hp-cart", cart); store.set("hp-type", orderType);
  }

  function addToCart(id, sourceEl) {
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    const d = byId(id);
    toast(`${d.name[lang]} — ${t("cart.added")}`);
    flyToCart(d, sourceEl);
  }

  function flyToCart(d, sourceEl) {
    const btn = $("#cartOpen");
    if (!sourceEl || !hasGsap || reduceMotion) { btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); return; }
    const from = sourceEl.getBoundingClientRect(), to = btn.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "fly";
    el.innerHTML = d.img ? `<img src="${d.img}" alt="">` : "";
    document.body.appendChild(el);
    gsap.set(el, { left: from.left + from.width / 2 - 30, top: from.top + from.height / 2 - 30 });
    gsap.to(el, {
      left: to.left + to.width / 2 - 30, top: to.top + to.height / 2 - 30,
      scale: .25, rotation: 360, duration: .9, ease: "power2.in",
      onComplete() { el.remove(); btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump"); }
    });
  }

  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add, add.closest(".dish, .signature__caption") || add); return; }
    const inc = e.target.closest("[data-inc]");
    if (inc) { cart[inc.dataset.inc]++; renderCart(); return; }
    const dec = e.target.closest("[data-dec]");
    if (dec) { cart[dec.dataset.dec]--; if (cart[dec.dataset.dec] <= 0) delete cart[dec.dataset.dec]; renderCart(); }
  });

  $("#orderType").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    orderType = b.dataset.type; renderCart();
  });

  const drawer = $("#drawer"), overlay = $("#overlay");
  function openCart(open) {
    drawer.classList.toggle("is-open", open);
    overlay.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("is-locked", open);
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  $("#cartOpen").addEventListener("click", () => openCart(true));
  $("#cartClose").addEventListener("click", () => openCart(false));
  overlay.addEventListener("click", () => openCart(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { openCart(false); toggleNav(false); } });

  function validate(form, extra = []) {
    let ok = true;
    $$("[required]", form).concat(extra).forEach(input => {
      const bad = !input.value.trim();
      input.classList.toggle("is-invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) toast(t("form.required"));
    return ok;
  }

  // Order submission. Hook this up to the restaurant's order backend / e-mail service.
  $("#checkoutForm").addEventListener("submit", e => {
    e.preventDefault();
    const form = e.currentTarget;
    const extra = orderType === "delivery" ? [form.address] : [];
    if (!validate(form, extra)) return;
    const order = {
      type: orderType,
      items: cartLines().map(l => ({ id: l.d.id, name: l.d.name.en, qty: l.q, price: l.d.price })),
      ...totals(),
      customer: Object.fromEntries(new FormData(form))
    };
    console.info("[Happy Panda] order", order);
    cart = {}; form.reset(); renderCart(); openCart(false);
    toast(t("cart.ok"), 4500);
  });

  /* ---------------- Reservation ---------------- */
  (function initReservation() {
    const form = $("#reserveForm");
    const date = form.date;
    const today = new Date();
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    date.min = iso(today); date.value = iso(today);
    const slots = [];
    for (let h = 10; h <= 21; h++) for (const m of ["00", "30"]) if (!(h === 21 && m === "30")) slots.push(`${String(h).padStart(2, "0")}:${m}`);
    $("#timeSelect").innerHTML = slots.map(s => `<option ${s === "19:00" ? "selected" : ""}>${s}</option>`).join("");

    // Reservation submission. Hook this up to the restaurant's booking backend / e-mail service.
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!validate(form)) return;
      console.info("[Happy Panda] reservation", Object.fromEntries(new FormData(form)));
      form.reset(); date.value = iso(today); $("#timeSelect").value = "19:00";
      toast(t("res.ok"), 4500);
    });
  })();

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg, ms = 2400) {
    const el = $("#toast");
    el.textContent = msg; el.classList.add("is-visible");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("is-visible"), ms);
  }

  /* ---------------- Mobile nav ---------------- */
  const burger = $("#burger"), nav = $("#nav");
  function toggleNav(open) {
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  }
  burger.addEventListener("click", () => toggleNav(!nav.classList.contains("is-open")));
  $$("a", nav).forEach(a => a.addEventListener("click", () => toggleNav(false)));

  /* ---------------- Hover tilt ---------------- */
  function bindTilt(els, max = 10) {
    if (reduceMotion || matchMedia("(hover: none)").matches) return;
    els.forEach(el => {
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 600);
      });
    });
  }

  /* ---------------- Signature ring ---------------- */
  const SIG = DISHES.filter(d => d.signature && d.img).concat(DISHES.filter(d => d.img && !d.signature)).slice(0, 8);
  let ringIndex = 0;

  function renderRing() {
    const ring = $("#ring");
    const step = 360 / SIG.length;
    ring.innerHTML = SIG.map((d, i) => `
      <div class="ring__item" data-i="${i}" style="transform: rotateY(${i * step}deg) translateZ(var(--r))">
        <img src="${d.img}" alt="${d.name[lang]}" loading="lazy">
        <div class="ring__label"><span class="hanzi">${d.hanzi}</span>${d.name[lang]}</div>
      </div>`).join("");
    updateCaption(ringIndex, true);
  }
  function updateCaption(i, force) {
    if (i === ringIndex && !force) return;
    ringIndex = i;
    const d = SIG[i];
    $("#sigCaption").innerHTML = `
      <h3>${d.name[lang]}</h3><p>${d.desc[lang]}</p>
      <div class="row"><span class="price">${money(d.price)}</span><button class="add-btn add-btn--gold" data-add="${d.id}">+ ${t("menu.add")}</button></div>`;
    if (hasGsap && !force && !reduceMotion) gsap.fromTo("#sigCaption > *", { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: .05, duration: .4 });
  }

  /* ---------------- Counters ---------------- */
  function runCounters() {
    $$(".count").forEach(el => {
      const to = +el.dataset.to;
      if (!hasGsap || reduceMotion) { el.textContent = to; return; }
      const o = { v: 0 };
      gsap.to(o, { v: to, duration: 2, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 85%" }, onUpdate: () => (el.textContent = Math.round(o.v)) });
    });
  }

  /* ---------------- Smooth scroll + 3D scroll scenes ---------------- */
  let lenis = null;

  function initScroll() {
    if (!hasGsap) { runCounters(); return; }
    gsap.registerPlugin(ScrollTrigger);

    if (!reduceMotion && window.Lenis) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(time => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    // Anchor links go through Lenis so pinned sections are handled smoothly
    $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6 });
      else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + scrollY, behavior: "smooth" });
    }));

    // Header state
    let lastY = 0;
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate(self) {
        const y = self.scroll();
        $("#header").classList.toggle("is-scrolled", y > 40);
        $("#header").classList.toggle("is-hidden", y > lastY && y > 600 && !nav.classList.contains("is-open"));
        lastY = y;
      }
    });

    // Active nav link
    $$(".nav a").forEach(a => {
      const sec = $(a.getAttribute("href"));
      if (!sec) return;
      ScrollTrigger.create({ trigger: sec, start: "top 50%", end: "bottom 50%", onToggle: s => a.classList.toggle("is-active", s.isActive) });
    });

    if (reduceMotion) { runCounters(); return; }

    // ---- Hero intro
    $$(".hero__title .split").forEach(line => {
      line.innerHTML = [...line.textContent].map(c => `<span class="char">${c}</span>`).join("");
    });
    const intro = gsap.timeline({ delay: .2 });
    intro.from(".hero__title .char", { yPercent: 110, rotateX: -90, opacity: 0, stagger: .045, duration: 1, ease: "power4.out", transformOrigin: "50% 100% -40px" })
      .from(".hero .eyebrow, .hero__lead, .hero__cta, .hero__facts li", { y: 30, opacity: 0, stagger: .08, duration: .8, ease: "power3.out" }, "-=.6")
      .from("#heroStage", { rotation: -30, scale: .6, opacity: 0, duration: 1.6, ease: "expo.out" }, .1)
      .from(".hero__badge", { scale: 0, opacity: 0, duration: .6, ease: "back.out(2)" }, "-=.6")
      .from(".lantern", { yPercent: -120, stagger: .12, duration: 1.4, ease: "elastic.out(1, .6)" }, .2);

    // ---- Hero: plate tilts back in 3D as you scroll, layers separate with depth
    const plate = $("#plate3d");
    const heroTl = gsap.timeline({ scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.set(plate, { transformPerspective: 1400 });
    heroTl.to(plate, { rotationX: 58, scale: 1.25, yPercent: 30, ease: "none" }, 0)
      .to(".plate3d__dish img", { rotation: 50, ease: "none" }, 0)
      .to(".hero__copy", { yPercent: -30, opacity: 0, ease: "none" }, 0)
      .to(".hero__vertical", { yPercent: -80, ease: "none" }, 0)
      .to(".hero__clouds", { yPercent: 20, ease: "none" }, 0);
    $$(".lantern").forEach(l => heroTl.to(l, { y: () => -window.innerHeight * .6 * +l.dataset.depth, ease: "none" }, 0));

    // Pointer parallax on the plate
    if (matchMedia("(hover: hover)").matches) {
      const ry = gsap.quickTo(plate, "rotationY", { duration: .8, ease: "power3" });
      $("#hero").addEventListener("pointermove", e => ry(((e.clientX / innerWidth) - .5) * 24));
    }

    // ---- Marquee skews with scroll velocity
    const skew = gsap.quickTo(".marquee__track", "skewX", { duration: .4, ease: "power3" });
    ScrollTrigger.create({ onUpdate: s => skew(gsap.utils.clamp(-12, 12, s.getVelocity() / -250)) });

    // ---- Journey: camera flies through a 3D tunnel of story cards
    const world = $("#journeyWorld");
    const cards = $$(".jcard", world);
    const isSmall = () => innerWidth < 900;
    const GAP = () => (isSmall() ? 1400 : 1800);
    const layoutCards = cam => {
      const gap = GAP();
      cards.forEach((c, i) => {
        const z = -i * gap + cam;                       // distance of card from the viewer
        const side = isSmall() ? 0 : (i % 2 ? 1 : -1) * Math.min(160, innerWidth * .08);
        const rotY = isSmall() ? 0 : (i % 2 ? -1 : 1) * gsap.utils.clamp(0, 18, -z / 80);
        let o = 1;
        if (z > 0) o = gsap.utils.clamp(0, 1, 1 - z / 350);               // passing the camera
        else if (z < -200) o = gsap.utils.clamp(0, 1, 1 - (-z - 200) / gap); // next card emerges from the fog
        c.style.transform = `translate(-50%, -50%) translate3d(${side}px, 0, ${z}px) rotateY(${rotY}deg)`;
        c.style.opacity = o;
        c.style.visibility = o <= 0.01 ? "hidden" : "visible";
        c.style.filter = z < -600 ? `blur(${Math.min(6, (-z - 600) / 400)}px)` : "none";
        c.style.pointerEvents = Math.abs(z) < 300 ? "auto" : "none";
      });
    };
    layoutCards(0);
    ScrollTrigger.create({
      trigger: "#journey",
      start: "top top",
      end: () => "+=" + innerHeight * cards.length * 1.1,
      pin: ".journey__viewport",
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        const camEnd = (cards.length - 1) * GAP() + 100;
        layoutCards(self.progress * camEnd);
        $("#journeyBar").style.width = self.progress * 100 + "%";
        gsap.set(".journey__intro", { opacity: 1 - gsap.utils.clamp(0, 1, self.progress * 6), y: -self.progress * 200 });
      },
      onRefresh: self => layoutCards(self.progress * ((cards.length - 1) * GAP() + 100))
    });

    // ---- Signature dishes: rotating 3D carousel driven by scroll
    const ring = $("#ring");
    ScrollTrigger.create({
      trigger: "#signature",
      start: "top top",
      end: () => "+=" + innerHeight * 2.4,
      pin: ".signature__pin",
      scrub: 1,
      onUpdate(self) {
        const n = SIG.length, step = 360 / n;
        const angle = self.progress * step * (n - 1);
        ring.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(-6deg) rotateY(${-angle}deg)`;
        updateCaption(Math.round(angle / step) % n);
      }
    });
    ring.style.transform = "translateZ(calc(var(--r) * -1)) rotateX(-6deg) rotateY(0deg)";
    gsap.from(".ring-stage", { scrollTrigger: { trigger: "#signature", start: "top 80%", end: "top top", scrub: true }, rotateX: 50, scale: .7, opacity: 0, ease: "none" });

    // ---- Section headings & cards reveal with 3D flip
    $$(".section-title, .section-head .eyebrow, .about__copy p, .reserve__copy p, .reserve__phone, .contacts dl > div")
      .filter(el => !el.closest(".journey, .signature"))
      .forEach(el => {
      gsap.from(el, { scrollTrigger: { trigger: el, start: "top 88%" }, y: 50, rotateX: -40, opacity: 0, duration: 1, ease: "power3.out", transformPerspective: 800, transformOrigin: "50% 100%" });
    });
    gsap.from(".dish", { scrollTrigger: { trigger: "#dishes", start: "top 85%" }, y: 60, rotateX: -30, opacity: 0, stagger: .08, duration: .9, ease: "power3.out", transformOrigin: "50% 0" });
    gsap.from(".step", { scrollTrigger: { trigger: ".steps", start: "top 85%" }, y: 80, rotateY: -35, opacity: 0, stagger: .15, duration: 1.1, ease: "power3.out", transformPerspective: 1000 });
    gsap.from(".del-info li", { scrollTrigger: { trigger: ".del-info", start: "top 90%" }, y: 30, opacity: 0, stagger: .08, duration: .7 });
    gsap.from("#reserveForm", { scrollTrigger: { trigger: "#reserve", start: "top 70%" }, rotateY: 25, x: 80, opacity: 0, duration: 1.2, ease: "power3.out", transformPerspective: 1200 });
    gsap.from(".contacts__map", { scrollTrigger: { trigger: "#contacts", start: "top 70%" }, rotateX: 30, y: 60, opacity: 0, duration: 1.2, ease: "power3.out", transformPerspective: 1200 });

    // ---- About: frame swings in 3D, image parallax, dragon draws itself
    gsap.fromTo(".about__frame", { rotateY: -30, rotateX: 10 }, { rotateY: 8, rotateX: -4, ease: "none", scrollTrigger: { trigger: "#about", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.fromTo(".about__frame img", { yPercent: -10 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: "#about", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(".about__stamp", { scrollTrigger: { trigger: ".about__media", start: "top 70%" }, scale: 0, rotate: -90, duration: 1, ease: "back.out(1.8)" });
    $$("#dragon path").forEach(p => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: p.classList.contains("dragon__fin") ? "2 10" : len, strokeDashoffset: len });
      gsap.to(p, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: "#about", start: "top 80%", end: "bottom 40%", scrub: true } });
    });

    runCounters();
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    $("#year").textContent = new Date().getFullYear();
    applyLang();
    bindTilt($$(".tilt"), 10);
    initScroll();
  }

  // Preloader: wait for fonts and hero image, but never longer than 2.5s
  const bar = $("#loaderBar");
  bar.style.width = "35%";
  const heroImg = $(".plate3d__dish img");
  const ready = Promise.race([
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      heroImg.complete ? Promise.resolve() : new Promise(r => { heroImg.onload = heroImg.onerror = r; })
    ]),
    new Promise(r => setTimeout(r, 2500))
  ]);
  ready.then(() => {
    bar.style.width = "100%";
    setTimeout(() => {
      $("#loader").classList.add("is-done");
      boot();
    }, 250);
  });
})();
