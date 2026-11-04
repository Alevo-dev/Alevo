# Alevo — Testing manual

A hands-on walk through everything built so far, written for the two of us (owner + Laith)
to run against the deployed environment. No database or code access is needed for most of
it. Steps that need Alevo staff access (Vercel, Supabase, the admin console) are marked
**Staff**.

Mark each test as you go: `[x]` pass, `[!]` fail (write what you saw in the Notes line),
`[-]` skipped. Each section ends with a Notes block. When you hit a failure, copy the
"Reporting a problem" template at the bottom.

The developer checklist with database checks lives in `docs/manual-qa.md`; this manual
is the customer-eye view of the same features.

---

## 0. Before you start

### Environment

| What | Where |
|---|---|
| Product app | https://app.getalevo.com |
| Marketing site | https://getalevo.com |
| Admin console (**Staff**) | https://admin.getalevo.com |
| Inngest (background jobs, **Staff**) | app.inngest.com → the Alevo app |
| Supabase (database, **Staff**) | supabase.com → the production project |

### Test accounts and data

- Use a **test workspace**, not a real client's. Name it "QA <your name>".
- You need **two email addresses you can read** (one is the "lead", one is a second team member) and **your own mobile phone** for SMS and calls.
- Have a **Slack channel** with an incoming webhook you can post to, and a **Google Calendar or Microsoft 365** account you are happy to put test events on.
- For the phone tests the workspace needs a Twilio number assigned by Alevo (**Staff** sets it under Workspace → Agent → Channels).
- For the ConnectWise tests you need the Manage sandbox (see section 14).
- Test in **Chrome desktop** first. Re-run the "phone width" lines in section 17 on a real phone or with the browser narrowed to about 390px.

### Who tests what

| Area | Owner | Laith |
|---|---|---|
| Sign up, workspace, team, settings | ✓ | ✓ |
| Lead channels (form, chat, email, SMS, phone) | ✓ (as the lead) | ✓ (watches the app) |
| Booking, hand-off, alerts | ✓ | ✓ |
| Dashboard, conversations, meetings | ✓ | ✓ |
| ConnectWise | | ✓ |
| Admin console, plan limits, provisioning | | ✓ (**Staff**) |

---

## 1. Marketing site (getalevo.com)

- [ ] Home page loads in light and dark (theme toggle in the header). The hero demos animate; the "Start 30-day free trial" buttons open the app's sign-up page.
- [ ] Every header/footer link opens: Features, Pricing, About, Contact, Privacy, Terms, Refunds, Cookies, Security.
- [ ] Pricing: every trial mention says **30-day**; the fine print lists trial, cancel-anytime, no refunds, pause-at-limit and the overage rates.
- [ ] Footer shows "© 2026 Alevo Inc.", the Carleton Place address, admin@getalevo.com and the phone number.
- [ ] Cookie banner appears on the first visit. **Decline** hides it; reload → it stays hidden. `/cookies` shows your choice and lets you change it.
- [ ] Contact form: submit empty → inline errors under the fields (no browser popup); a real submission shows thanks.
- [ ] Open `getalevo.com/nothing-here` → a styled 404 with "Back to home", "Contact us", "Sign in to the app".

Notes:

---

## 2. Sign up, sign in, account

Use a signed-out window (incognito).

### 2.1 Create an account with email
- [ ] app.getalevo.com → **Create account** tab. Submit empty → inline "required" messages under each field.
- [ ] Fill name, company, work email, password, tick the terms → **Create account** → "We sent a code to …". Enter the code → you land on the Dashboard inside a workspace named after the company.
- [ ] Wrong code → "Invalid code" inline with **Send a new code**.

### 2.2 Sign in / sign out
- [ ] Avatar (top right) → **Sign out** → lands on the sign-in page.
- [ ] Sign in with a wrong password → the error shows inline under the form, no popup. Correct password → Dashboard.
- [ ] While signed in, open `app.getalevo.com/sign-in` directly → bounces straight to the Dashboard (no form flash).
- [ ] While signed out, open `app.getalevo.com/dashboard` → redirected to sign-in.

### 2.3 Forgot password
- [ ] **Forgot password?** → enter email → code arrives → code + new password → signed in. Sign out and sign in with the new password.

### 2.4 Google sign-in
- [ ] **Continue with Google** with a Google account that has never used Alevo → "Pick a workspace" → create one → Dashboard.
- [ ] Sign out, Continue with Google again → straight to the Dashboard.

