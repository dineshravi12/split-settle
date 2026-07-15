# Split-Settle — Phase 1 Mobile-First Redesign Plan

## App Overview (Current State)

- **What it is**: A Splitwise-style group expense tracker
- **Frontend**: Angular 19 + PrimeNG 19 (standalone components), hosted on **Netlify**
- **Backend**: Spring Boot + JWT + MySQL, hosted on **Railway**
- **Auth**: JWT stored in `localStorage`, BCrypt password hashing
- **Current gaps**: Desktop-first, no animations, no dark mode, no bottom nav, no skeleton loaders, equal splits only

### Current Routes

| Route         | Component            |
| ------------- | -------------------- |
| `/login`      | LoginComponent       |
| `/register`   | RegisterComponent    |
| `/dashboard`  | DashboardComponent   |
| `/groups`     | GroupListComponent   |
| `/groups/:id` | GroupDetailComponent |

### Installed Packages

- `@angular/animations` — installed, **not yet wired up**
- `primeng` 19 + `primeicons` 7 — in use
- No `@angular/cdk` yet
- No Lottie package yet

---

## Differentiation Ideas (vs Splitwise / Tricount)

| Gap in Existing Apps              | Your Opportunity                                                   |
| --------------------------------- | ------------------------------------------------------------------ |
| No UPI/QR inline for Indian users | **Inline UPI QR code** generation for exact settlement amounts     |
| Sharing requires screenshots      | **"Share on WhatsApp"** deeplink with formatted text               |
| No budget mode for trips          | **Group budget tracker** — set ₹10k for a trip, progress bar fills |
| No voice entry                    | **Voice-to-expense** via Web Speech API                            |
| No receipt scanning               | **Camera OCR auto-fill** for expense amount + description          |
| No live collaboration             | **Real-time updates** via WebSocket                                |

---

## Phases Overview

| Phase       | Focus                                                                 | Backend changes? |
| ----------- | --------------------------------------------------------------------- | ---------------- |
| **Phase 1** | Mobile-first redesign, glassmorphism, animations, dark mode, PWA      | ❌ None          |
| **Phase 2** | Swipe gestures, split types (unequal %), activity feed, edit expenses | ✅ Minor         |
| **Phase 3** | UPI QR, WhatsApp share, real-time WebSocket, receipt OCR              | ✅ Major         |
| **Phase 4** | AI auto-categorize, voice entry, full analytics charts                | ✅ Major         |

---

## Phase 1 — Detailed Implementation Plan

### Design Decisions

- **Style**: Glassmorphism — `backdrop-filter: blur(14px)`, semi-transparent cards, subtle borders
- **Color palette**: `#7c3aed` violet primary, `#06b6d4` cyan accent, red/green for owe/owed
- **Font**: Inter (already in use)
- **Dark mode**: CSS custom properties + `[data-theme="dark"]` on `<html>`
- **Animations**: `@angular/animations` for route transitions + state changes; CSS `@keyframes` for micro-interactions
- **No GSAP** — keeps bundle lean; `@angular/animations` is sufficient
- **PrimeNG kept** but used minimally; core UI is custom CSS

---

### Step 1 — Install Missing Packages

```bash
cd split-settle
npm install @angular/cdk
npm install lottie-web
npm install ng-lottie
```

---

### Step 2 — Design System (styles.scss)

**File**: `split-settle/src/styles.scss`

Replace the entire file with:

- CSS custom properties in `:root` for all colors, spacing, shadows, border-radius
- Dark mode tokens in `[data-theme="dark"]` — flip all variables
- `.glass-card` base class: `backdrop-filter: blur(14px)`, `background: rgba(255,255,255,0.65)`, `border: 1px solid rgba(255,255,255,0.3)`
- Dark glass: `background: rgba(255,255,255,0.05)`
- Animated mesh background via CSS `@keyframes` slow gradient shift on `body::before`
- Shimmer keyframe for skeleton loaders
- Floating label animation class for input fields

