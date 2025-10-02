# Lovable UI Guidelines - Staffing Tracker

**Last Updated**: October 2, 2025
**Version**: 1.0

This document defines the design system, tokens, and component patterns for the K&E Staffing Tracker application. All UI changes should follow these guidelines to maintain consistency.

---

## Design Tokens

### Colors

**Brand**:
- `brand.primary`: `#3B82F6` (Blue)
- `brand.secondary`: `#10B981` (Green)

**Surfaces**:
- `surface.default`:
  - Light: `#F7F8FB`
  - Dark: `#0B1220`
- `surface.paper`:
  - Light: `#FFFFFF`
  - Dark: `#111827`

**Text**:
- `text.primary`:
  - Light: `#0F172A`
  - Dark: `#E5E7EB`
- `text.secondary`:
  - Light: `#475569`
  - Dark: `#CBD5E1`

**Dividers**:
- Light: `#E5E7EB`
- Dark: `#9CA3AF` @ 30% alpha

### Spacing

- Base unit: `4px`
- Primary scale: `8px`, `12px`, `16px`, `20px`, `24px`
- Page padding: `16px` (mobile), `24px` (tablet), `32px` (desktop)
- Section gaps: `16px`

### Radii

- Cards/Papers: `12px`
- Buttons: `10px`
- Chips: `8px`
- Input fields: `10px`

### Shadows

- Use minimal shadows; prefer `1px` borders to separate surfaces
- Buttons (primary): `0 6px 20px rgba(59,130,246,0.28)`
- Modals/Dialogs: `0 20px 60px rgba(0,0,0,0.15)`

### Focus Ring

- Size: `3px`
- Color: `brand.primary` @ 35% alpha
- Applied to all interactive elements on `:focus-visible`

### Density

- Tables: Compact density with `44px` row height
- Forms: Standard density with comfortable spacing
- Lists: Comfortable density with hover states

---

## Typography

### Font Family

```
"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

Fallback order ensures consistent rendering across platforms.

### Headings

- **H1/H2**: Weight `700`, tight letter-spacing (`-0.5px`)
- **H3/H4**: Weight `600`, normal letter-spacing
- **H5/H6**: Weight `600`, slightly increased letter-spacing

### Body Text

- Primary: Weight `400`
- Emphasis: Weight `600`
- Line height: `1.6` for readability

### Buttons

- Weight: `600`
- Transform: **None** (no uppercase)
- Letter spacing: `0.1px`

---

## Components

### Buttons

**Variants**:
- `contained`: Primary actions (brand.primary background)
- `outlined`: Secondary actions (brand.primary border)
- `text`: Tertiary actions (minimal styling)

**Styling**:
- Border radius: `10px`
- Padding: `8px 16px`
- Primary contained shadow: `0 6px 20px rgba(59,130,246,0.28)`
- No uppercase text transformation

**Usage**:
```tsx
<Button variant="contained">Primary Action</Button>
<Button variant="outlined">Secondary Action</Button>
<Button variant="text">Tertiary Action</Button>
```

### Chips

**Purpose**: Status indicators, active filters, tags

**Styling**:
- Border radius: `8px`
- Font weight: `600`
- Use `outlined` unless strong signal needed

**Usage**:
```tsx
<Chip label="Active" color="success" />
<Chip label="Filter: HK" size="small" />
```

### Cards/Papers

**Styling**:
- Border: `1px solid divider`
- Border radius: `12px`
- Elevation: `0` (no box shadow)
- Background: `surface.paper`

**Usage**:
```tsx
<Paper sx={{ p: 2 }}>
  <Typography variant="h6">Card Title</Typography>
  <Typography>Content...</Typography>
</Paper>
```

### Data Tables (DataGrid)

**Requirements**:
- Sticky header
- Zebra row striping (even rows highlighted)
- Hover highlight on rows
- Compact density (`44px` row height)
- No outer border
- Consistent column header styling

**Styling**:
- Header background: Light `#F8FAFC` / Dark `#0F172A`
- Header font weight: `700`
- Even row background: Light `#FBFDFF` / Dark `rgba(148,163,184,0.04)`

### Page Layout

**Structure**:
- Mini sidebar: `72px` width (collapsed) or `280px` (expanded)
- Top app bar: `64px` height
- Main content: Max width `1280px`, centered
- Content padding: Responsive (16/24/32px)

**Grid**:
```tsx
<Box sx={{ display: 'grid', gap: 2 }}>
  {/* Page header */}
  {/* Content sections */}
</Box>
```

---

## Accessibility

### Keyboard Navigation

- All interactive elements must be keyboard-focusable
- Visible focus ring on `:focus-visible` (3px, brand.primary @ 35%)
- Logical tab order
- Escape key closes modals/dialogs

### Color Contrast

- Minimum AA contrast (4.5:1 for body text, 3:1 for large text)
- Never use color alone to convey status
- Always pair with icons, text labels, or tooltips

### Screen Readers

- Semantic HTML elements
- ARIA labels on interactive elements
- Alt text on images
- Proper heading hierarchy

### Interactive Elements

- Minimum touch target: `44x44px`
- Adequate spacing between clickable elements
- Clear hover/active states

---

## File Organization

### Shared UI Components

Location: `frontend/src/components/ui/*`