### 2.5 Manage account (avatar → Manage account)
- [ ] Two-pane dialog: **Profile** and **Security**. Esc and the × close it.
- [ ] Profile → **Update profile**: change your name and add a photo → "Profile saved."; the avatar in the top bar updates.
- [ ] Profile → **Email addresses** → **+ Add email address** → a code arrives at the new address → verified; it appears with a ⋯ menu (Set as primary / Remove).
- [ ] Security → **Change password** (or **Set password** on a Google-only account) → inline errors for a wrong current password; success → "Password updated."
- [ ] Security → **Active devices** lists this browser as "This device". Sign in from a second browser → it appears; ⋯ → **Sign out of device** → that browser is signed out.
- [ ] Security → **Delete account** (use a throwaway account): confirm → signed out, and the account is gone from the team list.

Notes:

---

## 3. Workspaces

### 3.1 Workspace picker (bottom of the sidebar)
- [ ] Opens upward; shows the current workspace on top, **Workspace settings**, your other workspaces, **Create workspace**.
- [ ] **Create workspace**: empty name → inline error; add a logo (an image over 10 MB → inline error); a real name creates it and lands you on its Dashboard with the logo in the picker.
- [ ] Switch to another workspace → full page load, and every screen (Dashboard, Conversations, Workspace tabs) shows only that workspace's data.

### 3.2 Manage workspace (picker → Manage)
- [ ] **General**: Update profile → change name / logo → "Workspace updated." and the sidebar updates at once.
- [ ] **General → Workspace ID**: a long id in monospace with a copy icon → "Copied." It matches the `data-org` value in the website-form snippet (section 7.1).
- [ ] **General → Leave workspace** (as a member, not the only owner): confirm → you land on the Dashboard of another workspace you belong to (or the sign-in page if you have none). The left workspace is gone from the picker.
- [ ] As the **only owner**, Leave is disabled with a note saying why.
- [ ] **General → Delete workspace** (a throwaway workspace): confirm "Delete <name>?" → you land in another workspace or on sign-in; the workspace is gone from the picker.
- [ ] **Members** tab: list, search box, **Invite** (see section 4).

Notes:

---

## 4. Team (Workspace → Members, and Manage → Members)

- [ ] Invite the second email as **Rep** → "Invitation sent."; it appears under pending invites with the role.
- [ ] Open the invite email in another browser. New address → name + password → **Create account and join** → lands in the inviting workspace. (Also try **Continue with Google** with the same address.)
- [ ] Back in Members the invite is now a member with role **Rep**.
- [ ] Change their role to Admin → **Save** → "Role updated."; reload keeps it.
- [ ] Try to demote or remove the **last owner** → blocked with a message.
- [ ] **Remove** a member (red trash can) → confirm → "Member removed." They lose access on their next action.
- [ ] **Revoke** a pending invite → confirm → "Invite revoked."; the link in the email no longer works.
- [ ] Sign in as the **Rep**: Workspace → Agent, Knowledge, Business profile and Integrations show "This part is for owners and admins"; Members shows "You need an admin role". Conversations, Meetings and Dashboard work.
- [ ] A **Viewer** sees Integrations cards but no "Connect a tool" button and no key fields.

Notes:

---

## 5. Business profile (Workspace → Business profile)

Owners/admins only.

- [ ] Fill Company name, Business address, What you offer, Ideal customer, Qualifying criteria, Disqualifiers, Tone and voice (dropdown with five presets), Sign off as → the **Unsaved changes** bar slides in bottom-right → **Save changes** → "Business profile saved."; reload keeps everything.
- [ ] **Discard** on the bar puts every field back. Navigating away with unsaved edits → "Leave without saving?" dialog; **Stay** keeps your edits.
- [ ] **Contact details** card: Phone, Email, Opening hours. An invalid email → red border + "Enter a valid email address." under it. Valid values save and show on the hosted contact form (section 7.1).
- [ ] **Import from website** (top right): enter your real website without `https://` → "Reading your site…" → fields fill in and a note reads "Filled N fields. Review them, then save." Nothing is saved until you press Save. Check the imported text against the site: nothing invented.
- [ ] Import with text already in Company name: default **Fill empty fields only** keeps your text; **Replace existing values** overwrites it.
- [ ] Bad addresses show inline messages (empty, `not a url!`, a made-up domain). Qualifying criteria and Disqualifiers are never touched by an import.
- [ ] With the agent **on**, blank the Company name and Save → "Required while the agent is on" under the field.

Notes:

---