**Key CSS tokens to define:**

```scss
:root {
  --primary: #7c3aed;
  --primary-light: #ede9fe;
  --accent: #06b6d4;
  --danger: #ef4444;
  --success: #22c55e;
  --bg: #f5f3ff;
  --surface: rgba(255, 255, 255, 0.65);
  --surface-border: rgba(255, 255, 255, 0.3);
  --text-primary: #1e1b4b;
  --text-muted: #6b7280;
  --shadow-sm: 0 2px 8px rgba(124, 58, 237, 0.08);
  --shadow-md: 0 8px 32px rgba(124, 58, 237, 0.15);
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --blur: blur(14px);
}

[data-theme="dark"] {
  --bg: #0f0a1e;
  --surface: rgba(255, 255, 255, 0.05);
  --surface-border: rgba(255, 255, 255, 0.1);
  --text-primary: #f5f3ff;
  --text-muted: #a78bfa;
}
```

---

### Step 3 — App Shell & Route Animations

#### `app.config.ts`

Add `provideAnimations()` from `@angular/platform-browser/animations`.

#### `app.routes.ts`

Add `data: { animation: 'PageName' }` to each route:

```typescript
{ path: 'dashboard', component: DashboardComponent, data: { animation: 'DashboardPage' } },
{ path: 'groups', component: GroupListComponent, data: { animation: 'GroupsPage' } },
{ path: 'groups/:id', component: GroupDetailComponent, data: { animation: 'GroupDetailPage' } },
```

#### `app.component.ts`

- Add `[@routeAnimations]="getRouteAnimation(outlet)"` on `<router-outlet>` wrapper `<div>`
- Define `routeAnimations` trigger: slide-in from right on forward navigation, slide-in from left on back
- Import `RouterOutlet`, `ChildrenOutletContexts`, animation imports

**Animation trigger:**

```typescript
export const slideInAnimation = trigger("routeAnimations", [
  transition("* <=> *", [
    style({ position: "relative" }),
    query(
      ":enter, :leave",
      [style({ position: "absolute", top: 0, left: 0, width: "100%" })],
      { optional: true },
    ),
    query(":enter", [style({ left: "100%", opacity: 0 })], { optional: true }),
    query(":leave", animateChild(), { optional: true }),
    group([
      query(
        ":leave",
        [animate("250ms ease-out", style({ left: "-30%", opacity: 0 }))],
        { optional: true },
      ),
      query(
        ":enter",
        [animate("250ms ease-out", style({ left: "0%", opacity: 1 }))],
        { optional: true },
      ),
    ]),
  ]),
]);
```

#### App layout shell

Wrap `<router-outlet>` in a layout that includes:

- `<app-header>` (hidden on mobile when on auth pages)
- `<app-bottom-nav>` (mobile only, hidden on `/login` and `/register`)
- Main content area with bottom padding on mobile to avoid bottom nav overlap

---

### Step 4 — New Shared Components

#### 4a. `BottomNavComponent`

**Path**: `split-settle/src/app/shared/components/bottom-nav/bottom-nav.component.ts`

- Fixed bottom bar, only visible on `< 768px` via CSS `@media`
- 3 tabs: **Dashboard** (home icon) / **Groups** (people icon) / **Profile** (user icon)
- Active tab has a glass pill indicator that slides between tabs using CSS transform
- Uses `RouterLinkActive` to detect active route
- Hidden entirely on `/login` and `/register` routes

```html
<nav class="bottom-nav">
  <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
    <i class="pi pi-home"></i>
    <span>Home</span>
  </a>
  <a routerLink="/groups" routerLinkActive="active" class="nav-item">
    <i class="pi pi-users"></i>
    <span>Groups</span>
  </a>
  <a routerLink="/profile" routerLinkActive="active" class="nav-item">
    <i class="pi pi-user"></i>
    <span>Profile</span>
  </a>
</nav>
```

