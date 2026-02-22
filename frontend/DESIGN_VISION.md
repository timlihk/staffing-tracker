# Staffing Tracker - Modern Design Vision

## Design Philosophy: "Professional Glassmorphism"

A sophisticated, modern interface that combines:
- **Glassmorphism**: Translucent layers with backdrop blur for depth
- **Neobrutalism accents**: Bold borders and shadows for emphasis
- **Vibrant gradients**: Dynamic color flows for visual interest
- **Generous whitespace**: Breathing room for content clarity

---

## Color Palette

### Primary Colors
```
Primary Indigo:    #6366F1  (Main actions, highlights)
Primary Violet:    #8B5CF6  (Gradients, accents)
Primary Cyan:      #06B6D4  (Success states, secondary actions)
```

### Semantic Colors
```
Success:  #10B981  (Green - completed, active)
Warning:  #F59E0B  (Amber - pending, attention)
Error:    #EF4444  (Red - errors, urgent)
Info:     #3B82F6  (Blue - information)
```

### Neutral Scale (Slate-based)
```
50:   #F8FAFC   (Page background)
100:  #F1F5F9   (Card backgrounds)
200:  #E2E8F0   (Borders, dividers)
300:  #CBD5E1   (Disabled states)
400:  #94A3B8   (Placeholder text)
500:  #64748B   (Secondary text)
600:  #475569   (Body text)
700:  #334155   (Headings)
800:  #1E293B   (Strong emphasis)
900:  #0F172A   (Primary text)
```

### Gradient Definitions
```css
/* Primary Gradient */
--gradient-primary: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #06B6D4 100%);

/* Success Gradient */
--gradient-success: linear-gradient(135deg, #10B981 0%, #06B6D4 100%);

/* Warm Gradient */
--gradient-warm: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);

/* Glass Background */
--glass-bg: rgba(255, 255, 255, 0.7);
--glass-border: rgba(255, 255, 255, 0.5);
```

---

## Typography

### Font Stack
```
Primary:  "Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif
Mono:     "JetBrains Mono", "Fira Code", monospace
```

### Type Scale
```
H1:  2.5rem   (40px)   - Page titles
H2:  2rem     (32px)   - Section headers
H3:  1.5rem   (24px)   - Card titles
H4:  1.25rem  (20px)   - Subsection titles
H5:  1.125rem (18px)   - Widget titles
H6:  1rem     (16px)   - Labels

Body:     0.9375rem (15px) - Main content
Small:    0.875rem  (14px) - Secondary content
Caption:  0.75rem   (12px) - Metadata
```

---

## Components

### Cards
- Background: White with 70% opacity + backdrop blur
- Border: 1px solid rgba(255, 255, 255, 0.5)
- Border Radius: 16px (larger, softer)
- Shadow: 0 4px 20px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)
- Hover Shadow: 0 8px 30px rgba(0, 0, 0, 0.08)

### Buttons
- Primary: Gradient background (Indigo → Violet)
- Secondary: White with subtle border
- Border Radius: 12px (pill-like but not fully round)
- Padding: 12px 24px
- Font Weight: 600

### Sidebar
- Background: Semi-transparent with blur
- Width: 260px (slightly narrower)
- Active Item: Gradient background with glow effect
- Collapsed Width: 72px

### Inputs
- Background: White
- Border: 1px solid #E2E8F0
- Border Radius: 12px
- Focus: Indigo ring with glow

---

## Spacing System

```
4px   - xs  (tight spacing)
8px   - sm  (compact)
12px  - md  (comfortable)
16px  - lg  (default)
24px  - xl  (generous)
32px  - 2xl (section spacing)
48px  - 3xl (large sections)
```

---

## Effects

### Glassmorphism
```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
```

### Shadows
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
--shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03);
--shadow-glow: 0 0 40px rgba(99, 102, 241, 0.15);
```

---

## Animation

### Transitions
- Default: 200ms ease
- Hover: 150ms ease-out
- Page: 300ms ease-in-out

### Keyframes
- Fade In: opacity 0 → 1, translateY 10px → 0
- Scale In: scale 0.95 → 1, opacity 0 → 1
- Slide In: translateX -20px → 0