## 6. Agent settings (Workspace → Agent)

Each card has its switch on its title line. One Save bar for the page.

### 6.1 Agent on/off
- [ ] With an incomplete Business profile, turning **Agent** on and saving → red error under the header linking to the profile; the switch stays off.
- [ ] Complete the profile, turn Agent on → Save → "Agent settings saved."; the sidebar reads **Agent: Online** with a pulsing dot; the Dashboard says "Live."
- [ ] Turn it off → sidebar "Agent: Offline — Manage"; Dashboard shows "The agent is off" with a **Turn the agent on** button.

### 6.2 Follow-up
- [ ] Default timezone dropdown, Earliest / Latest hour. Earliest later than Latest → "The start time must be before the end time." under the hours; nothing saved. Set your real timezone (America/Toronto) and save.

### 6.3 Channels
- [ ] SMS number is the Twilio number (**Staff** fills it). The hint says SMS is off while it is blank.

### 6.4 Notifications
- [ ] **Email the team** switch (on by default). Flip it → Save bar → Save → reload keeps it. (Effect tested in section 11.)

### 6.5 Booking
- [ ] Nothing connected: the switch is disabled, hint ends "Nothing is connected yet.", a **Connect a booking tool** button → Integrations.
- [ ] After connecting a calendar under Integrations (section 7.3), Booking is **on by itself** with that calendar chosen. Google / Microsoft show Meeting length + working hours beneath; Cal.com / Calendly show nothing beneath.
- [ ] Two tools connected → a "Books through" chooser listing only those.
- [ ] Turn Booking off → Save: the row still names the connected tool with "Turn booking on and the agent books through it."

### 6.6 Phone calls
- [ ] With no number → turning calls on shows the error under the header.
- [ ] With a number: **Answer calls** on, choose **Outside office hours**: "Take details: name, reason and callback number" or "Take a short message and say we'll call back" → Save. (Calls tested in section 10.)

Notes:

---

## 7. Integrations (Workspace → Integrations)

Only connected or half-set-up tools have a card. **Connect a tool** opens the picker with Lead capture, Booking, Communication, CRM and PSA sections. HaloPSA, Zoho CRM and HubSpot read "Coming soon".

### 7.1 Lead capture → Website form
- [ ] Card reads "Ready". **Manage** shows two snippets, **Embed on your site** and **Your own form**, each with Copy → "Copied."
- [ ] Open `app.getalevo.com/form/<workspace id>` logged out: a two-part card. Left, a brand-colour panel with "Contact <company>", the phone / email / address / hours from Business profile (phone dials, email opens mail, address opens Maps). Right, the form.
- [ ] Submit empty → errors under name, email, message and the consent box; focus jumps to the first error. Fill it in → spinner + "Sending…" → thank-you.
- [ ] Clear the four contact details in Business profile, reload the form → the panel keeps only the heading and blurb.
- [ ] `/form/<id>?accent=e11d48` recolours the panel and button; `?details=0` hides the contact list.
- [ ] Paste the **Embed** snippet into a blank HTML file and open it: the form renders, submits, validates inline, shows thanks. The lead appears in Conversations with channel **Web form**.
- [ ] Spam guard: submit within two seconds of the page loading → it says thanks but **no** conversation is created.
- [ ] Send 11 submissions from the same machine within ten minutes → the 11th shows "Too many submissions…" by the Send button, keeping your values.

### 7.2 Lead capture → Chat widget
- [ ] **Manage**: the on/off switch sits on the dialog's title line; **Agent name**, Greeting, Bubble position (Bottom right / left), one Save + Cancel that appear only after a change, and the **Add to your site** snippet (already carrying position and colours) with Copy and a "What the settings in the code do" list.
- [ ] Save with the switch on → card reads "On". Paste the snippet into a test page: a round bubble in your brand colour, bottom-right (or left as chosen).
- [ ] Open the chat: header shows the Agent name (or the company name), "Usually replies in under a minute", the greeting bubble, composer focused. Esc closes.
- [ ] Send "Hi, we're a 40-person law firm looking for IT support" → typing dots → the agent answers within about 15 seconds and asks for your name and email early.
- [ ] Reload the page → the thread is still there. Open the page in a second tab → same thread.
- [ ] In the app, Conversations shows the lead with channel **Chat**; once you gave a name and email the client row shows them.
- [ ] Switch the widget off and Save → the bubble disappears from the test page.
- [ ] Give your email, close the tab, wait a few minutes, then post as the contact from the thread page (section 8.4 tester): the reply arrives by **email** because you had left the chat.
- [ ] Ask for a person ("please have someone call me") → the widget shows "We've passed this on to the team." Send another question after that → the agent still answers, and the team gets no second alert.