#### 4b. `SkeletonLoaderComponent`

**Path**: `split-settle/src/app/shared/components/skeleton-loader/skeleton-loader.component.ts`

- Inputs: `@Input() type: 'card' | 'list' | 'stat' = 'card'`, `@Input() rows = 3`
- Renders placeholder rectangles with shimmer animation
- Replace all `<p-progressSpinner>` instances app-wide

#### 4c. `FabComponent`

**Path**: `split-settle/src/app/shared/components/fab/fab.component.ts`

- Fixed bottom-right button (positioned above bottom nav on mobile)
- `@Output() fabClick = new EventEmitter()`
- Pulsing ring animation via CSS `@keyframes` (hints interaction on first visit)
- Hidden on desktop — use inline "New Group" / "Add Expense" buttons there
- Uses `localStorage` flag `fab_hinted` to stop pulse after first interaction

#### 4d. `ThemeService`

**Path**: `split-settle/src/app/core/services/theme.service.ts`

```typescript
@Injectable({ providedIn: "root" })
export class ThemeService {
  private isDarkSubject = new BehaviorSubject<boolean>(false);
  isDark$ = this.isDarkSubject.asObservable();

  constructor() {
    const saved = localStorage.getItem("theme") === "dark";
    this.setDark(saved);
  }

  toggle() {
    this.setDark(!this.isDarkSubject.value);
  }

  private setDark(dark: boolean) {
    this.isDarkSubject.next(dark);
    document.documentElement.setAttribute(
      "data-theme",
      dark ? "dark" : "light",
    );
    localStorage.setItem("theme", dark ? "dark" : "light");
  }
}
```

---

### Step 5 — Header Component Redesign

**File**: `split-settle/src/app/shared/components/header/header.component.ts`

- **Desktop**: Logo left + nav links center + avatar + dark mode toggle right
- **Mobile**: Logo left + avatar + dark mode toggle right (bottom nav handles navigation)
- Dark mode toggle: sun/moon icon, injects `ThemeService`
- Avatar shows first letter of user name, gradient background
- Logout in dropdown on avatar click

---

### Step 6 — Auth Pages Redesign

#### Login + Register

**Files**: `split-settle/src/app/features/auth/login/` and `register/`

**Desktop layout:**

- Two-panel split: left = animated gradient panel with app name + tagline; right = glass card form
- Left panel: decorative floating coin/group icons animated with CSS `@keyframes`

**Mobile layout:**

- Full screen gradient background
- Glass card form centered with `position: relative; z-index: 1`

**Input fields:**

- Floating label animation: label moves up + shrinks on focus/input using CSS transform
- Password show/hide toggle already exists — restyle only

**Loading state:**

- Submit button width shrinks to a circle (CSS transition on `width`) showing spinner inside
- Implemented via `[class.loading]="isLoading"` + CSS

**Error state:**

- Form card shakes on invalid login using `@angular/animations`:

```typescript
trigger("shake", [
  transition("* => shaking", [
    animate(
      "0.5s",
      keyframes([
        style({ transform: "translateX(0)" }),
        style({ transform: "translateX(-10px)" }),
        style({ transform: "translateX(10px)" }),
        style({ transform: "translateX(-10px)" }),
        style({ transform: "translateX(0)" }),
      ]),
    ),
  ]),
]);
```

---

### Step 7 — Dashboard Redesign

**Files**: `split-settle/src/app/features/dashboard/`

**Layout:**

- Decorative radial gradient blobs in background (CSS `position: absolute`, `z-index: 0`, `pointer-events: none`)
- Content above blobs with `position: relative; z-index: 1`

**Stats cards** (glassmorphism):

- "You Owe" — red-tinted glass (`--danger` tint)
- "Owed to You" — green-tinted glass
- "Total Groups" — violet-tinted glass
- Numbers **count up from 0** to real value on load using `setInterval` counter tween (800ms)

