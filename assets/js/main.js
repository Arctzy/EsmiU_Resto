/* EsmiU Resto — site behaviour */
(() => {
  // Business details used by the opening-hours badge, the map and the booking/contact forms.
  // Hours are in the restaurant's local time zone. Day 0 = Sunday; null = closed.
  const SITE = {
    email: 'fmiguelmontesco@gmail.com',
    phone: '415-111-2233',
    address: '123 Sunnyvale Rd, San Jose',
    timeZone: 'America/Los_Angeles',
    hours: { 0: null, 1: [10, 17], 2: [10, 17], 3: [10, 17], 4: [10, 17], 5: [10, 17], 6: [13, 17] },
    slotMinutes: 30,
    lastSeatingBeforeClose: 60,
    maxGuests: 12,
    // Optional: a form endpoint that emails you each booking request (for example a Formspree form URL,
    // https://formspree.io/f/xxxxxxx). Left empty, bookings are confirmed on screen only and not sent anywhere.
    bookingEndpoint: '',
    // Map pin position. Currently on S De Anza Blvd (Saratoga–Sunnyvale Rd), San Jose —
    // swap in the restaurant's exact coordinates (right-click the spot in Google Maps to copy them).
    map: { lat: 37.3062, lng: -122.0323, zoom: 15 },
  };

  const LEAFLET = {
    css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    cssIntegrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
    js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    jsIntegrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
  };

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Time helpers ---------- */

  function restaurantNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SITE.timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
      minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')),
      date: `${get('year')}-${get('month')}-${get('day')}`,
    };
  }

  function formatTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
  }

  function openStatus() {
    const now = restaurantNow();
    const today = SITE.hours[now.day];
    if (today && now.minutes >= today[0] * 60 && now.minutes < today[1] * 60) {
      return { open: true, text: `Open now · until ${formatTime(today[1] * 60)}` };
    }
    for (let i = 0; i < 8; i++) {
      const day = (now.day + i) % 7;
      const hours = SITE.hours[day];
      if (!hours || (i === 0 && now.minutes >= hours[0] * 60)) continue;
      const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAY_NAMES[day];
      return { open: false, text: `Closed · opens ${when} at ${formatTime(hours[0] * 60)}` };
    }
    return { open: false, text: 'Closed' };
  }

  /* ---------- Header, parallax & back-to-top ---------- */

  function initScroll() {
    const header = $('[data-header]');
    const media = $('.hero__media, .page-hero__media');

    const toTop = document.createElement('a');
    toTop.className = 'to-top';
    toTop.href = '#top';
    toTop.setAttribute('aria-label', 'Back to top');
    toTop.innerHTML = `
      <svg class="to-top__ring" viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r="25" pathLength="1"/><circle cx="27" cy="27" r="25" pathLength="1"/>
      </svg>
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
    document.body.append(toTop);
    const progress = $('.to-top__ring circle:last-child', toTop);

    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header?.classList.toggle('is-solid', y > 24);
      toTop.classList.toggle('is-shown', y > 600);
      progress.style.strokeDashoffset = String(1 - (max > 0 ? Math.min(y / max, 1) : 0));
      if (media && !reduceMotion.matches && y < window.innerHeight * 1.2) {
        media.style.transform = `translate3d(0, ${(y * 0.3).toFixed(1)}px, 0)`;
      }
    };
    update();
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  function initNav() {
    const toggle = $('[data-nav-toggle]');
    const nav = $('#site-nav');
    if (!toggle || !nav) return;

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    window.matchMedia('(min-width: 1021px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }

  /* ---------- Page transitions ---------- */

  function initPageTransitions() {
    if (reduceMotion.matches) return;
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.protocol !== window.location.protocol || url.host !== window.location.host) return;
      if (url.pathname === window.location.pathname) return; // in-page anchor
      e.preventDefault();
      document.body.classList.add('is-leaving');
      setTimeout(() => { window.location.href = url.href; }, 420);
    });
    // Coming back via the browser's back button restores the page from cache — lift the curtain again.
    window.addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('is-leaving'); });
  }

  /* ---------- Split headlines ---------- */

  function initSplit() {
    $$('[data-split]').forEach((el) => {
      const text = el.textContent.trim().replace(/\s+/g, ' ');
      let i = 0;
      const words = text.split(' ').map((word) => {
        const chars = [...word].map((ch) => `<span class="char" style="--i:${i++}">${escapeHtml(ch)}</span>`).join('');
        return `<span class="word" aria-hidden="true">${chars}</span>`;
      });
      el.innerHTML = `<span class="visually-hidden">${escapeHtml(text)}</span>${words.join(' ')}`;
      el.classList.add('split');
    });
  }

  /* ---------- Opening hours ---------- */

  function initHours() {
    const status = openStatus();
    $$('[data-open-status]').forEach((el) => {
      el.textContent = status.text;
      el.classList.add('status', status.open ? 'is-open' : 'is-closed');
    });

    const { day } = restaurantNow();
    $$('[data-hours] [data-days]').forEach((row) => {
      const isToday = row.dataset.days.split(',').map(Number).includes(day);
      row.classList.toggle('is-today', isToday);
      if (isToday) row.setAttribute('aria-current', 'date');
    });
  }

  /* ---------- Scroll reveal ---------- */

  function initReveal() {
    // Children of [data-stagger] reveal one after another, in rows of up to four.
    $$('[data-stagger]').forEach((group) => {
      [...group.children].forEach((el, i) => {
        el.classList.add('reveal');
        el.style.setProperty('--d', `${(i % 4) * 0.08}s`);
      });
    });

    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    // Once revealed, drop the reveal transition so hover effects keep their own snappy timing.
    const settle = (el) => {
      const done = (e) => {
        if (e.target !== el || e.pseudoElement || e.propertyName !== 'opacity') return;
        el.removeEventListener('transitionend', done);
        el.classList.remove('reveal', 'reveal--left', 'reveal--right', 'reveal--zoom');
      };
      el.addEventListener('transitionend', done);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        settle(entry.target);
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Gallery filter & lightbox ---------- */

  function initFilters() {
    const group = $('[data-filters]');
    if (!group) return;
    const buttons = $$('[data-filter]', group);
    const tiles = $$('[data-category]');

    buttons.forEach((btn) => {
      const count = $('[data-count]', btn);
      const { filter } = btn.dataset;
      if (count) count.textContent = tiles.filter((t) => filter === 'all' || t.dataset.category === filter).length;
    });

    const indicator = document.createElement('span');
    indicator.className = 'filters__indicator';
    indicator.setAttribute('aria-hidden', 'true');
    group.prepend(indicator);
    group.classList.add('has-indicator');

    const moveIndicator = () => {
      const active = buttons.find((b) => b.getAttribute('aria-pressed') === 'true') || buttons[0];
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    };

    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const { filter } = btn.dataset;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      moveIndicator();

      tiles.forEach((tile) => {
        tile.hidden = filter !== 'all' && tile.dataset.category !== filter;
        tile.classList.remove('is-entering');
      });
      void group.offsetWidth; // restart the entrance animation
      tiles.filter((t) => !t.hidden).forEach((tile, i) => {
        tile.style.setProperty('--i', Math.min(i, 12));
        tile.classList.add('is-entering');
      });
    }));

    moveIndicator();
    window.addEventListener('resize', moveIndicator);
    if (document.fonts) document.fonts.ready.then(moveIndicator);
  }

  function initLightbox() {
    const tiles = $$('[data-full]');
    if (!tiles.length || typeof HTMLDialogElement === 'undefined') return;

    const arrow = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Photo viewer');
    dialog.innerHTML = `
      <p class="lb-count" aria-live="polite"></p>
      <figure><img alt=""><figcaption></figcaption></figure>
      <button class="lb-btn lb-close" type="button" aria-label="Close photo viewer">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <button class="lb-btn lb-prev" type="button" aria-label="Previous photo">${arrow}</button>
      <button class="lb-btn lb-next" type="button" aria-label="Next photo">${arrow}</button>`;
    document.body.append(dialog);

    const img = $('img', dialog);
    const caption = $('figcaption', dialog);
    const count = $('.lb-count', dialog);
    let list = [];
    let index = 0;

    const loaded = () => img.classList.add('is-loaded');
    img.addEventListener('load', loaded);
    img.addEventListener('error', loaded);

    const show = (i) => {
      index = (i + list.length) % list.length;
      const tile = list[index];
      img.classList.remove('is-loaded');
      img.src = tile.dataset.full;
      img.alt = $('img', tile).alt;
      caption.textContent = tile.dataset.caption || '';
      count.textContent = `${index + 1} / ${list.length}`;
      if (img.complete) requestAnimationFrame(loaded);
    };

    tiles.forEach((tile) => tile.addEventListener('click', () => {
      list = $$('[data-full]', tile.closest('[data-gallery]') || document).filter((t) => !t.hidden);
      show(list.indexOf(tile));
      dialog.showModal();
    }));

    $('.lb-close', dialog).addEventListener('click', () => dialog.close());
    $('.lb-prev', dialog).addEventListener('click', () => show(index - 1));
    $('.lb-next', dialog).addEventListener('click', () => show(index + 1));
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.tagName === 'FIGURE') dialog.close();
    });

    let startX = null;
    dialog.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    dialog.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* ---------- Map ---------- */

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    const load = (el) => new Promise((resolve, reject) => {
      el.onload = resolve;
      el.onerror = reject;
    });
    const css = Object.assign(document.createElement('link'), {
      rel: 'stylesheet', href: LEAFLET.css, integrity: LEAFLET.cssIntegrity, crossOrigin: '',
    });
    const js = Object.assign(document.createElement('script'), {
      src: LEAFLET.js, integrity: LEAFLET.jsIntegrity, crossOrigin: '',
    });
    // Leaflet's stylesheet goes before ours so the site's map styling wins.
    document.head.insertBefore(css, $('link[href*="styles.css"]'));
    document.head.append(js);
    return Promise.all([load(css), load(js)]).then(() => window.L);
  }

  function initMap() {
    const el = $('[data-map]');
    if (!el) return;
    const wrap = el.closest('.map-wrap') || el.parentElement;
    const status = $('[data-map-status]', wrap);
    const { lat, lng, zoom } = SITE.map;
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    const build = (L) => {
      const map = L.map(el, { center: [lat, lng], zoom, scrollWheelZoom: false, zoomControl: false });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = L.divIcon({
        className: 'map-pin',
        html: `
          <span class="map-pin__pulse"></span>
          <span class="map-pin__body">
            <svg viewBox="0 0 48 62" aria-hidden="true"><path d="M24 60C24 60 45 40 45 23A21 21 0 0 0 3 23C3 40 24 60 24 60Z"/></svg>
            <span class="map-pin__mark">R</span>
          </span>`,
        iconSize: [48, 62],
        iconAnchor: [24, 60],
        popupAnchor: [0, -62],
      });

      const marker = L.marker([lat, lng], { icon, title: 'EsmiU Resto', alt: 'EsmiU Resto location', riseOnHover: true })
        .addTo(map)
        .bindPopup(
          `<strong>EsmiU Resto</strong>${SITE.address}<br><a href="${directions}" target="_blank" rel="noopener">Get directions →</a>`,
          { className: 'map-popup', closeButton: false },
        );

      // Only zoom on scroll once the visitor has interacted with the map, so the page scrolls past it normally.
      map.once('click focus', () => map.scrollWheelZoom.enable());
      wrap.classList.add('is-ready');
      setTimeout(() => marker.openPopup(), reduceMotion.matches ? 0 : 1400);
    };

    const start = () => loadLeaflet().then(build).catch(() => {
      wrap.classList.add('is-failed');
      if (status) status.textContent = 'The map couldn’t load right now — open it in Google Maps instead.';
    });

    if (!('IntersectionObserver' in window)) {
      start();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      start();
    }, { rootMargin: '400px 0px' });
    io.observe(el);
  }

  /* ---------- Forms ---------- */

  const mailto = (subject, lines) =>
    `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;

  const CHECK = '<svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" pathLength="1"/><path d="m15 27 7.5 7.5L38 19" pathLength="1"/></svg>';

  function showSuccess(form, html) {
    const box = $('[data-form-success]', form);
    box.hidden = true;
    box.innerHTML = CHECK + html;
    void box.offsetWidth; // replay the entrance animation on repeat submits
    box.hidden = false;
    box.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function initBooking() {
    const form = $('[data-booking-form]');
    if (!form) return;
    const { date, guests } = form.elements;
    const slotsBox = $('[data-slots]', form);
    const dateError = $('[data-date-error]', form);
    const stepButtons = $$('[data-step]', form);

    date.min = restaurantNow().date;
    guests.max = SITE.maxGuests;

    const slotsFor = (value) => {
      const day = new Date(`${value}T12:00:00`).getDay();
      const hours = SITE.hours[day];
      if (!hours) return null;
      const slots = [];
      for (let m = hours[0] * 60; m <= hours[1] * 60 - SITE.lastSeatingBeforeClose; m += SITE.slotMinutes) slots.push(m);
      const now = restaurantNow();
      return value === now.date ? slots.filter((m) => m >= now.minutes + 30) : slots;
    };

    const setDateError = (message) => {
      date.setCustomValidity(message);
      dateError.textContent = message;
      date.closest('.field').classList.toggle('has-error', Boolean(message));
    };

    const slotsMessage = (text) => { slotsBox.innerHTML = `<p class="slots__empty">${text}</p>`; };

    const renderSlots = () => {
      const previous = new FormData(form).get('time');
      if (!date.value) {
        setDateError('');
        slotsMessage('Choose a date to see available times.');
        return;
      }
      if (date.value < date.min) {
        setDateError('Please choose today or a later date.');
        slotsMessage('Choose another date to see times.');
        return;
      }
      const slots = slotsFor(date.value);
      if (slots === null) {
        setDateError('We’re closed on Sundays — please choose another day.');
        slotsMessage('Closed on Sundays.');
        return;
      }
      if (!slots.length) {
        setDateError('Today’s seatings are full — please choose another day.');
        slotsMessage('No times left today.');
        return;
      }
      setDateError('');
      slotsBox.innerHTML = slots.map((m, i) => {
        const label = formatTime(m);
        const checked = label === previous ? ' checked' : '';
        return `<label class="slot" style="--i:${i}"><input type="radio" name="time" value="${label}" data-minutes="${m}" required${checked}><span>${label}</span></label>`;
      }).join('');
    };

    // Live summary in the reservation ticket
    const setSummary = (key, text) => {
      const el = $(`[data-summary="${key}"]`);
      const shown = text || '—';
      if (!el || el.textContent === shown) return;
      el.textContent = shown;
      el.classList.toggle('is-empty', !text);
      el.classList.remove('is-updated');
      void el.offsetWidth;
      el.classList.add('is-updated');
    };

    const syncStepper = () => {
      const n = Number(guests.value) || 0;
      stepButtons.forEach((btn) => {
        btn.disabled = btn.dataset.step < 0 ? n <= Number(guests.min) : n >= Number(guests.max);
      });
    };

    const updateSummary = () => {
      const data = new FormData(form);
      const n = Number(guests.value);
      setSummary('date', date.value && !date.validationMessage
        ? new Date(`${date.value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : '');
      setSummary('time', data.get('time') || '');
      setSummary('guests', n >= 1 ? `${n} ${n === 1 ? 'guest' : 'guests'}` : '');
      setSummary('occasion', data.get('occasion') || '');
      $$('.form-step', form).forEach((step) => {
        const fields = $$('input, select, textarea', step);
        step.classList.toggle('is-complete', fields.length > 0 && fields.every((f) => f.checkValidity()));
      });
      syncStepper();
    };

    stepButtons.forEach((btn) => btn.addEventListener('click', () => {
      const next = (Number(guests.value) || 0) + Number(btn.dataset.step);
      guests.value = Math.min(Number(guests.max), Math.max(Number(guests.min), next));
      updateSummary();
    }));

    date.addEventListener('change', renderSlots);
    form.addEventListener('input', updateSummary);
    form.addEventListener('change', updateSummary);
    renderSlots();
    updateSummary();

    const done = $('[data-booking-done]', form);
    const errorBox = $('[data-form-error]', form);
    const submit = $('[type="submit"]', form);
    const ticket = $('.ticket');

    const pad = (n) => String(n).padStart(2, '0');
    const calendarStamp = (day, mins) => `${day.replace(/-/g, '')}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`;

    // Posts the request to SITE.bookingEndpoint when one is set; otherwise the booking is only confirmed on the page.
    const sendBooking = async (payload) => {
      if (!SITE.bookingEndpoint) return;
      const res = await fetch(SITE.bookingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Booking request failed (${res.status})`);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = Object.fromEntries(new FormData(form));
      const minutes = Number($('[name="time"]:checked', form).dataset.minutes);
      const when = new Date(`${data.date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
      const party = `${data.guests} ${Number(data.guests) === 1 ? 'guest' : 'guests'}`;
      const reference = `ESM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      submit.classList.add('is-loading');
      submit.disabled = true;
      try {
        await sendBooking({
          reference, ...data, date: when,
          _subject: `Table reservation ${reference} – ${data.name}, ${when} at ${data.time}`,
        });
      } catch {
        errorBox.innerHTML = `We couldn’t send your request just now. Please try again, or call us on <a href="tel:${SITE.phone}">${SITE.phone}</a>.`;
        errorBox.hidden = false;
        return;
      } finally {
        submit.classList.remove('is-loading');
        submit.disabled = false;
      }

      const calendar = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
        + `&text=${encodeURIComponent('Table at EsmiU Resto')}`
        + `&dates=${calendarStamp(data.date, minutes)}/${calendarStamp(data.date, minutes + 90)}`
        + `&ctz=${encodeURIComponent(SITE.timeZone)}`
        + `&location=${encodeURIComponent(SITE.address)}`
        + `&details=${encodeURIComponent(`Reservation ${reference} · ${party}`)}`;

      done.innerHTML = `
        ${CHECK}
        <p class="eyebrow">Request received</p>
        <h3 tabindex="-1">Grazie, ${escapeHtml(data.name.split(' ')[0])}!</h3>
        <p>Your table for <strong>${party}</strong> on <strong>${when}</strong> at <strong>${escapeHtml(data.time)}</strong>
        has been requested. We’ll be in touch by phone or email to confirm.</p>
        <dl class="booking-done__ref"><dt>Reference</dt><dd>${reference}</dd></dl>
        <div class="booking-done__actions">
          <a class="btn btn--dark" href="${calendar}" target="_blank" rel="noopener">Add to calendar</a>
          <button class="btn btn--ghost" type="button" data-booking-again>Make another booking</button>
        </div>`;
      form.classList.add('is-done');
      done.hidden = false;
      if (ticket) ticket.classList.add('is-confirmed');
      form.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      $('h3', done).focus({ preventScroll: true });
    });

    done.addEventListener('click', (e) => {
      if (!e.target.closest('[data-booking-again]')) return;
      form.reset();
      form.classList.remove('is-done');
      done.hidden = true;
      if (ticket) ticket.classList.remove('is-confirmed');
      renderSlots();
      updateSummary();
      form.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      date.focus({ preventScroll: true });
    });
  }

  function initContactForm() {
    const form = $('[data-contact-form]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      const href = mailto(`${data.topic || 'Website enquiry'} – from ${data.name}`, [
        data.message,
        '',
        `— ${data.name}`,
        data.email,
        ...(data.phone ? [data.phone] : []),
      ]);
      window.location.href = href;
      showSuccess(form, `
        <h3>Thank you, ${escapeHtml(data.name.split(' ')[0])}!</h3>
        <p>Your email app should now be open with your message. Press send and we’ll get back to you soon.
        Nothing opened? <a href="${href}">Try again</a>.</p>`);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- Boot ---------- */

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  initSplit();
  initScroll();
  initNav();
  initPageTransitions();
  initHours();
  initReveal();
  initFilters();
  initLightbox();
  initMap();
  initBooking();
  initContactForm();
})();