### 7.3 Booking tools
Google Calendar (or Microsoft 365):
- [ ] Connect a tool → Google Calendar → **Connect** → Google consent screen → back on Integrations with a green toast ("Agent" in it is a link) and the card reads **Connected**. Agent → Booking is now on with Google chosen.
- [ ] Cancel on Google's consent screen instead → a red toast "Couldn't connect your calendar" that stays until you close it; reload → it does not come back.
- [ ] Manage → **Test connection** → green notice "Reached Google Calendar for <account>: N open 30-minute slots in the next 72 hours." A rep sees Connected but no Test connection.
- [ ] Manage → **Disconnect** (confirm) → card gone from the page, back in the picker; Agent → Booking is off with "Nothing is connected yet."
- [ ] With Google connected, open Microsoft 365 in the picker → its dialog says Google is connected and to disconnect it first.

Cal.com:
- [ ] Connect → event type ID + API key + webhook secret in one form, one Save. Only a key (or only an ID) → card "Needs setup" and a **Needs attention** row "Cal.com is half set up: missing its …". Both → "Connected".

Calendly:
- [ ] Connect → scheduling link + signing key. An invalid link → red error under it. A valid link → "Connected".

### 7.4 Communication
- [ ] **Slack**: Connect → paste a webhook → Save → card reads **Untested** (amber) and Needs attention says to send a test. Manage → **Send test** → your channel receives "Test notification from Alevo — <workspace>" → card **Connected**.
- [ ] A bad webhook URL (`https://example.com`) → inline "Must be a Slack webhook URL (hooks.slack.com)." A dead Slack webhook → Send test shows Slack's error inline; card reads **Needs attention** (red) with the reason at the top of the page.
- [ ] **Clear** the webhook (confirm) → Not connected; no issue row.
- [ ] **Twilio**: with the SMS number set under Agent, the card reads Connected; without it, "No number" in amber under Needs attention. Manage → "Open Agent".
- [ ] **Resend** has no Manage button (platform-level).

### 7.5 Brand colour
- [ ] Compact card under Connection health / Needs attention with two swatches and a Preview button. **Manage** → Colour row + Font colour row, each a swatch + hex field; click a swatch → a picker opens under it (Esc closes only the picker).
- [ ] Type `red` → "Enter a hex colour like #ff6a00." under the row. Type `ea580c` and leave the field → `#ea580c`. White on `#ffd600` → a "Hard to read" note (warning only).
- [ ] Save `#ff6a00` + `#ffffff` → "Brand colours saved."; the hosted form panel, the embed and the chat bubble all go orange with white text. **Use default** blanks a row.

### 7.6 Connection health and Needs attention
- [ ] Fresh workspace: "No webhooks in the last 24 hours…". After some real traffic (a form submission, a Calendly booking, an SMS): hourly columns, "Webhooks ok N%" and "Failed N"; hover a column for the tooltip.
- [ ] Needs attention: "Nothing needs attention…" when clean; otherwise one row per issue with a **Review** button that opens that tool's dialog.

Notes:

---

## 8. Conversations

### 8.1 Clients list (Conversations)
- [ ] One row per **client** (person), not per message: name + company, channel icons (hover names the channel), Latest status pill, Fit (highest score), Open count, Last activity. Header reads "N clients across your channels. Most recent first, 25 per page."
- [ ] The most recently active client is on top. More than 25 clients → "Page 1 of N" footer with Previous / Next; the URL keeps the page on refresh.
- [ ] Empty workspace → "No conversations yet…" with a link to the lead form.

### 8.2 One person, one client
- [ ] Submit the lead form with your email, then text the Twilio number from your phone and give the agent the same email → still **one** client row, now carrying both the form and the SMS, with email and phone on the client card.
- [ ] Chat as a visitor and give an email the workspace already knows → the visitor row disappears; the chat sits under the existing client and the widget keeps working.
- [ ] Type a 10-digit number on the form (`613-884-1155`) → the client card shows `+16138841155`; a UK number keeps `+44`.

### 8.3 Client page (click a row)
- [ ] Back chevron "Conversations" at the top. Contact card: email, phone, company, first seen via, client since, consent on file (an opt-out notice when they unsubscribed / texted STOP).
- [ ] Conversations table newest first: channel (link to the thread), calls show duration · outcome, last entry time + preview.