```typescript
animateCounter(target: number, property: string) {
  const duration = 800;
  const steps = 40;
  const increment = target / steps;
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + increment, target);
    this[property] = current;
    if (current >= target) clearInterval(timer);
  }, duration / steps);
}
```

**Loading state:** Replace `<p-progressSpinner>` with `<app-skeleton-loader type="stat" [rows]="3">`

**Recent Groups grid:** Glass cards with hover lift (`transform: translateY(-4px)`, box-shadow on hover)

**Empty state:** Lottie animation (people + coins, free from lottiefiles.com) instead of plain icon

**FAB:** `<app-fab>` at bottom-right, navigates to `/groups` (triggers create dialog)

---

### Step 8 — Group List Redesign

**Files**: `split-settle/src/app/features/groups/group-list/`

**Group cards** (glassmorphism):

- Gradient avatar (first letter), group name, member count badge
- **Stagger enter animation** — each card delays by `i * 60ms`:

```typescript
trigger("listStagger", [
  transition("* => *", [
    query(
      ":enter",
      [
        style({ opacity: 0, transform: "translateY(20px)" }),
        stagger(60, [
          animate(
            "300ms ease-out",
            style({ opacity: 1, transform: "translateY(0)" }),
          ),
        ]),
      ],
      { optional: true },
    ),
  ]),
]);
```

**Create group dialog:**

- Desktop: centered glass modal overlay
- Mobile: **bottom sheet** that slides up from bottom (`transform: translateY(0)` animation)
- Animated floating label input
- Inline validation

---

### Step 9 — Group Detail Redesign

**Files**: `split-settle/src/app/features/groups/group-detail/`

**Custom pill tabs:**

- Replace PrimeNG `<p-tabView>` with custom tabs
- CSS sliding underline indicator that animates between Expenses / Settlements tabs
- `left` property transitions with `transition: left 250ms ease`

**Member chips:**

- Glassmorphism style chips with gradient avatar initials

**Expense list:**

- Each expense = glass card
- **Mobile swipe-to-reveal delete**: using `@angular/cdk/drag-drop` horizontal drag
  - Drag threshold: 60px reveals red delete button behind card
  - Release below threshold snaps back; above threshold triggers delete with confirmation

**Add expense form:**

- Mobile: **bottom sheet** slides up from bottom (same pattern as create group)
- Desktop: side panel or modal

**Settlement cards:**

- Color-coded glass: red for "you owe", green for "owed to you"
- "Settle Up" button: morphs to green checkmark on confirm (`@angular/animations` state change)

**Celebration animation:**

- When last settlement in group is cleared → trigger CSS confetti `@keyframes` (colored squares fall down from top)
- Or use a free Lottie confetti animation

---

### Step 10 — Onboarding Flow (First Login)

**Path**: `split-settle/src/app/features/onboarding/`

- Shown once after first **registration** (flag: `localStorage.getItem('onboarded')`)
- Full-screen overlay above all content
- 3 steps with Lottie animations:
  - Step 1: "Create a group for your trip or household"
  - Step 2: "Add friends by email"
  - Step 3: "Log expenses — we handle the math"
- Progress dots at bottom, "Skip" + "Next" buttons
- On complete: set `localStorage.setItem('onboarded', 'true')`, navigate to `/dashboard`

---

### Step 11 — PWA Setup

```bash
cd split-settle
ng add @angular/pwa
```

- Configure `ngsw-config.json` to cache:
  - App shell (index.html, main.js, styles)
  - API responses for last-visited group (runtime cache, stale-while-revalidate)
- Update `manifest.webmanifest` with:
  - App name: "Split & Settle"
  - Theme color: `#7c3aed`
  - Display: `standalone`
  - Icons: 192x192 and 512x512 (generate from app logo)
- Users on Android can "Add to Home Screen" — app launches full-screen like native

---

## Files Changed in Phase 1

