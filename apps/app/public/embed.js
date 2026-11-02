/*
 * Alevo contact form. Paste once:
 *   <div id="alevo-form"></div>
 *   <script src="https://app.getalevo.com/embed.js" data-org="ORG_ID" data-target="#alevo-form" async></script>
 *
 * It takes on the page it sits in: the page's font, text colour and background, and it
 * follows the page's light / dark theme (also when the page switches theme later).
 *
 * Options: data-target (where to render; default: right after the script tag),
 * data-accent="#hex" (colour of the left panel and button; default your Brand colour from
 * Alevo > Integrations, else the page's text colour),
 * data-color="#hex" (text colour on that panel and button; default your font colour from Alevo,
 * else white or navy by contrast; the form's own text follows the page),
 * data-details="false" (no phone / email / address / hours list in the left panel),
 * data-company (name used if the workspace has none).
 * Per-theme colours: define --alevo-accent / --alevo-color in your CSS under each theme
 * (for example under .dark); the data- attributes win when both are set.
 * The contact details come from Workspace > Business profile. Posts JSON to
 * /api/forms/ORG_ID.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var org = script.getAttribute("data-org");
  if (!org) return;
  var origin = new URL(script.src, location.href).origin;
  var api = origin + "/api/forms/" + encodeURIComponent(org);
  var targetSel = script.getAttribute("data-target");
  var host = targetSel ? document.querySelector(targetSel) : null;
  if (!host) {
    host = document.createElement("div");
    script.parentNode.insertBefore(host, script.nextSibling);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── Colours: read the page, never guess ────────────────────────────────
  function parse(c) {
    var m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(String(c || "").trim());
    if (!m) return null;
    var a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  // Any CSS colour (hex, name, hsl) -> rgb, by letting the browser compute it.
  function resolve(c) {
    var probe = document.createElement("i");
    probe.style.color = c;
    if (!probe.style.color) return null;
    host.appendChild(probe);
    var v = parse(getComputedStyle(probe).color);
    probe.remove();
    return v;
  }
  function lum(c) {
    var l = c.slice(0, 3).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function css(c) {
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }
  function pageBackground(el) {
    for (; el && el.nodeType === 1; el = el.parentElement) {
      var c = parse(getComputedStyle(el).backgroundColor);
      if (c && c[3] > 0.5) return c;
    }
    return [255, 255, 255, 1];
  }

  // Colour. Accent (panel + button): data-accent, else --alevo-accent in the page's CSS, else the Brand colour
  // saved in Alevo, else the page's own text colour. Text ON the accent: data-color, else --alevo-color, else
  // the font colour saved with the Brand colour, else white or navy by contrast. Everything else (the form's
  // own text, its background, the error red) follows the page, so light and dark pages both work.
  var savedAccent = ""; // the workspace Brand colour, from the details endpoint
  var savedText = ""; // and the font colour that goes with it
  function setting(attrName, cssVar) {
    return script.getAttribute(attrName) || getComputedStyle(host).getPropertyValue(cssVar).trim();
  }
  function paint(wrap) {
    var bg = pageBackground(host);
    var pageText = parse(getComputedStyle(host).color) || [17, 17, 17];
    var color = setting("data-color", "--alevo-color");
    var chosenOn = color ? resolve(color) : null;
    var own = setting("data-accent", "--alevo-accent");
    var custom = own || savedAccent;
    var brand = custom ? resolve(custom) : null;
    // The saved font colour belongs to the saved brand colour, so it is not used on an accent the page chose itself.
    var onSaved = !own && savedAccent && savedText ? resolve(savedText) : null;
    wrap.style.setProperty("--alevo-accent", css(brand || pageText));
    wrap.style.setProperty("--alevo-on", css(chosenOn || onSaved || (brand ? (lum(brand) > 0.18 ? [6, 9, 26] : [255, 255, 255]) : bg)));
    wrap.style.setProperty("--alevo-bg", css(bg));
    // Error red that stays readable (4.5:1) on both light and dark pages.
    wrap.style.setProperty("--alevo-danger", lum(bg) > 0.18 ? "#c8323b" : "#ff6b70");
  }
  // A site that switches theme after load (a toggle, or the OS flipping): repaint when the html / body
  // attributes change or the OS colour scheme does, so the card never keeps the old theme's colours.
  function watchTheme(wrap) {
    var queued = false;
    function repaint() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        paint(wrap);
        setTimeout(function () {
          paint(wrap); // once more after a fading theme transition
        }, 400);
      });
    }
    if (window.MutationObserver) {
      var mo = new MutationObserver(repaint);
      mo.observe(document.documentElement, { attributes: true });
      mo.observe(document.body, { attributes: true });
    }
    if (window.matchMedia) {
      var q = matchMedia("(prefers-color-scheme: dark)");
      if (q.addEventListener) q.addEventListener("change", repaint);
    }
  }

  if (!document.getElementById("alevo-form-css")) {
    var style = document.createElement("style");
    style.id = "alevo-form-css";
    style.textContent = [
      ".alevo-wrap{font:inherit;color:inherit;display:flex;flex-wrap:wrap;width:100%;overflow:hidden;border-radius:20px;border:1px solid rgba(128,128,128,.25);border:1px solid color-mix(in srgb,currentColor 14%,transparent);box-shadow:0 18px 50px -26px rgba(0,0,0,.3);box-sizing:border-box}",
      ".alevo-wrap *{box-sizing:border-box}",
      ".alevo-info{position:relative;overflow:hidden;flex:4 1 300px;min-width:0;display:flex;flex-direction:column;gap:32px;padding:36px;background:var(--alevo-accent);color:var(--alevo-on)}",
      ".alevo-info::before,.alevo-info::after{content:'';position:absolute;border-radius:50%;background:var(--alevo-on);opacity:.1;pointer-events:none}",
      ".alevo-info::before{width:240px;height:240px;top:-90px;right:-70px}",
      ".alevo-info::after{width:170px;height:170px;bottom:-60px;left:-50px}",
      ".alevo-info>*{position:relative}",
      ".alevo-eyebrow{margin:0 0 12px;font-size:.75em;font-weight:700;letter-spacing:.14em;text-transform:uppercase}",
      ".alevo-info h3{margin:0;font:inherit;font-size:1.9em;font-weight:700;line-height:1.15;letter-spacing:-.01em}",
      ".alevo-blurb{margin:12px 0 0;line-height:1.5}",
      ".alevo-info ul{list-style:none;margin:auto 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px 24px}",
      ".alevo-info li{display:flex;gap:12px;align-items:flex-start;min-width:0}",
      ".alevo-ic{flex:none;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(128,128,128,.25);background:color-mix(in srgb,var(--alevo-on) 18%,transparent)}",
      ".alevo-ic svg{width:16px;height:16px}",
      ".alevo-info small{display:block;font-size:.75em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1.4}",
      ".alevo-info li div{min-width:0;overflow-wrap:anywhere;white-space:pre-line}",
      ".alevo-info a{color:inherit;text-underline-offset:3px;display:inline-block;padding:6px 0}",
      ".alevo-form{flex:7 1 440px;min-width:0;padding:36px;background:var(--alevo-bg)}",
      ".alevo-form fieldset{border:0;margin:0;padding:0;min-width:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:22px 24px}",
      ".alevo-form fieldset:disabled{opacity:.7}",
      ".alevo-full{grid-column:1/-1}",
      ".alevo-form label.alevo-l{display:block;font-size:.8125em;font-weight:600;margin:0 0 2px}",
      ".alevo-form label.alevo-l span{font-weight:400;opacity:.65}",
      ".alevo-form input:not([type=checkbox]),.alevo-form textarea{display:block;width:100%;font:inherit;font-size:max(16px,1em);color:inherit;background:transparent;border:0;border-bottom:1px solid rgba(128,128,128,.6);border-bottom:1px solid color-mix(in srgb,currentColor 38%,transparent);border-radius:0;padding:10px 0;margin:0;transition:border-color .15s,box-shadow .15s}",
      ".alevo-form textarea{resize:vertical;min-height:110px}",
      ".alevo-form ::placeholder{color:inherit;opacity:.55}",
      ".alevo-form input:focus,.alevo-form textarea:focus{outline:0;border-bottom-color:var(--alevo-accent);box-shadow:0 1px 0 0 var(--alevo-accent)}",
      ".alevo-form .is-invalid{border-bottom-color:var(--alevo-danger)!important}",
      ".alevo-form .alevo-error{color:var(--alevo-danger);font-size:.8125em;margin:6px 0 0}",
      ".alevo-form .alevo-error:empty{display:none}",
      ".alevo-form .alevo-consent{display:flex;gap:10px;align-items:flex-start;font-size:.875em;padding:12px;border-radius:10px;background:rgba(128,128,128,.07);background:color-mix(in srgb,currentColor 5%,transparent)}",
      ".alevo-form .alevo-consent span{opacity:.8}",
      ".alevo-form .alevo-consent input{width:16px;height:16px;margin:2px 0 0;flex:none;accent-color:var(--alevo-accent)}",
      ".alevo-hp{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden}",
      ".alevo-form button{display:inline-flex;align-items:center;justify-content:center;gap:8px;justify-self:start;min-height:48px;font:inherit;font-weight:600;color:var(--alevo-on);background:var(--alevo-accent);border:0;border-radius:999px;padding:12px 26px;cursor:pointer;transition:filter .15s}",
      ".alevo-form button:hover:not(:disabled){filter:brightness(1.1)}",
      ".alevo-form button:focus-visible{outline:2px solid var(--alevo-accent);outline-offset:3px}",
      ".alevo-form button:disabled{cursor:not-allowed;opacity:.6}",
      ".alevo-form button svg{width:16px;height:16px}",
      ".alevo-spin{width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:alevo-spin .8s linear infinite}",
      "@keyframes alevo-spin{to{transform:rotate(360deg)}}",
      "@media (prefers-reduced-motion:reduce){.alevo-spin{animation:none}.alevo-form input,.alevo-form textarea,.alevo-form button{transition:none}}",
      "@media (max-width:640px){.alevo-info,.alevo-form{padding:24px}.alevo-info{gap:20px}.alevo-info h3{font-size:1.5em}.alevo-info::before,.alevo-info::after{display:none}.alevo-form button{width:100%;justify-self:stretch}}",
      ".alevo-note{font-size:.8em;opacity:.65;margin:20px 0 0}",
      ".alevo-note a{color:inherit}",
      ".alevo-thanks{text-align:center;padding:40px 24px;border-radius:14px;background:rgba(128,128,128,.07);background:color-mix(in srgb,currentColor 5%,transparent)}",
      ".alevo-thanks i{display:inline-flex;width:48px;height:48px;border-radius:50%;align-items:center;justify-content:center;background:var(--alevo-accent);color:var(--alevo-on);margin-bottom:14px}",
      ".alevo-thanks i svg{width:24px;height:24px}",
      ".alevo-thanks strong{display:block;font-size:1.125em}",
      ".alevo-thanks p{margin:6px 0 0;opacity:.7;font-size:.925em}",
    ].join("");
    document.head.appendChild(style);
  }

  // ── Markup ─────────────────────────────────────────────────────────────
  function svg(paths, extra) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (extra || "") +
      ">" +
      paths +
      "</svg>"
    );
  }
  var ICON = {
    phone:
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };

  // The coloured left panel: heading and blurb, plus the contact list when there is one.
  function infoColumn(d, company) {
    var rows = [];
    function row(icon, label, html) {
      rows.push('<li><span class="alevo-ic">' + svg(ICON[icon]) + "</span><div><small>" + label + "</small>" + html + "</div></li>");
    }
    if (d && d.phone) row("phone", "Call us", '<a href="tel:' + esc(d.phone.replace(/[^\d+]/g, "")) + '">' + esc(d.phone) + "</a>");
    if (d && d.email) row("mail", "Email us", '<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + "</a>");
    if (d && d.address)
      row(
        "pin",
        "Visit us",
        '<a href="https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(d.address.replace(/\s*\n\s*/g, ", ")) +
          '" target="_blank" rel="noopener noreferrer" style="text-decoration:none">' +
          esc(d.address) +
          "</a>",
      );
    if (d && d.hours) row("clock", "Hours", esc(d.hours));
    return (
      '<aside class="alevo-info"><div><p class="alevo-eyebrow">Get in touch</p><h3>' +
      (company ? "Contact " + esc(company) : "Send us a message") +
      '</h3><p class="alevo-blurb">Tell us what you need and we\u2019ll get back to you fast.</p></div>' +
      (rows.length ? "<ul>" + rows.join("") + "</ul>" : "") +
      "</aside>"
    );
  }

  var shown = null;
  function render(d) {
    savedAccent = (d && d.accent) || "";
    savedText = (d && d.textColor) || "";
    var named = (d && d.name) || script.getAttribute("data-company");
    var company = named || "this company";
    var id = "alevo" + Math.random().toString(36).slice(2, 7);
    var startedAt = Date.now();
    var wrap = document.createElement("div");
    wrap.className = "alevo-wrap";
    paint(wrap);
    shown = wrap;
    wrap.innerHTML =
      infoColumn(d, named) +
      '<form class="alevo-form" novalidate>' +
      '<div class="alevo-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      "<fieldset>" +
      '<div><label class="alevo-l" for="' + id + 'n">Full name</label><input id="' + id + 'n" name="name" placeholder="Pat Lee" autocomplete="name" aria-required="true"><p class="alevo-error" role="alert" data-for="name"></p></div>' +
      '<div><label class="alevo-l" for="' + id + 'e">Email</label><input id="' + id + 'e" name="email" type="email" placeholder="pat@example.com" autocomplete="email" aria-required="true"><p class="alevo-error" role="alert" data-for="email"></p></div>' +
      '<div><label class="alevo-l" for="' + id + 'p">Phone <span>(optional)</span></label><input id="' + id + 'p" name="phone" type="tel" placeholder="(614) 555-0100" autocomplete="tel"></div>' +
      '<div><label class="alevo-l" for="' + id + 'c">Company <span>(optional)</span></label><input id="' + id + 'c" name="company" placeholder="Your company" autocomplete="organization"></div>' +
      '<div class="alevo-full"><label class="alevo-l" for="' + id + 'm">How can we help?</label><textarea id="' + id + 'm" name="message" rows="5" placeholder="A few lines about what you need and when." aria-required="true"></textarea><p class="alevo-error" role="alert" data-for="message"></p></div>' +
      '<div class="alevo-full"><label class="alevo-consent"><input type="checkbox" name="consent" value="yes"><span>I agree to be contacted about my inquiry.</span></label><p class="alevo-error" role="alert" data-for="consent"></p></div>' +
      '<p class="alevo-error alevo-full" data-for="form"></p>' +
      '<button type="submit" class="alevo-full"><span class="alevo-ico">' + svg(ICON.send) + '</span><span class="alevo-label">Send message</span></button>' +
      "</fieldset>" +
      '<p class="alevo-note">Your details go to <span class="alevo-co">' +
      esc(company) +
      "</span>" +
      ' and are processed by Alevo. See the <a href="https://getalevo.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>' +
      "</form>";
    host.appendChild(wrap);
    watchTheme(wrap);

    var form = wrap.querySelector("form");
    var fieldset = form.querySelector("fieldset");
    var button = form.querySelector("button");
    var label = form.querySelector(".alevo-label");
    var ico = form.querySelector(".alevo-ico");

    function setError(name, text) {
      var el = form.querySelector('.alevo-error[data-for="' + name + '"]');
      if (el) el.textContent = text || "";
      var input = form.querySelector('[name="' + name + '"]');
      if (input) {
        input.classList.toggle("is-invalid", !!text);
        input.setAttribute("aria-invalid", text ? "true" : "false");
      }
    }
    function clearErrors() {
      ["name", "email", "message", "consent", "form"].forEach(function (n) {
        setError(n, "");
      });
    }
    function busy(on) {
      fieldset.disabled = on;
      button.setAttribute("aria-busy", on ? "true" : "false");
      form.setAttribute("aria-busy", on ? "true" : "false");
      label.textContent = on ? "Sending…" : "Send message";
      ico.innerHTML = on ? '<span class="alevo-spin" aria-hidden="true"></span>' : svg(ICON.send);
    }

    // Typing in a field (or ticking consent) dismisses that field's error.
    form.addEventListener("input", function (ev) {
      if (ev.target.name) setError(ev.target.name, "");
      setError("form", "");
    });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (fieldset.disabled) return;
      clearErrors();
      var data = new FormData(form);
      var payload = {
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        company: data.get("company"),
        message: data.get("message"),
        consent: data.get("consent") === "yes",
        website: data.get("website"),
        startedAt: startedAt,
        source: "embed",
        timezone: "",
      };
      try {
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch (e) {
        /* no Intl tz */
      }
      busy(true);
      fetch(api, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            return { status: res.status, json: json };
          });
        })
        .then(function (r) {
          if (r.json && r.json.ok) {
            form.innerHTML =
              '<div class="alevo-thanks" role="status"><i>' +
              svg(ICON.check) +
              "</i><strong>Thanks. We\u2019ll be in touch shortly.</strong><p>Your message has been received. " +
              esc(company) +
              " will reply by email or phone.</p></div>";
            return;
          }
          busy(false);
          var errors = (r.json && r.json.errors) || {};
          var any = false;
          Object.keys(errors).forEach(function (k) {
            setError(k, errors[k]);
            any = true;
          });
          if (!any) setError("form", (r.json && r.json.error) || "Something went wrong. Please try again.");
          var first = form.querySelector(".is-invalid");
          if (first) first.focus();
        })
        .catch(function () {
          busy(false);
          setError("form", "Could not send. Check your connection and try again.");
        });
    });
  }

  // The form shows even if the details can't be fetched (offline, slow, or turned off). If they
  // arrive after the 3 second wait, they are filled into the form that is already on the page.
  if (script.getAttribute("data-details") === "false") return render(null);
  var done = false;
  function once(d) {
    if (done) return;
    done = true;
    render(d);
  }
  function late(d) {
    var info = shown && shown.querySelector(".alevo-info");
    if (!info) return;
    var named = d.name || script.getAttribute("data-company");
    info.outerHTML = infoColumn(d, named);
    var co = shown.querySelector(".alevo-co");
    if (co && named) co.textContent = named;
    savedAccent = d.accent || "";
    savedText = d.textColor || "";
    paint(shown);
  }
  setTimeout(function () {
    once(null);
  }, 3000);
  fetch(api, { headers: { accept: "application/json" } })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (json) {
      var d = json && json.ok ? json : null;
      if (!done) once(d);
      else if (d) late(d);
    })
    .catch(function () {
      once(null);
    });
})();