### 8.4 Thread page
- [ ] Back chevron. The client name in the header links to the client page. Status pill (Qualifying / Meeting booked / Handed to a rep / Not a fit); a live dot while the agent is working.
- [ ] Contact bubbles left, agent bubbles right in violet, rep replies right in blue. Times show in the workspace timezone.
- [ ] Right panel: fit-score ring ("Not scored yet" when empty), details, **Why the score** when reasons exist, the booked meeting with its join link, and a **Client** row reading "N other conversations" linking to the client page.
- [ ] **Reply as the contact (test)**: type a message → the agent's reply appears without a reload. Empty → red border + message under the box.
- [ ] A phone call shows a **Phone call card**: duration, outcome pill, the summary (who, need, fit, outcome, next step), a **Transcript** disclosure, and **Play recording** for owners/admins (a rep sees no Play button). A message left on the call adds a **Message taken** pill.
- [ ] Open a conversation URL with a made-up id → a 404 inside the app shell with "Back to dashboard".

Notes:

---

## 9. The agent, channel by channel

Agent on, Business profile complete, Slack connected, a calendar connected and Booking on. Use your "lead" email and your own phone.

### 9.1 Web form → email conversation
- [ ] Submit the hosted form as a lead with a real question. Within a minute the lead inbox receives a reply from the company, signed as set in "Sign off as", with the business address, an Unsubscribe link and the data-request line in the footer.
- [ ] Reply to that email as the lead. The reply threads into the **same** conversation and the agent answers again. It asks one or two qualifying questions at a time, in the chosen tone.
- [ ] Give qualifying answers (company size, need, timing). The agent scores the lead (Fit in the right panel) and, once it looks like a fit, **offers two or three concrete times** in the email without being asked, as a short list, and asks for anything it is missing.
- [ ] Reply with one of the times. The meeting is booked: a calendar invite arrives at the lead inbox, the event is on the connected calendar with the lead invited, the thread flips to **Meeting booked**, and Meetings has a new row.
- [ ] Click **Unsubscribe** in a footer → the thread shows a suppression notice; the agent sends nothing more to that address.
- [ ] As a lead, write "please delete my data" → the agent confirms once, the thread becomes **Handed to a rep**, Slack gets "Data request: …".

### 9.2 Follow-up nudges
- [ ] Start a conversation and go quiet after the agent replies. The agent sends a follow-up after a day, then two more spaced out; a lead that looked qualified gets a nudge that **is a time offer**. After the last one with no answer the status becomes **Not a fit**. (Long-running: check back over the week. **Staff** can shorten the gaps on a dev build.)
- [ ] Reply during the wait → the follow-up is cancelled and the agent answers the new message.
- [ ] Nudges only go out inside the Follow-up hours you set (section 6.2).

### 9.3 SMS
- [ ] Text the Twilio number from your phone. A conversation appears with channel **SMS**; within seconds your phone gets a short, human reply from the number (one question at a time).
- [ ] Keep replying → it stays in the same conversation. Give qualifying answers → the agent texts two or three times, each on its own line; reply with a choice → booked, thread **Meeting booked**, invite arrives.
- [ ] Text **STOP** → no more texts; the client card shows the opt-out. Text **START** → messaging resumes.

### 9.4 Chat widget
- [ ] Covered in 7.2. Also: the Dashboard's "Where leads come from" gains a **Chat** slice.

### 9.5 Hand-off and declines
- [ ] As a lead, say none of the offered times work, twice → the agent offers the rest once, then hands off ("a colleague will find a time"); status **Handed to a rep**; Slack gets the hand-off post.
- [ ] Ask for a person at any point → **Handed to a rep** and a Slack "escalated" post.
- [ ] With Booking **off**, a qualified lead is handed off with a promise of a callback within one business day.
- [ ] After a hand-off, keep writing ("what does it cost?") → the agent still answers briefly, no second hand-off alert. Then "can we get a call booked in now?" with a calendar connected → it offers real times and books; status **Meeting booked**.
- [ ] A lead that is clearly outside the Ideal customer / hits a Disqualifier → **Not a fit** with reasons in "Why the score".

Notes:

---

## 10. Phone calls

Answer calls on (section 6.6), the Twilio number saved once after the last change, calendar connected, Booking on. Call from your mobile.