| File                                                 | Change                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `split-settle/src/styles.scss`                       | Full redesign — tokens, glassmorphism, dark mode, mesh bg, shimmer |
| `split-settle/src/app/app.component.ts`              | Route animation host, layout shell, bottom nav inclusion           |
| `split-settle/src/app/app.config.ts`                 | Add `provideAnimations()`                                          |
| `split-settle/src/app/app.routes.ts`                 | Add `data: { animation }` to each route                            |
| `split-settle/src/app/shared/components/header/`     | Mobile/desktop responsive, dark mode toggle                        |
| `split-settle/src/app/features/auth/login/`          | Two-panel layout, floating labels, button morph, shake animation   |
| `split-settle/src/app/features/auth/register/`       | Same treatment as login                                            |
| `split-settle/src/app/features/dashboard/`           | Glass cards, counter animation, Lottie empty state, FAB            |
| `split-settle/src/app/features/groups/group-list/`   | Stagger animation, glass cards, mobile bottom sheet                |
| `split-settle/src/app/features/groups/group-detail/` | Custom tabs, swipe-to-delete, confetti, bottom sheet form          |
| **NEW** `shared/components/bottom-nav/`              | Mobile bottom navigation                                           |
| **NEW** `shared/components/skeleton-loader/`         | Shimmer skeleton loaders                                           |
| **NEW** `shared/components/fab/`                     | Floating action button                                             |
| **NEW** `core/services/theme.service.ts`             | Dark mode toggle + localStorage persistence                        |
| **NEW** `features/onboarding/`                       | First-login 3-step illustrated guide                               |
| `ngsw-config.json` (generated)                       | PWA caching strategy                                               |
| `manifest.webmanifest` (generated)                   | App name, theme color, icons                                       |

---

## Verification Checklist (after Phase 1)

- [ ] Open in Chrome DevTools → iPhone 12 Pro emulation → bottom nav shows, FAB is reachable
- [ ] Open in Chrome DevTools → Samsung Galaxy S20 emulation → no horizontal scroll
- [ ] Toggle dark mode → all cards, backgrounds, text flip correctly
- [ ] Navigate Dashboard → Groups → Group Detail → verify slide animation fires
- [ ] Simulate 3G (DevTools throttling) → skeleton loaders appear, no blank screens
- [ ] Register a new account → onboarding flow shows, completes, navigates to dashboard
- [ ] `ng build --configuration production` → zero errors
- [ ] Open on actual Android phone → "Add to Home Screen" prompt appears

---

## Phase 2 Preview (after Phase 1 is complete)

- Swipe gestures on all list items (Angular CDK)
- **Split types**: equal / by percentage / custom amounts — new UI + backend endpoint update
- **Edit expenses** — edit icon on each expense card
- **Activity feed** — scrollable log of "who did what" in a group
- **Bulk settle all** button

## Phase 3 Preview

- **UPI QR code** — generate a scannable PhonePe/GPay QR inline for settlement amount
- **WhatsApp share** — one tap sends formatted settlement summary via `wa.me` deeplink
- **Real-time updates** — WebSocket so group members see new expenses appear live
- **Receipt OCR** — camera photo → auto-fills expense amount + description

## Phase 4 Preview

- **AI auto-categorize** — type "pizza dominos" → auto-tags as Food
- **Voice-to-expense** — Web Speech API: "Paid 500 for dinner"
- **Group budget mode** — set a trip budget, animated progress bar fills as expenses added
- **Analytics charts** — spending by category (doughnut), spending over time (line chart)

---

## Notes

- Backend is **untouched** in Phase 1 — purely frontend
- PrimeNG is kept but used minimally; custom CSS drives the glassmorphism UI
- Lottie files: source free ones from [lottiefiles.com](https://lottiefiles.com) (empty states only — 2-3 files max)
- India + portfolio focus: keep ₹ symbol for now, add currency toggle in Phase 2
- No GSAP needed — `@angular/animations` + CSS keyframes keeps bundle lean
