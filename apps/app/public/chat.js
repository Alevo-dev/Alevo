/*
 * Alevo website chat. Paste once, before </body>:
 *   <script src="https://app.getalevo.com/chat.js" data-org="ORG_ID" async></script>
 * A chat bubble appears bottom-right; the visitor talks to the org's agent.
 * Options: data-position="left" puts the bubble bottom-left.
 * data-accent="#hex" sets the colour of the bubble, header, your messages and send button
 * (default: your Brand colour, set in Alevo under Integrations, else Alevo blue).
 * data-color="#hex" sets the text / icon colour on those (default: your font colour saved in Alevo, else
 * white, or navy on a light accent).
 * The same two can be set as --alevo-accent / --alevo-color in the page's CSS (e.g. per theme).
 * The greeting and the on/off switch are set in Alevo under Integrations → Chat widget.
 * The session (a random token) is kept in localStorage so the thread survives
 * page changes; only its hash is stored server-side.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var org = script.getAttribute("data-org");
  if (!org) return;
  var origin = new URL(script.src, location.href).origin;
  var left = script.getAttribute("data-position") === "left";
  var api = origin + "/api/chat/" + encodeURIComponent(org);
  var storeKey = "alevo-chat:" + org;
  // The visitor's own timezone, so the agent offers (and books) times in it.
  function tz() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {
      return "";
    }
  }
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  fetch(api, { headers: { accept: "application/json" } })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (cfg) {
      if (cfg && cfg.ok) mount(cfg);
    })
    .catch(function () {
      /* chat off or unreachable: render nothing */
    });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // Any CSS colour (hex, name, hsl, rgb) -> [r, g, b], by letting the browser compute it. Null when invalid.
  function rgb(c) {
    var probe = document.createElement("i");
    probe.style.color = c;
    if (!c || !probe.style.color) return null;
    document.body.appendChild(probe);
    var m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(getComputedStyle(probe).color);
    probe.remove();
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function lum(c) {
    var l = c.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  }
  function rgbCss(c) {
    return "rgb(" + c.join(",") + ")";
  }
  // The page's choice first (attribute, then CSS variable), then the saved colour, then Alevo blue.
  function setting(attr, cssVar) {
    return script.getAttribute(attr) || getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  }

  function mount(cfg) {
    // The name at the top of the window: the agent's, else the company's.
    var title = cfg.agentName || cfg.company;
    var accentRgb = rgb(setting("data-accent", "--alevo-accent")) || rgb(cfg.accent) || [46, 155, 230];
    var accent = rgbCss(accentRgb);
    // Text on the accent: white, unless the accent is too light for it (about 3:1), then navy.
    // Text on the accent: the page's data-color / --alevo-color, else the font colour saved in Alevo (only while the accent is
    // the saved one, not the page's own), else white, or navy when the accent is too light for white.
    var ownAccent = !!setting("data-accent", "--alevo-accent");
    var onRgb = rgb(setting("data-color", "--alevo-color")) || (!ownAccent && rgb(cfg.textColor)) || (lum(accentRgb) <= 0.3 ? [255, 255, 255] : [6, 9, 26]);
    var on = rgbCss(onRgb);
    var css = document.createElement("style");
    css.id = "alevo-chat-css";
    css.textContent =
      ".alevo-chat{--a:" +
      accent +
      ";--on:" +
      on +
      ";position:fixed;z-index:2147483000;bottom:24px;" +
      (left ? "left" : "right") +
      ":24px;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2030}" +
      ".alevo-chat *{box-sizing:border-box}" +
      ".alevo-chat-launch{width:56px;height:56px;border-radius:50%;border:0;background:var(--a);color:var(--on);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .15s}" +
      ".alevo-chat-launch:hover{transform:scale(1.05)}.alevo-chat-launch:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px var(--a)}" +
      ".alevo-chat-launch svg{width:26px;height:26px}" +
      ".alevo-chat-panel{position:absolute;bottom:72px;" +
      (left ? "left" : "right") +
      ":0;width:380px;max-width:calc(100vw - 48px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden}" +
      ".alevo-chat.is-open .alevo-chat-panel{display:flex}" +
      ".alevo-chat-head{flex:none;background:var(--a);color:var(--on);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}" +
      ".alevo-chat-head strong{display:block;font-size:15px}.alevo-chat-head span{display:block;font-size:12px;opacity:.85;margin-top:2px}" +
      ".alevo-chat-who{display:flex;align-items:center;gap:10px;min-width:0}.alevo-chat-av{flex:none;border-radius:50%;object-fit:cover;object-position:center}" +
      ".alevo-chat-who .alevo-chat-ini{flex:none;border-radius:50%;background:rgba(0,0,0,.16);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:16px;opacity:1;margin:0}" +
      ".alevo-chat-close{background:transparent;border:0;color:var(--on);cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center}.alevo-chat-close:hover{background:rgba(128,128,128,.25)}" +
      ".alevo-chat-log{flex:1;min-height:0;overscroll-behavior:contain;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:#f6f7f9}" +
      ".alevo-chat-msg{max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}" +
      ".alevo-chat-msg.them{align-self:flex-start;background:#fff;border:1px solid #e3e6ec;border-bottom-left-radius:4px}" +
      ".alevo-chat-msg.me{align-self:flex-end;background:var(--a);color:var(--on);border-bottom-right-radius:4px}" +
      ".alevo-chat-time{display:block;font-size:11px;line-height:1.2;opacity:.65;margin-top:3px;text-align:right}" +
      ".alevo-chat-sys{align-self:center;font-size:12px;color:#5c6578;text-align:center;padding:4px 8px}" +
      ".alevo-chat-typing{align-self:flex-start;background:#fff;border:1px solid #e3e6ec;border-radius:14px;border-bottom-left-radius:4px;padding:10px 12px;display:none;gap:4px}" +
      ".alevo-chat-typing.on{display:flex}.alevo-chat-typing i{width:6px;height:6px;border-radius:50%;background:#9aa3b5;animation:alevo-bounce 1.2s infinite}" +
      ".alevo-chat-typing i:nth-child(2){animation-delay:.2s}.alevo-chat-typing i:nth-child(3){animation-delay:.4s}" +
      "@keyframes alevo-bounce{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}" +
      (reduceMotion ? ".alevo-chat-typing i{animation:none;opacity:.6}" : "") +
      ".alevo-chat-foot{flex:none;border-top:1px solid #e3e6ec;padding:10px 12px 8px;background:#fff}" +
      ".alevo-chat-row{display:flex;gap:8px;align-items:flex-end}" +
      ".alevo-chat-row textarea{flex:1;resize:none;font:inherit;color:inherit;border:1px solid #cfd5e0;border-radius:10px;padding:9px 12px;max-height:120px;min-height:40px}" +
      ".alevo-chat-row textarea:focus{outline:2px solid var(--a);outline-offset:1px;border-color:var(--a)}" +
      ".alevo-chat-send{width:40px;height:40px;border-radius:10px;border:0;background:var(--a);color:var(--on);cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}" +
      ".alevo-chat-send:disabled{opacity:.5;cursor:not-allowed}.alevo-chat-send svg{width:18px;height:18px}" +
      ".alevo-chat-err{color:#c8323b;font-size:12px;margin:6px 2px 0;min-height:0}.alevo-chat-err:empty{display:none}" +
      ".alevo-chat-note{font-size:11px;color:#6b7386;margin:8px 2px 0;text-align:center}.alevo-chat-note a{color:inherit}" +
      "@media (max-width:480px){.alevo-chat.is-open{inset:0}.alevo-chat.is-open .alevo-chat-launch{display:none}.alevo-chat-panel{position:fixed;left:0;right:0;top:0;bottom:auto;width:auto;max-width:none;height:100vh;height:100dvh;max-height:none;border-radius:0}.alevo-chat-row textarea{font-size:16px}}";
    document.head.appendChild(css);

    // The agent's picture (any size the workspace chose), else the first letter of the name in a circle.
    var avPx = cfg.avatarUrl ? Math.min(Math.max(Number(cfg.avatarPx) || 60, 24), 96) : 40;
    var avatarHtml = cfg.avatarUrl
      ? '<img class="alevo-chat-av" src="' + esc(cfg.avatarUrl) + '" alt="" width="' + avPx + '" height="' + avPx + '">'
      : '<span class="alevo-chat-ini" aria-hidden="true" style="width:' + avPx + "px;height:" + avPx + 'px">' + esc(title.slice(0, 1).toUpperCase()) + "</span>";
    var root = document.createElement("div");
    root.className = "alevo-chat";
    root.innerHTML =
      '<div class="alevo-chat-panel" role="dialog" aria-label="Chat with ' +
      esc(title) +
      '" aria-modal="false">' +
      '<div class="alevo-chat-head"><div class="alevo-chat-who">' +
      avatarHtml +
      "<div><strong>" +
      esc(title) +
      "</strong><span>" +
      (cfg.online ? "Usually replies in under a minute" : "Leave a message and your email; we'll get back to you") +
      "</span></div></div>" +
      '<button type="button" class="alevo-chat-close" aria-label="Close chat"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<div class="alevo-chat-log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="alevo-chat-foot"><form class="alevo-chat-row" novalidate><textarea rows="1" placeholder="Write a message…" aria-label="Your message" maxlength="2000"></textarea>' +
      '<button type="submit" class="alevo-chat-send" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg></button></form>' +
      '<p class="alevo-chat-err" role="alert"></p>' +
      '<p class="alevo-chat-note">By chatting with us you agree to be contacted about your inquiry. Powered by Alevo · <a href="https://getalevo.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></p></div></div>' +
      '<button type="button" class="alevo-chat-launch" aria-label="Open chat" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
    document.body.appendChild(root);

    var panel = root.querySelector(".alevo-chat-panel");
    var launch = root.querySelector(".alevo-chat-launch");
    var log = root.querySelector(".alevo-chat-log");
    var form = root.querySelector("form");
    var input = root.querySelector("textarea");
    var sendBtn = root.querySelector(".alevo-chat-send");
    var err = root.querySelector(".alevo-chat-err");
    var typing = document.createElement("div");
    typing.className = "alevo-chat-typing";
    typing.setAttribute("aria-label", "Typing");
    typing.innerHTML = "<i></i><i></i><i></i>";

    var session = null; // { token, conversationId }
    try {
      session = JSON.parse(localStorage.getItem(storeKey) || "null");
    } catch (_e) {
      session = null;
    }
    var seen = {};
    var lastAt = null;
    var status = "new";
    var pollTimer = null;
    var fastUntil = 0;
    var open = false;

    function save() {
      try {
        if (session) localStorage.setItem(storeKey, JSON.stringify(session));
        else localStorage.removeItem(storeKey);
      } catch (_e) {
        /* private mode: the thread lasts this page only */
      }
    }

    function put(el) {
      log.insertBefore(el, typing.parentNode === log ? typing : null);
      log.scrollTop = log.scrollHeight;
    }

    // A day divider (Today, Yesterday, or the date) whenever the day changes, like WhatsApp, in the visitor's own clock.
    var lastDay = "";
    function dayLabel(d) {
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === new Date().toDateString()) return "Today";
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }

    // `at` (an ISO time) puts the time under the message and starts a new day divider when needed.
    function bubble(kind, text, at) {
      var when = at ? new Date(at) : null;
      if (when && !isNaN(when) && when.toDateString() !== lastDay) {
        lastDay = when.toDateString();
        var day = document.createElement("div");
        day.className = "alevo-chat-sys";
        day.textContent = dayLabel(when);
        put(day);
      }
      var el = document.createElement("div");
      el.className = kind === "sys" ? "alevo-chat-sys" : "alevo-chat-msg " + kind;
      el.appendChild(document.createTextNode(text));
      if (when && !isNaN(when)) {
        var t = document.createElement("span");
        t.className = "alevo-chat-time";
        t.textContent = when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        el.appendChild(t);
      }
      put(el);
      return el;
    }

    function showTyping(on) {
      if (on && typing.parentNode !== log) log.appendChild(typing);
      typing.className = "alevo-chat-typing" + (on ? " on" : "");
      if (on) log.scrollTop = log.scrollHeight;
    }

    // `polled`: the list came from the server's thread. Only those move the "after" cursor: the visitor's own message
    // (returned by the send) is newer than a reply that is written but not fetched yet, and moving the cursor past it
    // made that reply invisible until the visitor wrote again.
    function addMessages(list, polled) {
      var gotReply = false;
      list.forEach(function (m) {
        if (polled && (!lastAt || m.createdAt > lastAt)) lastAt = m.createdAt;
        if (seen[m.id]) return;
        seen[m.id] = true;
        bubble(m.author === "contact" ? "me" : "them", m.body, m.createdAt);
        if (m.author !== "contact") gotReply = true;
      });
      return gotReply;
    }

    function setStatus(next) {
      if (next === status) return;
      status = next;
      if (next === "handed_off") bubble("sys", "We've passed this on to the team. Someone will follow up with you.");
      if (next === "booked") bubble("sys", "Your meeting is booked. See you then!");
      if (next === "closed") bubble("sys", "This chat is paused. Send a message to pick it back up.");
    }

    function reset(message) {
      session = null;
      save();
      seen = {};
      lastAt = null;
      status = "new";
      lastDay = "";
      log.innerHTML = "";
      bubble("them", cfg.greeting);
      if (message) bubble("sys", message);
    }

    function poll() {
      clearTimeout(pollTimer);
      if (!open || !session || document.hidden) return;
      fetch(api + "/messages" + (lastAt ? "?after=" + encodeURIComponent(lastAt) : ""), {
        headers: { accept: "application/json", authorization: "Bearer " + session.token },
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { status: r.status, json: j };
          });
        })
        .then(function (r) {
          if (r.json && r.json.restart) return reset("That conversation has ended. Start a new one below.");
          if (!r.json || !r.json.ok) return;
          if (addMessages(r.json.messages, true)) {
            showTyping(false);
            fastUntil = 0;
          }
          setStatus(r.json.status);
        })
        .catch(function () {
          /* transient: try again next tick */
        })
        .then(function () {
          if (open && session) pollTimer = setTimeout(poll, Date.now() < fastUntil ? 1000 : 10000);
        });
    }

    function expectReply() {
      fastUntil = Date.now() + 90000;
      showTyping(true);
      setTimeout(function () {
        if (Date.now() >= fastUntil) showTyping(false);
      }, 90000);
      poll();
    }

    // Phones: the window is exactly the part of the screen that is visible, so when the keyboard opens the whole chat
    // moves up with it: the name bar stays at the top, the box stays above the keyboard and the newest message stays in view.
    var phone = window.matchMedia ? window.matchMedia("(max-width:480px)") : null;
    var vv = window.visualViewport;
    var lockedScroll = null;
    function atBottom() {
      return log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    }
    function fitViewport() {
      var on = open && phone && phone.matches && vv;
      if (!on) {
        panel.style.top = "";
        panel.style.height = "";
        return;
      }
      var stick = atBottom();
      panel.style.top = vv.offsetTop + "px";
      panel.style.height = vv.height + "px";
      if (stick) log.scrollTop = log.scrollHeight;
    }
    function lockPage(on) {
      var html = document.documentElement;
      if (on && phone && phone.matches && !lockedScroll) {
        lockedScroll = { html: html.style.overflow, body: document.body.style.overflow };
        html.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else if (!on && lockedScroll) {
        html.style.overflow = lockedScroll.html;
        document.body.style.overflow = lockedScroll.body;
        lockedScroll = null;
      }
    }
    if (vv) {
      vv.addEventListener("resize", fitViewport);
      vv.addEventListener("scroll", fitViewport);
    }
    if (phone && phone.addEventListener) phone.addEventListener("change", function () { fitViewport(); lockPage(open); });
    // Opening the keyboard: show the last message above it (the keyboard takes a moment to slide up).
    input.addEventListener("focus", function () {
      [0, 150, 350].forEach(function (ms) {
        setTimeout(function () {
          fitViewport();
          log.scrollTop = log.scrollHeight;
        }, ms);
      });
    });

    function setOpen(next) {
      open = next;
      lockPage(open);
      fitViewport();
      root.className = "alevo-chat" + (open ? " is-open" : "");
      launch.setAttribute("aria-expanded", open ? "true" : "false");
      launch.setAttribute("aria-label", open ? "Close chat" : "Open chat");
      if (open) {
        if (!log.childElementCount) {
          if (session) {
            lastAt = null;
            seen = {};
            poll();
          } else {
            bubble("them", cfg.greeting);
          }
        } else if (session) {
          poll();
        }
        setTimeout(function () {
          input.focus();
        }, 50);
      } else {
        clearTimeout(pollTimer);
        launch.focus();
      }
    }

    launch.addEventListener("click", function () {
      setOpen(!open);
    });
    root.querySelector(".alevo-chat-close").addEventListener("click", function () {
      setOpen(false);
    });
    panel.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") setOpen(false);
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && open && session) poll();
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = input.value.trim();
      if (!text || sendBtn.disabled) return;
      err.textContent = "";
      sendBtn.disabled = true;
      input.disabled = true;
      var headers = { "content-type": "application/json", accept: "application/json" };
      if (session) headers.authorization = "Bearer " + session.token;
      fetch(api + "/messages", { method: "POST", headers: headers, body: JSON.stringify({ message: text, timezone: tz() }) })
        .then(function (r) {
          return r.json().then(function (j) {
            return { status: r.status, json: j };
          });
        })
        .then(function (r) {
          if (r.json && r.json.restart) {
            reset("That conversation has ended. Send your message again to start a new one.");
            return;
          }
          if (!r.json || !r.json.ok) {
            err.textContent = (r.json && r.json.error) || "Could not send. Please try again.";
            return;
          }
          if (!session) {
            session = { token: r.json.token, conversationId: r.json.conversationId };
            save();
          }
          input.value = "";
          input.style.height = "auto";
          addMessages([r.json.message]);
          expectReply();
        })
        .catch(function () {
          err.textContent = "Could not send. Check your connection and try again.";
        })
        .then(function () {
          sendBtn.disabled = false;
          input.disabled = false;
          input.focus();
        });
    });
  }
})();
