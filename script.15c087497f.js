(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Match the original site's 30-day notice preference.
  const cookieNotice = $('#cookie-notice');
  if (cookieNotice) {
    let accepted = false;
    try { accepted = document.cookie.split(';').some(value => value.trim() === 'euCookiesAcc=true'); } catch (_) {}
    cookieNotice.hidden = accepted;
    const sizeNotice = () => document.documentElement.style.setProperty('--cookie-height', `${cookieNotice.hidden ? 0 : cookieNotice.offsetHeight}px`);
    sizeNotice();
    if ('ResizeObserver' in window) new ResizeObserver(sizeNotice).observe(cookieNotice);
    else window.addEventListener('resize', sizeNotice, {passive:true});
    $('#cookie-accept').addEventListener('click', () => {
      try { document.cookie = 'euCookiesAcc=true; Max-Age=2592000; Path=/; SameSite=Lax; Secure'; } catch (_) {}
      cookieNotice.hidden = true;
      sizeNotice();
    });
  }
  const story = $('.story');
  const scene = $('.story__scene');
  const leftDoor = $('.story__door--left');
  const rightDoor = $('.story__door--right');
  const doorFrame = $('.story__doorway');
  const textPanels = $$('.story__panel-copy');
  const shade = $('.story__veil');
  const dust = $('.story__dust');
  const hint = $('.story__hint');
  const progressBar = $('#story-progress-bar');
  const progressCaption = $('#story-progress-caption');
  const wasteFrame = $('.story__room--waste');
  const floorFrame = $('.story__room--floor');
  const glassFrame = $('.story__room--glass');
  const surfaceFrame = $('.story__room--surfaces');
  const finalFrame = $('.story__room--after');
  const storyStops = [0, .16, .30, .44, .58, .72, .86, 1];
  const visualStops = [0, .45, .54, .62, .71, .79, .87, 1];
  let currentChapter = -1;
  // Short photographic reveals are intentional: a stop-motion story, not video.
  // The photographic stages keep a locked camera and appear as whole stop-motion frames.
  function frameReveal(el, p, start) {
    // Each stage is a complete still: never expose half of a person with a wipe.
    const visible = p >= start;
    el.style.opacity = visible ? '1' : '0';
    el.style.clipPath = 'none';
  }
  function renderStory(progress) {
    const scrollProgress = clamp(progress);
    const segment = Math.min(storyStops.length - 2, storyStops.findIndex((stop, index) => index > 0 && scrollProgress <= stop) - 1);
    const p = lerp(visualStops[segment], visualStops[segment + 1], range(scrollProgress, storyStops[segment], storyStops[segment + 1]));
    // Act I: continuous dolly toward the door, door opens, camera passes through.
    // The camera stops completely at 50%. No camera movement in the still sequence.
    const approach = range(p, .055, .29);
    const passage = range(p, .29, .49);
    const zoom = innerWidth < 700 ? 1 + .10 * approach + .16 * passage - .26 * range(p, .445, .50) : 1 + .31 * approach + .38 * passage - .69 * range(p, .445, .50);
    scene.style.setProperty('--zoom', zoom.toFixed(4));
    scene.style.setProperty('--dolly-y', `${(-2 * passage * (1 - range(p, .445, .50))).toFixed(2)}%`);
    const opening = range(p, .255, .41);
    leftDoor.style.transform = `rotateY(${-105 * opening}deg)`;
    rightDoor.style.transform = `rotateY(${105 * opening}deg)`;
    doorFrame.style.opacity = String(1 - range(p, .445, .515));
    doorFrame.style.pointerEvents = 'none';
    hint.style.opacity = String(1 - range(p, .045, .15));

    // Act II: camera locked in one room. A new worker is introduced in each
    // cumulative still; reverse scrolling restores the corresponding earlier stage.
    frameReveal(wasteFrame, p, .54);
    frameReveal(floorFrame, p, .62);
    frameReveal(glassFrame, p, .71);
    frameReveal(surfaceFrame, p, .79);
    frameReveal(finalFrame, p, .87);
    const chapter = p < .45 ? 0 : p < .54 ? 1 : p < .62 ? 2 : p < .71 ? 3 : p < .79 ? 4 : p < .87 ? 5 : 6;
    if (chapter !== currentChapter) {
      currentChapter = chapter;
      textPanels.forEach((panel, index) => {
        panel.classList.toggle('is-active', index === chapter);
        panel.inert = index !== chapter;
      });
    }
    dust.style.opacity = String(.42 * range(p, .38, .51) * (1 - range(p, .785, .89)));
    shade.style.opacity = String(.88 - .22*range(p,.45,.52) + .10*range(p,.80,.89));
    progressBar.style.height = `${(scrollProgress*100).toFixed(1)}%`;
    const step = p < .26 ? 1 : p < .45 ? 2 : chapter + 2;
    progressCaption.textContent = `${String(step).padStart(2,'0')} / 08`;
  }
  function initStory() {
    if (!story || !scene) return;
    if (reduceMotion) return; // A readable static alternative is supplied in CSS.

    // The entire long <section> is the scroll track. Its child stays at top:0
    // via CSS position:sticky for the WHOLE story, independently of GSAP/CDNs.
    // This is deliberately not an inner-element ScrollTrigger pin, since a
    // pin-spacer inside a fixed-height parent allowed later sections to overlap.
    let raf = 0;
    function updateFromDocumentScroll() {
      const rect = story.getBoundingClientRect();
      const stickyHeight = $('.story__sticky').getBoundingClientRect().height;
      const distance = Math.max(1, story.offsetHeight - stickyHeight);
      renderStory(clamp(-rect.top / distance));
    }
    function scheduleUpdate() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateFromDocumentScroll();
      });
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('pageshow', scheduleUpdate);
    document.fonts?.ready.then(scheduleUpdate);
    scheduleUpdate();


  }
  // Swaps between three real grouped price lists.
  const priceTabs = $$('.pricing__tab');
  function showPriceTab(tab, moveFocus = false) {
    priceTabs.forEach(button => {
      const selected = button === tab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tab.focus({preventScroll:true});
    if (matchMedia('(max-width:680px)').matches) {
      tab.scrollIntoView({behavior:reduceMotion ? 'auto' : 'smooth',block:'nearest',inline:'nearest'});
    }
  }
  priceTabs.forEach((button, i) => {
    button.addEventListener('click', () => showPriceTab(button));
    button.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      let next = i;
      if (e.key === 'ArrowLeft') next = (i + priceTabs.length - 1) % priceTabs.length;
      if (e.key === 'ArrowRight') next = (i + 1) % priceTabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = priceTabs.length - 1;
      showPriceTab(priceTabs[next], true);
    });
  });
  // Each real case has its own native, keyboard-accessible comparison control.
  $$('.work-compare').forEach(compare => {
    const slider = $('.work-compare__range', compare);
    const sync = () => {
      compare.style.setProperty('--split', `${slider.value}%`);
      slider.setAttribute('aria-valuetext', `${slider.value}% фотографии до уборки`);
    };
    slider.addEventListener('input', sync);
    // Normal page scrolling remains available until the visitor activates the photo.
    compare.addEventListener('wheel', event => {
      if (event.ctrlKey || document.activeElement !== slider) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const scale = event.deltaMode === 1 ? 3 : event.deltaMode === 2 ? 30 : .12;
      const next = Math.round(clamp(+slider.value + delta * scale, 0, 100));
      if (next === +slider.value) return;
      event.preventDefault();
      slider.value = String(next);
      sync();
    }, {passive:false});
    sync();
  });
  // Accessible contact widget and mobile menu.
  const fab = $('#contact-fab');
  const contactToggle = $('#contact-toggle');
  const contactPanel = $('#contact-panel');
  function toggleContacts(open) {
    fab.classList.toggle('is-open', open);
    contactToggle.setAttribute('aria-expanded', String(open));
    contactPanel.inert = !open;
  }
  contactToggle?.addEventListener('click', () => toggleContacts(!fab.classList.contains('is-open')));
  document.addEventListener('click', e => { if (fab && !fab.contains(e.target)) toggleContacts(false); });
  const menuButton = $('.header__menu');
  const menu = $('#main-nav');
  function toggleMenu(open) {
    menu?.classList.toggle('is-open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    if (menuButton) menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  menuButton?.addEventListener('click', () => toggleMenu(!menu.classList.contains('is-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (fab.classList.contains('is-open')) {
      toggleContacts(false);
      contactToggle.focus();
    }
    if (menu.classList.contains('is-open')) {
      toggleMenu(false);
      menuButton.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (innerWidth > 1000 && menu.classList.contains('is-open')) toggleMenu(false);
  }, {passive:true});
  const header = $('.header');
  const backToTop = $('#back-to-top');
  const updateScrollControls = () => {
    header.classList.toggle('is-scrolled', scrollY > 24);
    backToTop.hidden = scrollY < 400;
  };
  window.addEventListener('scroll', updateScrollControls, {passive:true});
  window.addEventListener('pageshow', updateScrollControls);
  updateScrollControls();
  backToTop.addEventListener('click', () => {
    toggleContacts(false);
    $('.brand', header).focus({preventScroll:true});
    window.scrollTo({top:0,behavior:reduceMotion ? 'auto' : 'smooth'});
  });
  // Handle every internal CTA consistently, including embedded mobile browsers.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
    const hash = link.getAttribute('href');
    const target = hash === '#works' ? $('#services') : document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    toggleMenu(false);
    toggleContacts(false);
    const headerHeight = header.getBoundingClientRect().height;
    const top = hash === '#top' || hash === '#hero' ? 0 : Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerHeight - 12);
    const storyEnd = story.offsetTop + story.offsetHeight;
    const skipStory = link.classList.contains('story__skip') || (window.scrollY < storyEnd && top >= storyEnd - headerHeight - 12);
    const root = document.documentElement;
    const oldBehavior = root.style.scrollBehavior;
    if (skipStory || reduceMotion) root.style.scrollBehavior = 'auto';
    window.scrollTo({top, behavior:skipStory || reduceMotion ? 'auto' : 'smooth'});
    root.style.scrollBehavior = oldBehavior;
    target.setAttribute('tabindex', '-1');
    target.focus({preventScroll:true});
    // Keep file:// opening supported even if the browser restricts history writes.
    try { history.replaceState(null, '', hash); } catch (_) {}
  });
  // Validated contact form. On a static preview, open the user's email app;
  // on a PHP host the form can be switched to the included backend.
  const form = $('#request-form');
  const status = $('#request-status');
  const phoneInput = $('#request-phone');
  const nameInput = $('#request-name');
  const consentInput = $('input[name="consent"]', form);
  const phoneDigits = value => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 ? '7' + digits : digits.replace(/^8(?=\d{10}$)/, '7');
  };
  function formatPhone(value) {
    let digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (/^\+7/.test(value) || (/^[78]/.test(digits) && digits.length !== 10)) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    let result = '+7';
    if (digits.length) result += ' (' + digits.slice(0, 3);
    if (digits.length > 3) result += ') ' + digits.slice(3, 6);
    if (digits.length > 6) result += '-' + digits.slice(6, 8);
    if (digits.length > 8) result += '-' + digits.slice(8, 10);
    return result;
  }
  function fieldError(input, message) {
    input.setCustomValidity(message);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    document.getElementById(input.id + '-error').textContent = message;
    return !message;
  }
  function validateField(input) {
    if (input === nameInput) {
      const name = input.value.trim().replace(/ +/g, ' ');
      return fieldError(input, /^[\p{L}\p{M}][\p{L}\p{M} .’'\-]{1,119}$/u.test(name) ? '' : 'Введите имя: от 2 до 120 символов, без цифр и специальных знаков.');
    }
    if (input === phoneInput) {
      return fieldError(input, /^7[3489]\d{9}$/.test(phoneDigits(input.value)) ? '' : 'Введите полный российский номер: +7 и ещё 10 цифр.');
    }
    return fieldError(input, input.checked ? '' : 'Подтвердите согласие на обработку персональных данных.');
  }
  phoneInput.addEventListener('paste', event => {
    event.preventDefault();
    const digits = phoneDigits(event.clipboardData.getData('text'));
    phoneInput.value = /^7[3489]\d{9}$/.test(digits) ? formatPhone('+' + digits) : '';
    validateField(phoneInput);
  });
  [nameInput, phoneInput, consentInput].forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input === phoneInput) {
        const caret = input.selectionStart;
        const before = input.value.slice(0, caret).replace(/\D/g, '').length;
        const atEnd = caret === input.value.length;
        input.value = formatPhone(input.value);
        if (!atEnd && before) {
          let seen = 0, position = 0;
          while (position < input.value.length && seen < before) {
            if (/\d/.test(input.value[position])) seen++;
            position++;
          }
          input.setSelectionRange(position, position);
        }
      }
      if (input.getAttribute('aria-invalid') === 'true') validateField(input);
      status.textContent = '';
    });
  });
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'request__status';
    const fields = [nameInput, phoneInput, consentInput];
    const invalid = fields.filter(input => !validateField(input));
    if (invalid.length) {
      status.classList.add('is-error');
      status.textContent = 'Проверьте отмеченные поля.';
      invalid[0].focus();
      return;
    }
    if ($('#request-company').value.trim()) return;
    const name = nameInput.value.trim().replace(/ +/g, ' ');
    const phone = '+' + phoneDigits(phoneInput.value);
    // Optional PHP endpoint enabled through data-mode="php" when hosting supports PHP.
    if (form.dataset.mode === 'php' && location.protocol !== 'file:') {
      const button = $('[type="submit"]', form);
      if (button.disabled) return;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const data = new FormData(form);
        data.set('name', name);
        data.set('phone', phone);
        const response = await fetch(form.action, {method:'POST',body:data,headers:{Accept:'application/json'},signal:controller.signal});
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.message || 'Не удалось отправить заявку');
        status.classList.add('is-success');
        status.textContent = 'Заявка отправлена. Спасибо!';
        form.reset();
      } catch (err) {
        status.classList.add('is-error');
        status.textContent = err.name === 'AbortError' ? 'Ответ сервера задерживается. Позвоните нам перед повторной отправкой.' : 'Не удалось отправить заявку. Позвоните нам или попробуйте позже.';
      } finally { clearTimeout(timeout); button.disabled = false; form.removeAttribute('aria-busy'); }
      return;
    }
    const subject = 'Заявка на расчёт уборки с лендинга';
    const body = [`Имя: ${name}`,`Телефон: ${phone}`,'','Отправлено пользователем через почтовое приложение.'].join('\n');
    const href = `mailto:OOO-cleaning-service@ya.ru?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.classList.add('is-success');
    status.textContent = 'Откроется ваше почтовое приложение с заполненной заявкой. Нажмите «Отправить» в нём.';
    window.location.href = href;
  });
  // Native lazy loading keeps image URLs available without JavaScript.
  $$('main img').forEach(img => {
    img.loading = 'lazy';
    img.decoding = 'async';
    if (img.complete) return;
    const showImage = () => img.classList.remove('image-pending');
    img.addEventListener('load', showImage, {once:true});
    img.addEventListener('error', showImage, {once:true});
    img.classList.add('image-pending');
  });
  // Observe individual content blocks so tall sections do not stay hidden.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const candidates = $$('.section-heading,.objects-grid article,.benefits__grid article,.guarantee-photos,.guarantee-list li,.service-card,.work-card,.process__step,.pricing__panel,.reviews blockquote,.about__image,.about__content,.article-card,.seo__grid>div,.faq__grid>div,.request__grid>*,.section-bottom');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), {threshold:0,rootMargin:'0px 0px -32px 0px'});
    candidates.forEach(el => {
      const index = [...el.parentElement.children].indexOf(el);
      el.style.setProperty('--reveal-delay', `${Math.min(index, 2) * 80}ms`);
      el.classList.add('reveal');
      observer.observe(el);
    });
  }
  // Avoid adding an extra auto-scroll or delayed animation to the introduction.
  // Run immediately: external CDN delays must not block pinning or story progress.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStory, { once: true });
  } else {
    initStory();
  }
})();
