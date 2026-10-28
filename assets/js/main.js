/* EsmiU Resto — site behaviour */
(() => {
  // Business details used by the opening-hours badge and the booking/contact forms.
  // Hours are in the restaurant's local time zone. Day 0 = Sunday; null = closed.
  const SITE = {
    email: 'fmiguelmontesco@gmail.com',
    phone: '415-111-2233',
    timeZone: 'America/Los_Angeles',
    hours: { 0: null, 1: [10, 17], 2: [10, 17], 3: [10, 17], 4: [10, 17], 5: [10, 17], 6: [13, 17] },
    slotMinutes: 30,
    lastSeatingBeforeClose: 60,
  };

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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

  /* ---------- Header & navigation ---------- */

  function initHeader() {
    const header = $('[data-header]');
    if (!header) return;
    const update = () => header.classList.toggle('is-solid', window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
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
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Gallery filter & lightbox ---------- */

  function initFilters() {
    const buttons = $$('[data-filter]');
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      $$('[data-category]').forEach((tile) => {
        tile.hidden = filter !== 'all' && tile.dataset.category !== filter;
      });
    }));
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

    const show = (i) => {
      index = (i + list.length) % list.length;
      const tile = list[index];
      img.src = tile.dataset.full;
      img.alt = $('img', tile).alt;
      caption.textContent = tile.dataset.caption || '';
      count.textContent = `${index + 1} / ${list.length}`;
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

  /* ---------- Forms ---------- */

  const mailto = (subject, lines) =>
    `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;

  function showSuccess(form, html) {
    const box = $('[data-form-success]', form);
    box.innerHTML = html;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initBooking() {
    const form = $('[data-booking-form]');
    if (!form) return;
    const { date, time } = form.elements;
    const dateError = $('[data-date-error]', form);

    date.min = restaurantNow().date;

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

    const renderSlots = () => {
      time.innerHTML = '';
      time.disabled = true;
      if (!date.value) {
        setDateError('');
        time.append(new Option('Choose a date first', ''));
        return;
      }
      if (date.value < date.min) {
        setDateError('Please choose today or a later date.');
        time.append(new Option('Choose another date', ''));
        return;
      }
      const slots = slotsFor(date.value);
      if (slots === null) {
        setDateError('We’re closed on Sundays — please choose another day.');
        time.append(new Option('Closed on Sundays', ''));
        return;
      }
      if (!slots.length) {
        setDateError('Today’s seatings are full — please choose another day.');
        time.append(new Option('No times left today', ''));
        return;
      }
      setDateError('');
      time.disabled = false;
      time.append(new Option('Select a time', ''));
      slots.forEach((m) => time.append(new Option(formatTime(m), formatTime(m))));
    };

    date.addEventListener('change', renderSlots);
    renderSlots();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = Object.fromEntries(new FormData(form));
      const when = new Date(`${data.date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
      const href = mailto(`Table reservation – ${data.name}, ${when} at ${data.time}`, [
        'Hello EsmiU Resto,',
        '',
        'I would like to reserve a table:',
        '',
        `Name: ${data.name}`,
        `Phone: ${data.phone}`,
        `Email: ${data.email}`,
        `Date: ${when}`,
        `Time: ${data.time}`,
        `Guests: ${data.guests}`,
        ...(data.notes ? [`Notes: ${data.notes}`] : []),
        '',
        'Thank you!',
      ]);

      window.location.href = href;
      showSuccess(form, `
        <h3>Almost done, ${escapeHtml(data.name.split(' ')[0])}!</h3>
        <p>Your email app should now be open with your request for <strong>${data.guests}</strong> on
        <strong>${when}</strong> at <strong>${data.time}</strong>. Press send and we’ll confirm your table.</p>
        <p>Nothing opened? <a href="${href}">Try again</a> or call us on <a href="tel:${SITE.phone}">${SITE.phone}</a>.</p>`);
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
      const href = mailto(`Website enquiry from ${data.name}`, [
        data.message,
        '',
        `— ${data.name}`,
        data.email,
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
  initHeader();
  initNav();
  initHours();
  initReveal();
  initFilters();
  initLightbox();
  initBooking();
  initContactForm();
})();