**Examples**:
- `Page.tsx` - Page wrapper with header
- `Section.tsx` - Content section wrapper
- `EmptyState.tsx` - Empty state displays
- `StyledDataGrid.tsx` - Consistent DataGrid styling

### Theme

Location: `frontend/src/theme.ts`

Single source of truth for all design tokens.

### Print Styles

Location: `frontend/src/styles/print.css`

Print-specific styling for reports and documents.

---

## Component Patterns

### Page Structure

```tsx
import { Page, Section } from '@/components/ui';

export default function MyPage() {
  return (
    <Page
      title="Page Title"
      actions={
        <Button variant="contained" startIcon={<Add />}>
          New Item
        </Button>
      }
    >
      <Section>
        {/* Content */}
      </Section>
    </Page>
  );
}
```

### Empty States

```tsx
import EmptyState from '@/components/ui/EmptyState';

<EmptyState
  title="No projects found"
  subtitle="Create your first project to get started"
  actionLabel="Create Project"
  onAction={() => navigate('/projects/new')}
/>
```

### Data Tables

```tsx
import StyledDataGrid from '@/components/ui/StyledDataGrid';

<StyledDataGrid
  rows={data}
  columns={columns}
  loading={loading}
  pageSizeOptions={[25, 50, 100]}
/>
```

### Filter Panels

```tsx
<Paper sx={{ p: 2.5, position: 'sticky', top: 88 }}>
  <Stack spacing={2}>
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Filters
    </Typography>
    <Autocomplete multiple options={options} />
    <DatePicker label="From" />
    <DatePicker label="To" />
    <Button variant="contained">Apply</Button>
  </Stack>
</Paper>
```

---

## Print Styles

### Requirements

- Hide navigation, sidebars, and UI chrome (`.no-print`)
- Show print-only headers and footers (`.print-only`)
- Clean white background
- Proper page margins (`12mm`)
- Landscape orientation for wide tables

### Classes

- `.no-print` - Hidden when printing
- `.print-only` - Visible only when printing

### Implementation

```css
@media print {
  .MuiAppBar-root, .MuiDrawer-root, .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  body {
    background: white !important;
  }
  @page {
    margin: 12mm;
    size: landscape;
  }
}
```

---

## Icons

### Library

Material Icons (Rounded variant for softer appearance)

### Usage

```tsx
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
```

### Sizing

- Small: `20px`
- Medium (default): `24px`
- Large: `32px`

---

## Lovable-Specific Instructions

### When Editing Styles

1. **Update theme.ts first** for global changes (colors, radii, shadows)
2. **Use UI wrappers** (`Page`, `Section`) instead of inline styles
3. **Maintain consistency** - if changing one button, update the Button component override
4. **Preserve accessibility** - never remove focus rings or ARIA labels

### When Creating New Components

1. **Check UI library first** - use existing wrappers when possible
2. **Extract reusable patterns** - if used >2 times, create a wrapper
3. **Follow naming conventions** - PascalCase for components, kebab-case for files
4. **Add TypeScript types** - all props must be typed

### When Refactoring Pages

1. **Wrap with `<Page>`** - standardize header and actions
2. **Use `<Section>`** for content blocks
3. **Replace empty views** with `<EmptyState>`
4. **Apply `StyledDataGrid`** to all tables
5. **Remove inline colors** - use theme tokens

### Visual Edit Guidelines

For micro adjustments, use Lovable Visual Edit:
- Spacing tweaks (padding, margin)
- Border adjustments
- Shadow refinements
- Color variations within token system

Never use Visual Edit for:
- Structural changes (add/remove components)
- New feature additions
- Logic modifications

---

## Code Formatting

### Prettier Config

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### EditorConfig

```
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = space
indent_size = 2
```

---

## Naming Conventions

### Files

- Components: `PascalCase.tsx` (e.g., `ProjectForm.tsx`)
- Pages: `PascalCase.tsx` (e.g., `Dashboard.tsx`)
- Utilities: `camelCase.ts` (e.g., `dateUtils.ts`)
- Styles: `kebab-case.css` (e.g., `print.css`)

### Components

- React components: `PascalCase`
- Props interfaces: `ComponentNameProps`
- Event handlers: `handleEventName`

### Variables

- Constants: `UPPER_SNAKE_CASE`
- Variables: `camelCase`
- Booleans: Prefix with `is`, `has`, `should`

---

## Testing Guidelines

### Before Committing

- [ ] All pages render without errors
- [ ] Focus rings visible on all interactive elements
- [ ] Keyboard navigation works
- [ ] Print preview shows clean layout
- [ ] Dark mode renders correctly
- [ ] Mobile responsive (320px min width)
- [ ] No console errors or warnings

### Accessibility Checklist

- [ ] Semantic HTML
- [ ] ARIA labels where needed
- [ ] Alt text on images
- [ ] Proper heading hierarchy
- [ ] Color contrast meets AA
- [ ] Keyboard navigation works
- [ ] Screen reader tested

---

## Resources

- [Material-UI Documentation](https://mui.com)
- [Lovable Documentation](https://docs.lovable.dev)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

---

## Version History

- **1.0** (2025-10-02): Initial Lovable guidelines
  - Defined design tokens
  - Established component patterns
  - Added accessibility requirements
  - Created code formatting standards

---

**Questions or suggestions?** Update this file via pull request.
