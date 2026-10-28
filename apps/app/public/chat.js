/*
 * Alevo website chat. Paste once, before </body>:
 *   <script src="https://app.getalevo.com/chat.js" data-org="ORG_ID" async></script>
 * A chat bubble appears bottom-right; the visitor talks to the org's agent.
 * Options: data-position="left" puts the bubble bottom-left. Colour, greeting
 * and the on/off switch are set in Alevo under Integrations → Chat widget.
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

  function mount(cfg) {
    var accent = /^#[0-9a-f]{6}$/i.test(cfg.accent) ? cfg.accent : "#2e9be6";
    var css = document.createElement("style");
    css.id = "alevo-chat-css";
    css.textContent =
      ".alevo-chat{--a:" +
      accent +
      ";position:fixed;z-index:2147483000;bottom:24px;" +
      (left ? "left" : "right") +
      ":24px;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2030}" +
      ".alevo-chat *{box-sizing:border-box}" +
      ".alevo-chat-launch{width:56px;height:56px;border-radius:50%;border:0;background:var(--a);color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .15s}" +
      ".alevo-chat-launch:hover{transform:scale(1.05)}.alevo-chat-launch:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px var(--a)}" +
      ".alevo-chat-launch svg{width:26px;height:26px}" +
      ".alevo-chat-panel{position:absolute;bottom:72px;" +
      (left ? "left" : "right") +
      ":0;width:380px;max-width:calc(100vw - 48px);height:560px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden}" +
      ".alevo-chat.is-open .alevo-chat-panel{display:flex}" +
      ".alevo-chat-head{background:var(--a);color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}" +
      ".alevo-chat-head strong{display:block;font-size:15px}.alevo-chat-head span{display:block;font-size:12px;opacity:.85;margin-top:2px}" +
      ".alevo-chat-close{background:transparent;border:0;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center}.alevo-chat-close:hover{background:rgba(255,255,255,.15)}" +
      ".alevo-chat-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:#f6f7f9}" +
      ".alevo-chat-msg{max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}" +
      ".alevo-chat-msg.them{align-self:flex-start;background:#fff;border:1px solid #e3e6ec;border-bottom-left-radius:4px}" +
      ".alevo-chat-msg.me{align-self:flex-end;background:var(--a);color:#fff;border-bottom-right-radius:4px}" +
      ".alevo-chat-sys{align-self:center;font-size:12px;color:#5c6578;text-align:center;padding:4px 8px}" +
      ".alevo-chat-typing{align-self:flex-start;background:#fff;border:1px solid #e3e6ec;border-radius:14px;border-bottom-left-radius:4px;padding:10px 12px;display:none;gap:4px}" +
      ".alevo-chat-typing.on{display:flex}.alevo-chat-typing i{width:6px;height:6px;border-radius:50%;background:#9aa3b5;animation:alevo-bounce 1.2s infinite}" +
      ".alevo-chat-typing i:nth-child(2){animation-delay:.2s}.alevo-chat-typing i:nth-child(3){animation-delay:.4s}" +
      "@keyframes alevo-bounce{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}" +
      (reduceMotion ? ".alevo-chat-typing i{animation:none;opacity:.6}" : "") +
      ".alevo-chat-foot{border-top:1px solid #e3e6ec;padding:10px 12px 8px;background:#fff}" +
      ".alevo-chat-row{display:flex;gap:8px;align-items:flex-end}" +
      ".alevo-chat-row textarea{flex:1;resize:none;font:inherit;color:inherit;border:1px solid #cfd5e0;border-radius:10px;padding:9px 12px;max-height:120px;min-height:40px}" +
      ".alevo-chat-row textarea:focus{outline:2px solid var(--a);outline-offset:1px;border-color:var(--a)}" +
      ".alevo-chat-send{width:40px;height:40px;border-radius:10px;border:0;background:var(--a);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none}" +
      ".alevo-chat-send:disabled{opacity:.5;cursor:not-allowed}.alevo-chat-send svg{width:18px;height:18px}" +
      ".alevo-chat-err{color:#c8323b;font-size:12px;margin:6px 2px 0;min-height:0}.alevo-chat-err:empty{display:none}" +
      ".alevo-chat-note{font-size:11px;color:#6b7386;margin:8px 2px 0;text-align:center}.alevo-chat-note a{color:inherit}" +
      "@media (max-width:480px){.alevo-chat.is-open{inset:0}.alevo-chat.is-open .alevo-chat-launch{display:none}.alevo-chat-panel{position:fixed;inset:0;width:auto;max-width:none;height:auto;max-height:none;border-radius:0}}";
    document.head.appendChild(css);

    var root = document.createElement("div");
    root.className = "alevo-chat";
    root.innerHTML =
      '<div class="alevo-chat-panel" role="dialog" aria-label="Chat with ' +
      esc(cfg.company) +
      '" aria-modal="false">' +
      '<div class="alevo-chat-head"><div><strong>' +
      esc(cfg.company) +
      "</strong><span>" +
      (cfg.online ? "Usually replies in under a minute" : "Leave a message and your email; we'll get back to you") +
      "</span></div>" +
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

    function bubble(kind, text) {
      var el = document.createElement("div");
      el.className = kind === "sys" ? "alevo-chat-sys" : "alevo-chat-msg " + kind;
      el.textContent = text;
      log.insertBefore(el, typing.parentNode === log ? typing : null);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    function showTyping(on) {
      if (on && typing.parentNode !== log) log.appendChild(typing);
      typing.className = "alevo-chat-typing" + (on ? " on" : "");
      if (on) log.scrollTop = log.scrollHeight;
    }

    function addMessages(list) {
      var gotReply = false;
      list.forEach(function (m) {
        if (seen[m.id]) return;
        seen[m.id] = true;
        lastAt = m.createdAt;
        bubble(m.author === "contact" ? "me" : "them", m.body);
        if (m.author !== "contact") gotReply = true;
      });
      return gotReply;
    }

    function setStatus(next) {
      if (next === status) return;
      status = next;
      if (next === "handed_off") bubble("sys", "We've passed this on to the team. Someone will follow up with you.");
      if (next === "booked") bubble("sys", "Your meeting is booked. See you then!");
    }

    function reset(message) {
      session = null;
      save();
      seen = {};
      lastAt = null;
      status = "new";
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
          if (addMessages(r.json.messages)) {
            showTyping(false);
            fastUntil = 0;
          }
          setStatus(r.json.status);
        })
        .catch(function () {
          /* transient: try again next tick */
        })
        .then(function () {
          if (open && session) pollTimer = setTimeout(poll, Date.now() < fastUntil ? 2000 : 10000);
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

    function setOpen(next) {
      open = next;
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
      fetch(api + "/messages", { method: "POST", headers: headers, body: JSON.stringify({ message: text }) })
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