- [ ] The greeting is "Thanks for calling <company>. This call may be recorded. How can I help you today?" at any hour. The agent **never** says the office is closed, even after hours.
- [ ] Give your name once. If unsure it asks you to spell it, repeats it once, moves on. Mis-hear → spell it → the corrected name sticks on the client.
- [ ] Ask something covered by the Knowledge base (section 12) → it answers from it; something not covered → it says it will have someone follow up.
- [ ] Qualify as a good lead → the agent offers two times by day and time from the real calendar. Ask for a different time ("do you have 11?") → it re-checks that day and offers what is open. Ask for a day that is over ("anything yesterday?") → "nothing open that day", no error.
- [ ] Give your email → **one** "give me a few seconds" line, then the confirmation of the time out loud. If the calendar is slow you hear "Still with you — just a few more moments" once, never the same line twice in a row.
- [ ] It asks "anything else?"; say no → it thanks you, says goodbye and **hangs up itself**.
- [ ] Within a minute of hanging up: a **new** conversation at the top of the list under your client, with the Phone call card (duration, **Booked** pill, summary, transcript, Play recording), the invite in your inbox, Slack "Meeting booked" and "Call ended (booked, N min)".
- [ ] Call again → a **second** conversation under the same client (not appended to the first).
- [ ] Ask for a person → Slack "Call escalated"; thread **Handed to a rep**.
- [ ] After hours with **Take details** chosen: it still books (calendar connected). With **Take a short message**: it takes name, reason and callback only; the card shows **Message taken**; Slack gets the message. Give a callback number the workspace already knows → the call folds into that client.
- [ ] Hang up during the greeting → a thread and a card still appear ("No outcome").
- [ ] Withhold your caller ID (`#31#` before the number) → the agent still works; the client reads "Unknown caller" until you give a name or email.
- [ ] Email you give that already belongs to another lead → booking still completes (one client, both channels).
- [ ] Answer calls **off** → Save → a call hears "we're not taking calls right now, please text this number" and ends.

Notes:

---

## 11. Alerts (Slack + email)

Slack connected; Email the team on; owners/admins have real addresses; the Rep account has one too.

