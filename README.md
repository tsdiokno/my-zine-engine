# Zine Engine

Zine Engine is a digital pair of scissors and a glue stick. It’s a delightfully simple, local web publishing tool for designers, zinesters, and internet scrapbookers that lets you visually collage text, images, GIFs, and shapes.

When you hit export, it spits out a completely portable, static folder of HTML files. You can drop that folder onto any server (Neocities, Netlify, GitHub Pages, a USB drive) and your zine will work instantly.

**A quick note on dependencies (Full disclosure: this was *vibe coded*):**
If you peek under the hood at the `package.json`, you might ask: *"Why does a simple static publisher need React, Vite, Tailwind, and... Google GenAI?!"* Honestly? This entire engine was completely vibe coded. We threw heavy, modern web tech at the *editor* so you don't have to think about it. **The engine is heavy so your zine can be light.** The output you publish remains 100% dependency-free, pure HTML/CSS.

## The Philosophy

Zine Engine skips modern web development trends in favor of the tactile, mindful joy of independent publishing.

* **Scrapbooking over stress:** We love the feeling of just putting things on a page. There are no complex scroll-jacking effects or smooth page transitions to configure. You drop things in, you layer them, and you publish.
* **Motion through composition:** There are no keyframes or animation timelines here. Movement is achieved the old-school way: through mindful layout and the raw, joyful inclusion of GIFs. Let your assets do the dancing!
* **The magical scaling canvas:** Standard "responsive" web design breaks your art apart to fit it into different boxes. We don't do that. You design for a fixed mobile canvas. When your zine is viewed on a giant desktop monitor, it acts like a poster—scaling up proportionally so your exact layout is preserved perfectly.
* **Visuals first:** The UI is meant to feel friendly and familiar, like basic consumer software. There are no exposed CSS input fields or developer tools, just sliders and dropdowns to give you exactly enough freedom to mess with your stuff.
* **Static pages, smart links:** There are no dynamic templates or auto-generated navbars. Just like a physical zine, every page starts as a blank sheet. **However, we don't leave you hanging!** When you want to link to another page, you don't have to guess or hardcode the URL. The app automatically scans your folders and gives you a neat, hierarchical list of all your pages to choose from. *(P.S. Internal on-page anchor linking is coming in a future update!)*

## Quick Start

You will need [Node.js](https://nodejs.org/) installed on your computer to run the editor.

1. Clone or download this repository.
2. Open your terminal and navigate to the project folder.
3. Install the dependencies (let the vibes flow):
```bash
npm install

```


4. Start the engine:
```bash
npm run dev

```


5. Open your browser to the local address provided in your terminal to start making your zine.

## The Output

Everything you build is automatically saved and compiled into the `zine-dist/` directory. When you are ready to share your work with the world, just grab that folder and upload it anywhere. Happy publishing!
