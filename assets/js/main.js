/* Happy Panda — interactions, cart, reservations and restrained 3D motion.
   Motion rules: scrolling never drives text. Content appears once and then stays put;
   only the dish gallery (signature carousel) and decorative pictures move. While the page
   is pinch-zoomed, all ambient motion pauses. */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const CATS = window.HP_CATEGORIES;
  const DISHES = window.HP_DISHES;
  const I18N = window.HP_I18N;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
  };

  /* ---------------- Zoom awareness ---------------- */
  // When someone pinch-zooms to read or look closer, freeze everything that moves on its own.
  const isZoomed = () => !!(window.visualViewport && window.visualViewport.scale > 1.05);
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", () => document.documentElement.classList.toggle("is-zoomed", isZoomed()));
  }

  /* ---------------- i18n ---------------- */
  const browserLang = (navigator.language || "en").slice(0, 2);
  let lang = store.get("hp-lang", ["lv", "ru", "en"].includes(browserLang) ? browserLang : "lv");
  const t = key => (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  const money = n => "€" + n.toFixed(2);

  /* Dishes with portions carry `prices: {small, large}`; others a single `price` */
  const portionsOf = d => (d.prices ? Object.keys(d.prices) : []);
  const priceOf = (d, portion) => (d.prices ? d.prices[portion] ?? Object.values(d.prices)[0] : d.price);
  const priceLabel = d => (d.prices ? Object.values(d.prices).map(money).join(" / ") : money(d.price));
  const chosenPortion = {};
  const portionFor = d => chosenPortion[d.id] || portionsOf(d)[0];
  const catHanzi = d => (CATS.find(c => c.id === d.cat) || {}).hanzi || "菜";
  const byId = id => DISHES.find(d => d.id === id);

  function applyLang() {
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach(el => { el.innerHTML = t(el.dataset.i18n); });
    $$(".lang button").forEach(b => b.classList.toggle("is-active", b.dataset.lang === lang));
    const hero = byId("918");
    if (hero) { $("#heroBadgeName").textContent = hero.name[lang]; $("#heroImg").alt = hero.name[lang]; }
    renderTabs(); renderDishes(); renderRing(); renderCart();
    if (hasGsap) ScrollTrigger.refresh();
  }
  $$(".lang button").forEach(b => b.addEventListener("click", () => {
    lang = b.dataset.lang; store.set("hp-lang", lang); applyLang();
  }));

  // Real counts from the menu: dishes (without sauces and drinks) and sections
  const dishCount = DISHES.filter(d => !["sauces", "drinks"].includes(d.cat) && d.num).length;
  $$(".js-dish-count").forEach(el => (el.textContent = Math.floor(dishCount / 10) * 10));
  $$(".js-cat-count").forEach(el => (el.textContent = CATS.length));

  /* ---------------- Menu ---------------- */
  let activeCat = CATS[0].id;
  const dishMedia = d => d.img
    ? `<img src="${d.img}" alt="${d.name[lang]}" loading="lazy" width="720" height="480"${d.fit ? ' class="is-contain"' : ""}>`
    : `<div class="dish__placeholder"><span class="hanzi">${catHanzi(d)}</span></div>`;

  function renderTabs() {
    $("#tabs").innerHTML = CATS.map(c => `
      <button class="tab ${c.id === activeCat ? "is-active" : ""}" role="tab" aria-selected="${c.id === activeCat}" data-cat="${c.id}">
        <span class="hanzi">${c.hanzi}</span>${c.name[lang]}
      </button>`).join("");
  }

  function renderInfo() {
    const c = CATS.find(x => x.id === activeCat);
    const parts = [c.hours && `<strong>${c.hours[lang]}</strong>`, c.note && c.note[lang]].filter(Boolean);
    const info = $("#menuInfo");
    info.hidden = !parts.length;
    info.innerHTML = parts.join("<br>");
  }

  function renderDishes(animate) {
    renderInfo();
    const list = DISHES.filter(d => d.cat === activeCat);
    $("#dishes").innerHTML = list.map(d => `
      <article class="dish" data-id="${d.id}">
        <div class="dish__media">
          ${dishMedia(d)}
          <div class="dish__tags">${d.spicy ? `<span class="tag">🌶 ${t("menu.spicy")}</span>` : ""}</div>
          ${d.num ? `<span class="dish__num">${d.num}</span>` : ""}
        </div>
        <div class="dish__body">
          <h3 class="dish__name">${d.name[lang]}</h3>
          ${d.desc[lang] ? `<p class="dish__desc">${d.desc[lang]}</p>` : ""}
          ${d.allergens && d.allergens[lang] ? `<p class="dish__allergens">${t("menu.allergens")}: ${d.allergens[lang]}</p>` : ""}
          <div class="dish__spacer"></div>
          ${portionsOf(d).length > 1 ? `
          <div class="portion" role="radiogroup" aria-label="${t("menu.portion")}">
            ${portionsOf(d).map(p => `<button type="button" data-portion="${p}" data-dish="${d.id}" class="${p === portionFor(d) ? "is-active" : ""}">${t("menu." + p)}</button>`).join("")}
          </div>` : ""}
          <div class="dish__foot">
            <span class="price">${priceOf(d, portionFor(d)) != null ? money(priceOf(d, portionFor(d))) : ""}</span>
            ${priceOf(d, portionFor(d)) != null ? `<button class="add-btn" data-add="${d.id}">+ ${t("menu.add")}</button>` : ""}
          </div>
        </div>
      </article>`).join("");
    if (canHover && !reduceMotion) bindTilt($$(".dish"), 5);
    if (animate && hasGsap && !reduceMotion) {
      gsap.fromTo(".dish", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .45, stagger: .03, ease: "power2.out", clearProps: "all" });
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

  // Cart keys are "<dish id>" or "<dish id>:<portion>"
  function cartLines() {
    return Object.entries(cart).map(([key, q]) => {
      const [id, portion] = key.split(":");
      const d = byId(id);
      return d && q > 0 && priceOf(d, portion) != null ? { key, d, portion, q, price: priceOf(d, portion) } : null;
    }).filter(Boolean);
  }
  const totals = () => ({ total: cartLines().reduce((s, l) => s + l.price * l.q, 0) });

  function renderCart() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.q, 0);
    const badge = $("#cartCount");
    badge.textContent = count; badge.classList.toggle("is-visible", count > 0);

    $("#cartItems").innerHTML = lines.length ? lines.map(({ key, d, portion, q, price }) => `
      <div class="citem">
        <div class="citem__thumb">${d.img ? `<img src="${d.img}" alt="">` : catHanzi(d)}</div>
        <div><div class="citem__name">${d.num ? d.num + " · " : ""}${d.name[lang]}</div>
          <div class="citem__price">${portion && portionsOf(d).length > 1 ? t("menu." + portion) + " " + t("menu.portion") + " · " : ""}${money(price)} × ${q}</div></div>
        <div class="qty"><button data-dec="${key}" aria-label="−">−</button><span>${q}</span><button data-inc="${key}" aria-label="+">+</button></div>
      </div>`).join("")
      : `<div class="drawer__empty"><img src="assets/img/logo.svg" alt="" width="72" height="72">${t("cart.empty")}</div>`;

    $("#totals").innerHTML = `
      <div class="total"><span>${t("cart.total")}</span><span>${money(totals().total)}</span></div>
      ${orderType === "delivery" ? `<div class="note">${t("cart.feeNote")}</div>` : ""}`;

    $("#checkoutBtn").disabled = !lines.length;
    $("#checkoutBtn").style.opacity = $("#checkoutBtn").disabled ? .5 : 1;
    $$("#orderType button").forEach(b => b.classList.toggle("is-active", b.dataset.type === orderType));
    $("#drawer").classList.toggle("is-pickup", orderType === "pickup");
    store.set("hp-cart", cart); store.set("hp-type", orderType);
  }

  function addToCart(id) {
    const d = byId(id);
    const key = d.prices ? `${id}:${portionFor(d)}` : id;
    cart[key] = (cart[key] || 0) + 1;
    renderCart();
    toast(`${d.name[lang]} — ${t("cart.added")}`);
    const btn = $("#cartOpen");
    btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
  }

  document.addEventListener("click", e => {
    const portionBtn = e.target.closest("[data-portion]");
    if (portionBtn) {
      const d = byId(portionBtn.dataset.dish);
      chosenPortion[d.id] = portionBtn.dataset.portion;
      const card = portionBtn.closest(".dish");
      $$("[data-portion]", card).forEach(b => b.classList.toggle("is-active", b === portionBtn));
      $(".price", card).textContent = money(priceOf(d, chosenPortion[d.id]));
      return;
    }
    const add = e.target.closest("[data-add]");
    if (add) { addToCart(add.dataset.add); return; }
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
    if (open) toggleNav(false);
    drawer.classList.toggle("is-open", open);
    overlay.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("is-locked", open);
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
      items: cartLines().map(l => ({ num: l.d.num, name: l.d.name.lv, portion: l.portion || null, qty: l.q, price: l.price })),
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

  /* ---------------- Mobile menu ---------------- */
  const burger = $("#burger"), mnav = $("#mnav");
  function toggleNav(open) {
    mnav.classList.toggle("is-open", open);
    mnav.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("is-menu-open", open);
  }
  burger.addEventListener("click", () => toggleNav(!mnav.classList.contains("is-open")));
  $$("a", mnav).forEach(a => a.addEventListener("click", () => toggleNav(false)));
  matchMedia("(min-width: 1081px)").addEventListener("change", e => { if (e.matches) toggleNav(false); });

  /* ---------------- Header ---------------- */
  const header = $("#header");
  const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- Hover tilt (mouse only) ---------------- */
  function bindTilt(els, max = 8) {
    els.forEach(el => {
      el.addEventListener("pointermove", e => {
        if (e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateY(${x * max}deg) rotateX(${-y * max}deg)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transition = "transform .5s cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 500);
      });
    });
  }

  /* ---------------- Signature carousel ---------------- */
  // A 3D ring of dish photos. It turns with the arrows, a swipe, a click on a side dish,
  // or slowly by itself while it is on screen — never with page scrolling.
  const SIG = ["801", "918", "919", "408", "701", "504", "1208", "907"].map(byId).filter(Boolean);
  const ring = $("#ring"), stage = $("#ringStage");
  let ringIndex = 0, ringTurns = 0, lastInteraction = 0, ringVisible = false, hovering = false;

  function renderRing() {
    const step = 360 / SIG.length;
    ring.innerHTML = SIG.map((d, i) => `
      <button class="ring__item" data-i="${i}" style="transform: rotateY(${i * step}deg) translateZ(var(--r))" aria-label="${d.name[lang]}">
        <img src="${d.img}" alt="" loading="lazy">
        <span class="ring__label"><span class="ring__num">${d.num}</span>${d.name[lang]}</span>
      </button>`).join("");
    turnTo(ringIndex, true);
  }

  function turnTo(i, instant) {
    const n = SIG.length;
    // Keep an unwrapped counter so the ring always turns the short way round
    const target = ((i % n) + n) % n;
    let delta = target - (((ringTurns % n) + n) % n);
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;
    ringTurns += delta;
    ringIndex = target;
    ring.style.transition = instant ? "none" : "";
    ring.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(-6deg) rotateY(${-ringTurns * 360 / n}deg)`;
    $$(".ring__item", ring).forEach((el, k) => el.classList.toggle("is-front", k === target));
    const d = SIG[target];
    $("#sigCaption").innerHTML = `
      <h3>${d.num} · ${d.name[lang]}</h3>${d.desc[lang] ? `<p>${d.desc[lang]}</p>` : ""}
      <div class="row"><span class="price">${priceLabel(d)}</span><button class="add-btn add-btn--gold" data-add="${d.id}">+ ${t("menu.add")}</button></div>`;
  }
  const userTurn = i => { lastInteraction = Date.now(); turnTo(i); };

  $("#ringPrev").addEventListener("click", () => userTurn(ringIndex - 1));
  $("#ringNext").addEventListener("click", () => userTurn(ringIndex + 1));
  ring.addEventListener("click", e => {
    const item = e.target.closest(".ring__item");
    if (item && !item.classList.contains("is-front")) userTurn(+item.dataset.i);
  });
  stage.addEventListener("mouseenter", () => (hovering = true));
  stage.addEventListener("mouseleave", () => (hovering = false));

  // Horizontal swipe; vertical scrolling and pinch-zoom stay with the browser (touch-action: pan-y pinch-zoom)
  let swipe = null;
  stage.addEventListener("pointerdown", e => { if (e.isPrimary) swipe = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener("pointerup", e => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) userTurn(ringIndex + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener("pointercancel", () => (swipe = null));

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => (ringVisible = en.isIntersecting), { threshold: .5 }).observe(stage);
  }
  if (!reduceMotion) {
    setInterval(() => {
      const idle = Date.now() - lastInteraction > 8000;
      if (ringVisible && idle && !hovering && !isZoomed() && !document.hidden) turnTo(ringIndex + 1);
    }, 5000);
  }

  /* ---------------- Entrance motion (plays once, never tied to scroll position) ---------------- */
  function initMotion() {
    if (!hasGsap || reduceMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Hero intro on load
    gsap.timeline({ delay: .1 })
      .from(".hero__line", { yPercent: 40, opacity: 0, stagger: .12, duration: 1, ease: "power3.out" })
      .from(".hero .eyebrow, .hero__lead, .hero__cta, .hero__facts li", { y: 20, opacity: 0, stagger: .06, duration: .7, ease: "power2.out" }, "-=.6")
      .from("#heroStage", { rotation: -20, scale: .8, opacity: 0, duration: 1.4, ease: "expo.out" }, .1)
      .from(".hero__badge", { scale: .6, opacity: 0, duration: .5, ease: "back.out(2)" }, "-=.5");

    // The plate follows the mouse a little (desktop only)
    if (canHover) {
      const plate = $("#plate3d");
      gsap.set(plate, { transformPerspective: 1400 });
      const ry = gsap.quickTo(plate, "rotationY", { duration: .8, ease: "power3" });
      const rx = gsap.quickTo(plate, "rotationX", { duration: .8, ease: "power3" });
      $("#hero").addEventListener("pointermove", e => {
        if (e.pointerType !== "mouse") return;
        ry(((e.clientX / innerWidth) - .5) * 18);
        rx(((e.clientY / innerHeight) - .5) * -10);
      });
    }

    const once = (targets, vars, trigger, start = "top 88%") =>
      $$(targets).forEach(el => gsap.from(el, { ...vars, scrollTrigger: { trigger: trigger || el, start, once: true } }));

    // Text only fades in; it never moves after that
    once(".section-head, .signature__head, .about__copy > *, .reserve__copy > *, .contacts dl > div, .delivery__lead", { y: 18, opacity: 0, duration: .7, ease: "power2.out" });
    // Pictures get the 3D entrance
    $$(".story__item").forEach((item, i) => {
      gsap.from($(".story__img", item), { rotateY: i % 2 ? -28 : 28, rotateX: 8, opacity: 0, scale: .92, duration: 1.2, ease: "power3.out", transformPerspective: 1200, scrollTrigger: { trigger: item, start: "top 85%", once: true } });
      gsap.from($(".story__text", item), { y: 18, opacity: 0, duration: .8, delay: .15, ease: "power2.out", scrollTrigger: { trigger: item, start: "top 85%", once: true } });
    });
    once(".about__frame", { rotateY: -24, opacity: 0, duration: 1.2, ease: "power3.out", transformPerspective: 1200 }, null, "top 85%");
    once(".step", { y: 30, opacity: 0, duration: .7, ease: "power2.out" });
    once(".ring-stage", { rotateX: 30, scale: .85, opacity: 0, duration: 1.2, ease: "power3.out" }, null, "top 85%");
    gsap.from(".dish", { y: 20, opacity: 0, stagger: .04, duration: .6, ease: "power2.out", clearProps: "all", scrollTrigger: { trigger: "#dishes", start: "top 90%", once: true } });

    // The dragon line draws itself once
    $$("#dragon path").forEach(p => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: p.classList.contains("dragon__fin") ? "2 10" : len, strokeDashoffset: len });
      gsap.to(p, { strokeDashoffset: 0, duration: 2.5, ease: "power1.inOut", scrollTrigger: { trigger: "#about", start: "top 75%", once: true } });
    });
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    $("#year").textContent = new Date().getFullYear();
    applyLang();
    initMotion();
  }

  // Preloader: wait for fonts and the hero image, but never longer than 2s
  const bar = $("#loaderBar");
  bar.style.width = "35%";
  const heroImg = $("#heroImg");
  Promise.race([
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      heroImg.complete ? Promise.resolve() : new Promise(r => { heroImg.onload = heroImg.onerror = r; })
    ]),
    new Promise(r => setTimeout(r, 2000))
  ]).then(() => {
    bar.style.width = "100%";
    setTimeout(() => { $("#loader").classList.add("is-done"); boot(); }, 200);
  });
})();