- [ ] First strong-fit score on a lead → one Slack "Qualified lead: …" with score, why and the link, and one email "Alevo — Qualified lead…" to every owner and admin. The Rep gets nothing. A second high score on the same lead → no second post.
- [ ] Meeting booked → one Slack "Meeting booked: …" with the time in the workspace timezone and the join link, and one email. A booking made directly in the calendar tool with the Alevo link → one post, not two.
- [ ] Hand-off, escalation, "Call ended" → one Slack post and one email each.
- [ ] **Email the team** off → the same events still post to Slack, no email.
- [ ] Agent **off**, submit the lead form → within a few minutes Slack gets "Lead needs a person: … the agent is turned off"; thread **Handed to a rep**. The same contact writing again → no second post.
- [ ] Booking failed: break the calendar (revoke Alevo's access at myaccount.google.com → Security → Third-party access), send a new qualified lead → the agent does **not** offer times, says a colleague will reach out, status **Handed to a rep**; Slack "Booking failed for a qualified lead…" quoting the calendar's reason; the email names the two places to fix it. Reconnect the calendar afterwards (section 7.3).
- [ ] No Slack webhook saved → nothing posts, nothing breaks.

Notes:

---

## 12. Knowledge base (Workspace → Knowledge)

- [ ] Three source tabs: **Paste text / Web address / PDF**. Add a text source → row with status Queued → Indexing → Indexed.
- [ ] Add a public web address → Indexed. `http://localhost:3000` or a private IP → "That address is not allowed".
- [ ] Add a PDF → "PDF, <size>, added <date>" → Indexed. A file name with spaces uploads fine.
- [ ] Ask the agent (chat, email, or a call) something only the document knows → the answer uses it.
- [ ] **Re-index** works; **Delete** (confirm) removes the row; the agent no longer knows that content.

Notes:

---

## 13. Meetings

- [ ] Tiles: Booked, Showed, No-shows, Converted. Table: contact (+ join link), when, status, source (Google Calendar / Cal.com / Calendly / Microsoft 365), controls. Times in the workspace timezone.
- [ ] **Outcome** dropdown (own menu, arrow keys work) → Showed / No-show saves on pick; **Mark converted** turns blue. Reload keeps both.
- [ ] **Reschedule** → dialog with a date/time field → empty → error under it; a new time moves the event on the real calendar and closes the dialog. The lead's invite updates.
- [ ] **Cancel** → "Cancel the meeting with …?" → **Keep meeting** does nothing; confirming cancels the calendar event and the conversation reopens.
- [ ] Cal.com or Calendly: cancel or move the event **in that tool itself** → the Meetings row updates and a cancel reopens the conversation. (Changes made directly in Google / Microsoft calendars do not flow back yet.)
- [ ] A Calendly row shows outcome + converted only (no Reschedule / Cancel).
- [ ] Dashboard → Meetings booked card: with no outcomes "Show rate: mark outcomes"; after one Showed and one No-show → "Show rate 50%".
- [ ] More than 25 meetings → paging footer; controls still work on page 2.

Notes:

---

## 14. ConnectWise write-back (Laith)

Needs the Manage sandbox: API host, company ID, an API member with keys, and the Alevo client ID set by **Staff** on the server. Setup steps are in the message "ConnectWise setup" (Developer Network → sandbox → security role → API member → keys).

- [ ] Connect a tool → ConnectWise → save only the site → card "Needs setup", Needs attention names what is missing, the agent keeps working.
- [ ] Fill every field + both keys → Save → "Connected"; keys show as saved, never their values. **Test connection** → "Connected to <site> (Manage <version>). Member <id> found." A wrong private key → inline error, not a toast.
- [ ] Hand a lead off (section 9.5) → in Manage: the company (or the matched existing one), the contact with the email, an activity "Alevo handed off a lead: …" assigned to the API member. The thread page shows **In ConnectWise** with the three ids.
- [ ] Book a meeting for that lead → Manage gains an activity and an opportunity "Company — inbound via Alevo (Name)" with the meeting time in its notes.
- [ ] (**Staff**) Replay the same event from Inngest → same ids, no duplicates in Manage.
- [ ] A phone call that ends in a message or hand-off → an activity in Manage; a booked call → the opportunity too.
- [ ] Call in from a new number and give an email that was already written back → one client, and the next hand-off reuses the same ConnectWise contact (no duplicate).
- [ ] Clear a key → "Needs setup"; the next hand-off does nothing in Manage and raises no error. A workspace without ConnectWise behaves the same.
- [ ] Clean up the sandbox: delete the test company, contact, activities and opportunity.

Notes:

---

## 15. Dashboard

- [ ] Header: status line ("Live." green pulsing dot when the agent is on), **7 days / 30 days / 90 days** switch kept in the URL and across refresh.
- [ ] Four tiles: Leads in, Qualified (% of leads), Meetings booked (% conversion), Missed calls recovered (calls the agent answered). Each has seven mini bars (or 13 weekly on 90 days); hover a bar → "N leads · <date>" and the change from the day before. The big number equals the sum of its bars.
- [ ] **Leads per day** area chart: hover a point → crosshair + tooltip. **Speed to lead**: Median and 95th percentile, a state pill, a violet sparkline once two days have replies (quiet days hover "no replies"). Send two test leads a minute apart with the agent on and watch the numbers.
- [ ] **Meetings booked** columns exclude cancelled meetings (cancel one → the column drops).
- [ ] **Plan usage**: one bar per allowance, "used of allowance", "This billing month" regardless of the window. (Amber at 80%, red "Paused at the limit" at 100%: **Staff** can simulate, section 18.)
- [ ] **Where leads come from**: a donut with the total in the middle and a legend (Web form, Chat, Email, SMS, Phone); hover a segment → "N leads · Channel, NN% of total".
- [ ] **Live activity**: submit the lead form in another tab → the row appears within 30 seconds without a reload; switch tabs away and back → it refreshes at once.
- [ ] Brand-new workspace → the "No leads yet" card with a link to the lead form.
- [ ] **Getting started** card (new workspaces provisioned by Alevo): remaining setup items with Set up links; **Not using this** marks one done; the card disappears when everything is done. A rep never sees it.

Notes:

---

## 16. Look, feel, themes, keyboard

- [ ] Theme switcher in the sidebar: Light / Dark / System; the choice survives reload; dark is the default in a fresh browser. Every screen (including sign-in, dialogs, toasts, the admin console) follows it.
- [ ] Toasts: bottom-right, stack if several fire, vanish after about 4 seconds, × closes early. Validation errors are always inline, never a toast; there are no browser popups anywhere.
- [ ] Every Save / Send / Confirm button shows a spinner and disables while working; a second click does nothing.
- [ ] Every destructive action (remove member, revoke invite, delete document, clear key, disconnect, cancel meeting, leave/delete workspace) asks first in the app's own dialog.
- [ ] Keyboard only: Tab through the sidebar, forms and dialogs → a visible blue focus ring on every control; Esc closes menus and dialogs; arrow keys move in dropdowns.
- [ ] Page changes fade smoothly; opening a thread slides left and the back chevron slides right. With the OS "reduce motion" setting on, everything swaps instantly and charts appear without animation.
- [ ] Loading: a skeleton in the page's shape appears instantly while a page loads; the sidebar never moves.

Notes:

---

## 17. Phone width (real phone, or the browser at about 390px)

- [ ] The sidebar becomes a top bar with a burger menu; the agent status sits by the avatar (a dot when on, "Offline" when off). No horizontal scroll on any page.
- [ ] Dashboard: tiles two per row, the window switch wraps under the title, the donut centres with the legend beneath.
- [ ] Conversations list and thread, Meetings, Workspace tabs and the Integrations cards all stack cleanly; dialogs fit the screen.
- [ ] Hosted contact form: panel on top, form beneath, full-width button. Chat widget: fills the screen, the launcher hides while open, close works.
- [ ] Sign-in: the art collapses to a band on top; the form is usable.
- [ ] Status screens (404 etc.) stay centred, buttons wrap under each other.

Notes:

---

## 18. Staff only: admin console, provisioning, plan limits

Signed in at admin.getalevo.com as a platform admin.

### 18.1 Console
- [ ] A non-admin account sees "This console is for Alevo staff" with "Open the Alevo app" and "Sign out".
- [ ] Left rail: Overview · Organizations · Activity · Settings, theme control, "Open the app". Overview: five tiles (Leads in, Qualified, Meetings, Calls, Over 60s) with the 7 / 30 / 90 switch, the funnel table with a speed-to-lead pill per org, then Organizations and Recent activity.
- [ ] Organizations: newest first, 25 per page, "X of N agents on"; Previous / Next walk pages without repeats; the URL keeps the page. Activity: same, with a By column (actor email or "System"); platform actions show **Internal admin** in the Org column.
- [ ] Settings → **Internal alerts**: paste a Slack webhook → Save → "Set" with the saved time; **Send test** posts to the channel; a non-Slack URL → inline error; **Clear** asks first.

### 18.2 Provisioning a client workspace
- [ ] Organizations → **New organization**: empty name / bad email → inline errors. Name + owner email + plan → Create → the org page; the owner's inbox gets the invite.
- [ ] Org page: Setup card "N of 9 done"; Members shows you as **Alevo support** and the owner as pending; **Resend owner invite** sends again; **Leave workspace** / **Join as support** toggle your membership (Members count on the list excludes you).
- [ ] **Open in app** → the app with that workspace active. Setup rows: **Not using this** on Phone / Booking / Slack turns the row green; the count updates.
- [ ] Plan card: pick another plan → Save → the header pill updates.
- [ ] The owner accepts the invite → Setup "Owner joined"; their Dashboard shows **Getting started**; in their Members list the support member has no role select and no trash can. Alerts go to the owner, not to support.
- [ ] Finish every Setup item → console reads **Ready**; the owner's Getting started card is gone.

### 18.3 Plan limits (Supabase: set `usage_counters.used` for `inbound_conversations`)
- [ ] At 80% of the allowance: amber Plan usage bar + "Near the limit", the amber banner across the app, Slack + owner email once.
- [ ] At 100%: red bar "Paused at the limit", red banner "The agent has paused this until next month or an upgrade", a new lead stays unanswered, Slack + email once more; a call hears "we can't take calls right now".
- [ ] Set `voice_minutes` to its allowance → calls are declined. Reset the counters → everything clears.

### 18.4 Background jobs (Inngest)
- [ ] After a lead replies, a call ends, or a booking, the matching function run shows **Completed** in Inngest (qualify-conversation, process-voice-call, psa-writeback, conversation-cadence, reply-watchdog). No run is stuck Failed; replaying a run creates no duplicate messages, calls or meetings.

Notes:

---

## 19. Results log

| Date | Tester | Sections run | Pass | Fail | Build / commit |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

### Reporting a problem

Copy one block per failure into the Notes line of its section (or send it to Laith):

```
Section/test:   e.g. 10 Phone calls, "offers two times"
What I did:     the exact steps, including the words I said or typed
What I expected:
What happened:  the exact text on screen / what the agent said
Where:          page URL, workspace name, time (with timezone)
Screenshot/recording attached: yes / no
```

For agent conversations, also give the conversation link from the app. For calls, the
time of the call and the number you called from.
