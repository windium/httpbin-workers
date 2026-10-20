// Static response bodies.
//
// Provenance: the ASCII art and UTF-8 demo are original to this project. /html uses the opening
// of Herman Melville's "Moby-Dick" (1851, public domain), as httpbin does. The /json and /xml
// "slideshow" fixture is the short sample from httpbin (ISC License), kept verbatim because
// clients test against its exact values.

export const ROBOTS_TXT = 'User-agent: *\nDisallow: /deny\n';

export const ANGRY_ASCII = `
          .-""""""-.
        .'  \\    /  '.
       /   (o)  (o)   \\
      |                |
      |    .------.    |
       \\  '        '  /
        '.          .'
          '-......-'

       YOU SHOULDN'T BE HERE
`;

export const MOBY_HTML = `<!DOCTYPE html>
<html>
  <head>
  </head>
  <body>
      <h1>Herman Melville - Moby-Dick</h1>

      <div>
        <p>
          Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me.
        </p>
      </div>
  </body>
</html>`;

export const UTF8_DEMO = `<h1>Unicode Demo</h1>

<pre>
UTF-8 encoded sample text, written for httpbin-workers.

Greetings around the world
──────────────────────────
  English     Hello, world!
  Turkish     Merhaba, dünya! Çağrı şöyle: “Iğdır’da ılık bir gün.”
  German      Grüß Gott! Schöne Straßen, große Bäume.
  French      Bonjour à tous ! Ça va très bien, merci.
  Spanish     ¡Hola, mundo! ¿Qué tal? Mañana será otro día.
  Polish      Cześć! Zażółć gęślą jaźń.
  Greek       Γειά σου, κόσμε! Καλημέρα.
  Russian     Привет, мир! Добро пожаловать.
  Ukrainian   Привіт, світе! Ґанок і їжак.
  Hebrew      שלום עולם
  Arabic      مرحبا بالعالم
  Hindi       नमस्ते दुनिया
  Thai        สวัสดีชาวโลก
  Japanese    こんにちは、世界！カタカナとひらがな。
  Korean      안녕하세요, 세계!
  Chinese     你好，世界！简体字 與 繁體字

Mathematics
───────────
  ∀ε>0 ∃δ>0: |x − a| < δ ⇒ |f(x) − f(a)| < ε
  ∑ₖ₌₀ⁿ k = n(n+1)/2      ∫₀^π sin x dx = 2      e^{iπ} + 1 = 0
  ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ ⊂ ℂ      A ∩ B ⊆ A ∪ B      ¬(p ∧ q) ⇔ ¬p ∨ ¬q
  ½ ⅓ ¼ ⅕ ⅙ ⅛   x² y³ zⁿ   H₂O CO₂   ± × ÷ ≈ ≠ ≤ ≥ ∞ √ ∂ ∇

Currency and punctuation
────────────────────────
  € £ ¥ ₺ ₹ ₩ ₽ $ ¢    “double” ‘single’ «guillemets» — en–dash … ellipsis

Arrows and shapes
─────────────────
  ← ↑ → ↓ ↔ ↕ ⇐ ⇒ ⇔   ■ □ ▲ △ ● ○ ◆ ◇ ★ ☆ ♠ ♣ ♥ ♦ ✓ ✗

Box drawing
───────────
  ┌─────────┬─────────┐   ╔═════════╗
  │ request │ response│   ║ httpbin ║
  ├─────────┼─────────┤   ╚═════════╝
  │   GET   │   200   │   ░░▒▒▓▓██
  └─────────┴─────────┘   ▁▂▃▄▅▆▇█

Emoji
─────
  🌍 🚀 ☕ 🧪 📦 🔒 ✅ ❌ 🐷 🐺
</pre>
`;

export const SAMPLE_JSON = {
  slideshow: {
    author: 'Yours Truly',
    date: 'date of publication',
    slides: [
      { title: 'Wake up to WonderWidgets!', type: 'all' },
      {
        items: ['Why <em>WonderWidgets</em> are great', 'Who <em>buys</em> WonderWidgets'],
        title: 'Overview',
        type: 'all',
      },
    ],
    title: 'Sample Slide Show',
  },
};

export const SAMPLE_XML = `<?xml version='1.0' encoding='us-ascii'?>

<!--  A SAMPLE set of slides  -->

<slideshow\u0020
    title="Sample Slide Show"
    date="Date of publication"
    author="Yours Truly"
    >

    <!-- TITLE SLIDE -->
    <slide type="all">
      <title>Wake up to WonderWidgets!</title>
    </slide>

    <!-- OVERVIEW -->
    <slide type="all">
        <title>Overview</title>
        <item>Why <em>WonderWidgets</em> are great</item>
        <item/>
        <item>Who <em>buys</em> WonderWidgets</item>
    </slide>

</slideshow>`;
