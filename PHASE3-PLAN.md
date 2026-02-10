# Phase 3: Web UI Implementation Plan

**Duration:** Weeks 5-6
**Deliverables:** 9 pages + 20+ reusable components + Storybook + Tests

---

## 🎨 Design Direction: **Minimalist + Professional**

**Aesthetic:** Clean, spacious, intentional. Similar to Vercel/Stripe/Linear.

### Color System
```
Primary: #2563eb (Modern Blue) - CTAs, links, accents
Success: #16a34a (Green) - Confirmations, checks
Error: #dc2626 (Red) - Errors, warnings
Warning: #ea580c (Orange) - Cautions
Info: #0284c7 (Cyan) - Information
Neutral: Gray scale (50-900) - Backgrounds, text
```

### Typography
```
Display Font: Geist (headings) - Modern, geometric, clear
Body Font: Inter (body text) - High readability, 1.5 line-height
Scales: 12/14/16/18/24/32/48px (Fibonacci for hierarchy)
```

### Spacing & Grid
```
Base Unit: 8px (Tailwind default)
Padding: 16, 24, 32, 48px (multiples of 8)
Border Radius: 4px (sm), 8px (md), 12px (lg)
Transitions: 150ms (fast), 250ms (normal), 350ms (slow)
```

---

## 📄 Pages (9 total)

| Page | Route | Priority | Status |
|------|-------|----------|--------|
| Landing Page | `/` | P0 | Planned |
| Link Creation Form | `/create` | P0 | Planned |
| User Dashboard | `/dashboard` | P0 | Planned |
| Link Edit | `/dashboard/[slug]/edit` | P0 | Planned |
| Analytics | `/dashboard/[slug]/analytics` | P0 | Planned |
| Public History | `/history/[slug]` | P1 | Planned |
| User Profile | `/profile` | P1 | Planned |
| Statistics | `/stats` | P2 | Planned |
| Admin Dashboard | `/admin/dashboard` | P2 | Planned |

---

## 🧩 Components Library (20+)

### Atoms (12 components)
- Button (variants: primary, secondary, danger)
- Input (text, email, password, number)
- Label
- Badge (status variants)
- Card
- Icon wrapper
- Spinner
- Avatar
- Toast notification
- Modal
- Tooltip
- Alert

### Molecules (11 components)
- InputField (Label + Input + Error)
- SelectField
- TextAreaField
- CheckboxField
- FormGroup
- FilterBar (search + filters)
- SearchInput (with debounce)
- Pagination (prev/next + page numbers)
- SortHeader (sortable columns)
- CopyButton (with feedback)
- ShareButton

### Organisms (9 components)
- LinkCreationForm
- LinksDashboardTable
- AnalyticsChart (Recharts)
- HistoryTimeline
- ProfileForm
- FilteredLinksList
- QRCodeDisplay
- HeaderNav
- SidebarNav

---

## 📋 Implementation Checklist

### Week 5 (Foundation)
- [ ] Setup Tailwind + design system (CSS variables)
- [ ] Create all 12 atom components
- [ ] Setup Storybook
- [ ] Build link creation form
- [ ] Deploy `/create` page with validation
- [ ] Implement form error handling

### Week 6 (Features)
- [ ] Create all 11 molecule components
- [ ] Build dashboard table + filtering
- [ ] Deploy `/dashboard` with regex filter
- [ ] Setup Recharts for analytics
- [ ] Deploy `/dashboard/[slug]/analytics`
- [ ] Public history page with IP masking
- [ ] Setup component testing
- [ ] Write unit + integration tests
- [ ] Create Storybook stories for all components

---

## 🔍 Key Features

✅ **Link Creation** - Form with Turnstile, auto-slug, validation
✅ **Dashboard** - Table with search, regex filter, pagination, delete
✅ **Analytics** - Daily visit charts, stats, trends
✅ **History** - Public change timeline with IP masking
✅ **Profile** - User settings, GDPR data export
✅ **QR Code** - Generate + download
✅ **Copy to Clipboard** - One-click link sharing
✅ **Bulk Actions** - Select multiple links to delete/export
✅ **Export** - CSV/JSON export of links
✅ **Responsive** - Mobile (320px), Tablet (768px), Desktop (1024px+)

---

## 🧪 Testing

- **Unit Tests:** >80% coverage on all components
- **Integration Tests:** Form submission, API calls, error handling
- **E2E Tests:** Critical user journeys (create → view → edit)
- **Component Tests:** Storybook + visual regression
- **Accessibility:** WCAG 2.1 AA compliance checks

---

## 📚 Dependencies to Add

```json
{
  "recharts": "^2.10.0",
  "react-hook-form": "^7.48.0",
  "qrcode.react": "^1.0.0",
  "date-fns": "^2.30.0",
  "clsx": "^2.0.0",
  "@storybook/react": "^7.6.0",
  "@testing-library/react": "^14.1.0",
  "@playwright/test": "^1.40.0"
}
```

---

## 🚀 Next Steps

1. **Initialize Design System** - Tailwind config + CSS variables
2. **Build Atoms** - All basic components (Button, Input, etc.)
3. **Setup Storybook** - Component library + documentation
4. **Create Forms** - Link creation with full validation
5. **Build Dashboard** - Table, search, filters, pagination
6. **Analytics** - Charts, stats, trends
7. **Testing** - Unit, integration, E2E
8. **Polish** - Responsive, accessibility, performance

---

See full details in [PHASE3 detailed plan](./docs/PHASE3-DETAILED.md)

**Estimated duration:** 10 working days
**Team size:** 1 senior frontend engineer
**Dependencies:** Phase 2 API (✅ Complete)
