/*
 * Alevo website form. Paste once:
 *   <div id="alevo-form"></div>
 *   <script src="https://app.getalevo.com/embed.js" data-org="ORG_ID" data-target="#alevo-form" async></script>
 * Options: data-target (where to render; default: right after the script tag),
 * data-accent (button colour, default Alevo blue), data-company (name shown in the
 * privacy line). Inherits the page's font. Posts JSON to /api/forms/ORG_ID.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var org = script.getAttribute("data-org");
  if (!org) return;
  var origin = new URL(script.src, location.href).origin;
  var accent = script.getAttribute("data-accent") || "#2e9be6";
  var company = script.getAttribute("data-company") || "this company";
  var targetSel = script.getAttribute("data-target");
  var host = targetSel ? document.querySelector(targetSel) : null;
  if (!host) {
    host = document.createElement("div");
    script.parentNode.insertBefore(host, script.nextSibling);
  }

  if (!document.getElementById("alevo-form-css")) {
    var css = document.createElement("style");
    css.id = "alevo-form-css";
    css.textContent =
      ".alevo-form{--alevo-accent:" +
      accent +
      ";font:inherit;color:inherit;max-width:480px;box-sizing:border-box}" +
      ".alevo-form *{box-sizing:border-box}" +
      ".alevo-form fieldset{border:0;margin:0;padding:0;min-width:0;display:grid;gap:12px}" +
      ".alevo-form fieldset:disabled{opacity:.7}" +
      ".alevo-form input,.alevo-form textarea{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.5);border-radius:8px;padding:10px 12px}" +
      ".alevo-form input:focus,.alevo-form textarea:focus{outline:2px solid var(--alevo-accent);outline-offset:1px;border-color:var(--alevo-accent)}" +
      ".alevo-form .is-invalid{border-color:#e5484d}" +
      ".alevo-form .alevo-error{color:#e5484d;font-size:13px;margin:6px 0 0;min-height:0}" +
      ".alevo-form .alevo-error:empty{display:none}" +
      ".alevo-form .alevo-consent{display:flex;gap:10px;align-items:flex-start;font-size:14px;opacity:.85}" +
      ".alevo-form .alevo-consent input{width:16px;height:16px;margin:2px 0 0;accent-color:var(--alevo-accent)}" +
      ".alevo-form .alevo-hp{position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden}" +
      ".alevo-form button{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;font:inherit;font-weight:600;color:#06091a;background:var(--alevo-accent);border:0;border-radius:8px;padding:11px 16px;cursor:pointer}" +
      ".alevo-form button:disabled{cursor:not-allowed;opacity:.6}" +
      ".alevo-form .alevo-spin{width:16px;height:16px;border:2px solid rgba(6,9,26,.3);border-top-color:#06091a;border-radius:50%;animation:alevo-spin .8s linear infinite}" +
      "@keyframes alevo-spin{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion:reduce){.alevo-form .alevo-spin{animation:none}}" +
      ".alevo-form .alevo-note{font-size:12px;opacity:.7;margin:12px 0 0;text-align:center}" +
      ".alevo-form .alevo-note a{color:inherit}" +
      ".alevo-form .alevo-thanks{border:1px solid rgba(128,128,128,.3);border-radius:12px;padding:24px;text-align:center}" +
      ".alevo-form .alevo-thanks p{margin:4px 0 0;opacity:.7;font-size:14px}";
    document.head.appendChild(css);
  }

  var startedAt = Date.now();
  var form = document.createElement("form");
  form.className = "alevo-form";
  form.noValidate = true;
  form.innerHTML =
    '<div class="alevo-hp" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
    "<fieldset>" +
    '<div><input name="name" placeholder="Full name" aria-label="Full name" autocomplete="name"><p class="alevo-error" data-for="name"></p></div>' +
    '<div><input name="email" type="email" placeholder="Email" aria-label="Email" autocomplete="email"><p class="alevo-error" data-for="email"></p></div>' +
    '<input name="phone" type="tel" placeholder="Phone (optional)" aria-label="Phone" autocomplete="tel">' +
    '<input name="company" placeholder="Company (optional)" aria-label="Company" autocomplete="organization">' +
    '<textarea name="message" rows="4" placeholder="How can we help?" aria-label="Message"></textarea>' +
    '<div><label class="alevo-consent"><input type="checkbox" name="consent" value="yes"><span>I agree to be contacted about my inquiry.</span></label><p class="alevo-error" data-for="consent"></p></div>' +
    '<p class="alevo-error" data-for="form"></p>' +
    '<button type="submit"><span class="alevo-label">Send</span></button>' +
    "</fieldset>" +
    '<p class="alevo-note">Your details go to ' +
    company.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    }) +
    ' and are processed by Alevo. See the <a href="https://getalevo.com/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>';
  host.appendChild(form);

  var fieldset = form.querySelector("fieldset");
  var button = form.querySelector("button");
  var label = form.querySelector(".alevo-label");

  function setError(name, text) {
    var el = form.querySelector('.alevo-error[data-for="' + name + '"]');
    if (el) el.textContent = text || "";
    var input = form.querySelector('[name="' + name + '"]');
    if (input) input.classList.toggle("is-invalid", !!text);
  }
  function clearErrors() {
    ["name", "email", "consent", "form"].forEach(function (n) {
      setError(n, "");
    });
  }
  function busy(on) {
    fieldset.disabled = on;
    button.setAttribute("aria-busy", on ? "true" : "false");
    form.setAttribute("aria-busy", on ? "true" : "false");
    label.textContent = on ? "Sending…" : "Send";
    var spin = button.querySelector(".alevo-spin");
    if (on && !spin) {
      spin = document.createElement("span");
      spin.className = "alevo-spin";
      spin.setAttribute("aria-hidden", "true");
      button.insertBefore(spin, label);
    } else if (!on && spin) {
      spin.remove();
    }
  }

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
    fetch(origin + "/api/forms/" + encodeURIComponent(org), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
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
            '<div class="alevo-thanks" role="status"><strong>Thanks. We’ll be in touch shortly.</strong><p>Your message has been received.</p></div>';
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
})();
