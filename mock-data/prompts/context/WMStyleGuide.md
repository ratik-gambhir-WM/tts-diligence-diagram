# West Monroe Slide & Diagram Style Guide (LLM-Ready)

## 🎨 Color Palette (Theme Colors)

### Core Colors

* **Primary Dark (Grounded Blue)**: `#070154`
* **Primary Accent Blue**: `#0047FF`
* **Highlight Yellow**: `#F6EB20`
* **Highlight Magenta**: `#F900D3`

### Neutral Grays

* **Dark Gray**: `#50658E`
* **Medium Gray**: `#CED7E6`
* **Light Gray**: `#E8EEF8`
* **White**: `#FFFFFF`

### Supporting Colors

* **Cyan Accent**: `#00E8FA`
* **Light Blue Accent**: `#00A3FF`

### Links

* **Hyperlink Blue**: `#0563C1`
* **Visited Link**: `#954F72`

---

## 🔤 Typography

### Primary Font System

* **Font Family (All)**: Arial
* **Usage Model**:

  * **Major Font (Headings)**: Arial
  * **Minor Font (Body)**: Arial

### Implications for Design

* No font mixing — maintain **strict consistency**
* Use **weight, size, and color** for hierarchy instead of font changes

---

## 🔠 Font Size & Hierarchy (Inferred Best Practice)

*(Explicit sizes not strongly encoded in theme XML; derived from standard PowerPoint structure)*

### Recommended Hierarchy

* **Title**: 28–36 pt
* **Section Headers**: 20–28 pt
* **Body Text**: 14–18 pt
* **Annotations / Labels**: 10–14 pt

---

## 📐 Layout & Spacing (Inferred from Theme Structure)

### General Rules

* Favor **clean horizontal flow (left → right)**
* Maintain **consistent alignment grids**
* Use **ample whitespace** (light gray backgrounds reinforce this)

### Spacing Guidelines

* Between major sections: ~24–40 px
* Between nodes/shapes: ~16–24 px
* Internal padding (shapes): ~8–16 px

---

## 🔷 Shape & Diagram Styling

### Node Styling

* Default fill: **White (`#FFFFFF`) or Light Gray (`#E8EEF8`)**
* Borders:

  * Optional, subtle
  * Use **Dark Gray (`#50658E`)** if needed

### Emphasis / Highlight Nodes

* Use sparingly:

  * Yellow (`#F6EB20`)
  * Magenta (`#F900D3`)
  * Blue (`#0047FF`)

### Connectors / Arrows

* Color: **Dark Gray (`#50658E`) or Primary Blue (`#0047FF`)**
* Style:

  * Clean, straight lines preferred
  * Avoid heavy styling or decoration

---

## 🧭 Diagram Semantics (For LLM / Agent Use)

### Color Meaning Conventions

* **Dark Blue (`#070154`)** → Core systems / foundational components
* **Bright Blue (`#0047FF`)** → Active processes / APIs
* **Yellow (`#F6EB20`)** → Highlights / attention / key steps
* **Magenta (`#F900D3`)** → Critical or differentiating elements
* **Grays** → Supporting / background / infrastructure

---

## ⚙️ LLM-Friendly Diagram Rules

When generating diagrams (e.g., Mermaid):

### Node Formatting

* Prefer:

  ```
  id["Label"]
  ```
* Keep labels concise and functional

### Flow Direction

* Default: **Top-down (TD)** or **Left-right (LR)**

### Styling Mapping

* Map semantic roles to colors:

  * Core → Dark Blue
  * Process → Blue
  * Highlight → Yellow/Magenta
  * Neutral → Gray

---

## 🚫 Anti-Patterns to Avoid

* Mixing fonts
* Overuse of bright colors
* Dense layouts with minimal spacing
* Excessive connector complexity (crossing lines, curves)

---

## ✅ Summary for Agent Use

* **Font**: Arial (only)
* **Primary Color**: `#070154`
* **Accent Colors**: Blue, Yellow, Magenta
* **Neutrals**: Structured gray scale
* **Style Philosophy**: Clean, minimal, structured, high-contrast hierarchy

---

## 🧠 Recommended Output Format for Agents

When generating diagrams:

1. Use **structured graph (JSON or Mermaid)**
2. Apply **semantic color mapping**
3. Maintain **consistent spacing and hierarchy**
4. Avoid visual clutter

---
