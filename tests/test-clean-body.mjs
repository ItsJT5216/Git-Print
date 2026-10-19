/**
 * test-clean-body.mjs
 *
 * Unit tests for cleanCommentBody — the content-policy contract:
 *
 *   KEEP  — every word a reader sees: prose byte-faithful (never escaped,
 *           never reflowed), link TEXT, bare URLs the author typed, file
 *           paths, identifiers, fenced code/diff material untouched.
 *   DROP  — web furniture: link TARGETS (unwrap), angle autolinks from the
 *           page→markdown translation, images entirely, HTML comments,
 *           bot promo/footer lines, promo-only comments (→ "").
 *
 * Run:  node test-clean-body.mjs   (after `pnpm build`)
 */

import { cleanCommentBody } from "../dist/pr-renderer.js";

let pass = 0;
const failures = [];

function eq(name, input, expected, renderedText, renderedHtml) {
  const got = cleanCommentBody(input, undefined, renderedText, renderedHtml);
  if (got === expected) { pass++; return; }
  failures.push({ name, input, expected, got });
}

function checks(name, input, preds) {
  const got = cleanCommentBody(input);
  for (const [label, fn] of Object.entries(preds)) {
    if (fn(got)) { pass++; }
    else failures.push({ name: `${name} :: ${label}`, input, expected: "(predicate)", got });
  }
}

// ─── Link unwrapping: text is content, target is furniture ───────────────────

eq("inline link unwraps to text",
  "Check [this guide](https://example.com/setup) for setup",
  "Check this guide for setup");

eq("link text with code span unwraps",
  "See [`config_loader.ts`](https://github.com/x/y/blob/main/config_loader.ts) for details",
  "See `config_loader.ts` for details");

eq("angle autolink removed",
  "Translated page debris <https://whatever.side/random?link=1> here",
  "Translated page debris here");

eq("mailto autolink removed",
  "Contact <mailto:bot@example.com> for help",
  "Contact for help");

eq("empty link removed",
  "Badge husk [](https://shield.example.com) gone",
  "Badge husk gone");

eq("reference link unwraps when defined",
  "See [docs][1] and [api][2] here\n\n[1]: https://docs.example.com\n[2]: https://api.example.com",
  "See docs and api here");

eq("undefined bracket pair kept literally",
  "Indexing arr[1][2] and map[key][field] stays",
  "Indexing arr[1][2] and map[key][field] stays");

eq("reference-looking prose kept (target not URL-shaped)",
  "[ERROR]: timeout after 30s",
  "[ERROR]: timeout after 30s");

// ─── Bare URLs: author content stays ─────────────────────────────────────────

eq("bare URL typed by author stays",
  "The spec lives at https://spec.example.com/v2 today",
  "The spec lives at https://spec.example.com/v2 today");

// ─── Images: removed completely ──────────────────────────────────────────────

eq("inline image removed entirely (alt text too)",
  "Before ![coverage badge](https://img.shields.io/x.svg) after",
  "Before after");

eq("image-only comment becomes empty",
  "![mascot](https://bot.example.com/mascot.png)",
  "");

eq("html img removed",
  "Before <img src=\"https://x.com/badge.png\" alt=\"b\"> after",
  "Before after");

// ─── Code protection: fences and inline code are sacred ─────────────────────

eq("diff fence contents byte-faithful",
  "```diff\n-[a](b) <https://keep.example.com> ![img](x.png)\n+code line\n```",
  "```diff\n-[a](b) <https://keep.example.com> ![img](x.png)\n+code line\n```");

eq("inline code span with link syntax kept",
  "Use `[x](y)` in your markdown",
  "Use `[x](y)` in your markdown");

eq("inline code span with angle URL kept",
  "The literal `<https://example.com>` form",
  "The literal `<https://example.com>` form");

const multilineHtmlCode = "Context: li.innerHTML = `\n    <span class=\"dot\"></span>\n    <div class=\"thread-meta\"></div>\n    <button type=\"button\">×</button>`";
eq("multiline inline code span with HTML kept byte-faithful",
  multilineHtmlCode,
  multilineHtmlCode);

eq("suggestion fence untouched",
  "Try this:\n\n```suggestion\nconst x = arr[0];\n```",
  "Try this:\n\n```suggestion\nconst x = arr[0];\n```");

checks("fence with trailing whitespace and blank runs preserved",
  "prose\n\n```\nline  \n\n\n\nend\n```",
  {
    "fence bytes exact": (g) => g.includes("```\nline  \n\n\n\nend\n```"),
  });

// ─── No escaping, no reflow: prose is byte-faithful ──────────────────────────

eq("identifiers never escaped",
  "Use snake_case_var and call foo_bar() on array[0].",
  "Use snake_case_var and call foo_bar() on array[0].");

eq("multi-line prose not reflowed",
  "First line of the paragraph\nsecond line stays on its own line\nthird line too",
  "First line of the paragraph\nsecond line stays on its own line\nthird line too");

// ─── Bot noise lines ─────────────────────────────────────────────────────────

eq("copilot footer dropped",
  "Real finding prose here.\n\nCopilot uses AI. Check for mistakes.",
  "Real finding prose here.");

eq("share-spam line dropped BY its link (ordering contract)",
  "Real review prose here.\n[Share on Twitter](https://twitter.com/intent/tweet?x=1)\nMore prose with a [doc](https://docs.example.com/guide).",
  "Real review prose here.\nMore prose with a doc.");

eq("thanks-for-using dropped",
  "Finding text.\n\nThanks for using CodeRabbit! It's free for OSS.",
  "Finding text.");

eq("alert marker line dropped, note prose kept",
  "> [!NOTE]\n> The actual note content stays.",
  "> The actual note content stays.");

eq("view reviewed changes caption dropped",
  "Actionable comments were posted.\nView reviewed changes >",
  "Actionable comments were posted.");

// ─── Promo-only comments collapse to empty (caller skips the card) ──────────

eq("promo-only comment → empty",
  "Thanks for using CodeRabbit! It's free for OSS.\n[Share on Twitter](https://twitter.com/intent/tweet)",
  "");

eq("html-comment-only body → empty",
  "<!-- coderabbitai walkthrough marker -->",
  "");

// ─── HTML cleanup (bot summaries) ────────────────────────────────────────────

eq("html comment removed, code example showing one kept",
  "<!-- meta -->Prose and `<!-- in code -->` stays",
  "Prose and `<!-- in code -->` stays");

eq("details boilerplate removed",
  "Keep this.\n<details><summary>Tips</summary>Promo body</details>",
  "Keep this.");

eq("anchor tag unwrapped to text",
  "See <a href=\"https://x.com/profile\">the docs</a> here",
  "See the docs here");

eq("strong tag with attributes converts symmetrically",
  "- [ ] <!-- meta --> <strong title=\"Keep fixing\">Autopilot</strong> · Keep fixing",
  "- [ ]  **Autopilot** · Keep fixing");

eq("rendered-text check removes only confirmed invisible tag tokens",
  "A  <relative-time datetime=\"x\">2026</relative-time>  B",
  "A  2026  B",
  "A  2026  B");

// Authored raw HTML with attributes is accepted by GitHub's GFM renderer.
eq("em tag with attributes becomes balanced emphasis",
  'Please <em class="x">really</em> check this', 'Please *really* check this');
eq("empty icon tag with attributes leaves no marker",
  'Status: <i class="fa fa-check"></i> done', 'Status:  done');
eq("unclosed bold tag leaves no dangling marker",
  '<b>Heads up: the cache is stale', 'Heads up: the cache is stale');
eq("edge whitespace stays outside emphasis",
  '<strong> Note: </strong> retry later', '**Note:**  retry later');
eq("attribute-bearing list items remain separate",
  '<ul><li class="a">one</li><li class="b">two</li></ul>', '- one\n- two');
eq("attribute-bearing heading keeps its break",
  '<h3 id="s">Summary</h3>Body text here', '**Summary**\nBody text here');
eq("attribute-bearing code keeps code formatting",
  '<code class="language-sh">npm test</code> first', '`npm test` first');
eq("invisible tag-only body becomes empty before card numbering",
  '<center>\n<img src="https://img.shields.io/badge/x.svg">\n</center>', '', '');
eq("invisible wrapper is removed before whitespace tidy",
  '<x-wrap>\nHello there\n</x-wrap>', 'Hello there', 'Hello there');

// body_html values below reflect the GitHub GFM rendering API. It is already
// returned by the full+json REST calls used by git-print; no live test network
// access is required. Only spans GitHub rendered as inline <code> are shielded.
eq("rendered multiline code keeps literal backslash-n",
  'Change to `console.log("a\\n" +\n  "b")` please',
  'Change to `console.log("a\\n" +\n  "b")` please',
  'Change to console.log("a\\n" + "b") please',
  '<p>Change to <code class="notranslate">console.log(&quot;a\\n&quot; + &quot;b&quot;)</code> please</p>');
eq("rendered multiline code keeps link-shaped source",
  'Call `handlers[type](event)\n  .catch(log)` instead',
  'Call `handlers[type](event)\n  .catch(log)` instead',
  'Call handlers[type](event) .catch(log) instead',
  '<p>Call <code class="notranslate">handlers[type](event) .catch(log)</code> instead</p>');
eq("rendered multiline code keeps literal HTML-comment syntax",
  'Template: `\n    <!-- keep me -->\n    <div>x</div>`',
  'Template: `\n    <!-- keep me -->\n    <div>x</div>`',
  'Template: <!-- keep me --> <div>x</div>',
  '<p>Template: <code class="notranslate"> &lt;!-- keep me --&gt; &lt;div&gt;x&lt;/div&gt;</code></p>');
eq("custom div-like tag is not an interrupting HTML block",
  'Use `start\n  <div-foo>x</div-foo>\n  end`',
  'Use `start\n  <div-foo>x</div-foo>\n  end`',
  'Use start <div-foo>x</div-foo> end',
  '<p>Use <code class="notranslate">start &lt;div-foo&gt;x&lt;/div-foo&gt; end</code></p>');
eq("tag at the start of a rendered code span stays code",
  'Use `<div class="x">\n  y</div>` here',
  'Use `<div class="x">\n  y</div>` here',
  'Use <div class="x"> y</div> here',
  '<p>Use <code class="notranslate">&lt;div class="x"&gt; y&lt;/div&gt;</code> here</p>');
eq("quote markers are removed for code-span confirmation",
  '> Use `<span>a\n> b</span>` here',
  '> Use `<span>a\n> b</span>` here',
  'Use <span>a b</span> here',
  '<blockquote>\n<p>Use <code class="notranslate">&lt;span&gt;a b&lt;/span&gt;</code> here</p>\n</blockquote>');
eq("only the first backtick of an escaped run is escaped",
  'Use \\``<b>a\nb</b>` here',
  'Use \\``<b>a\nb</b>` here',
  'Use `<b>a b</b> here',
  '<p>Use `<code class="notranslate">&lt;b&gt;a b&lt;/b&gt;</code> here</p>');
eq("tab indentation cannot start an HTML block",
  'Use `start\n\t<div>x</div>\nend` here',
  'Use `start\n\t<div>x</div>\nend` here',
  'Use start <div>x</div> end here',
  '<p>Use <code class="notranslate">start &lt;div&gt;x&lt;/div&gt; end</code> here</p>');
eq("output is not an interrupting GFM HTML block",
  'Use `start\n  <output>x</output>\nend` here',
  'Use `start\n  <output>x</output>\nend` here',
  'Use start <output>x</output> end here',
  '<p>Use <code class="notranslate">start &lt;output&gt;x&lt;/output&gt; end</code> here</p>');
eq("source does interrupt the paragraph in GitHub GFM",
  'Use `start\n  <source>x</source>\nend` here',
  'Use `start\n  x\nend` here',
  'Use `start x end` here',
  '<p>Use `start</p>\n  <source>x\nend` here');
eq("comparison before a code span is not an HTML attribute",
  'When x < y, use `handlers[type](event)\n  .catch(log)`',
  'When x < y, use `handlers[type](event)\n  .catch(log)`',
  'When x < y, use handlers[type](event) .catch(log)',
  '<p>When x &lt; y, use <code class="notranslate">handlers[type](event) .catch(log)</code></p>');
eq("rendered double-backtick multiline span keeps link-shaped code",
  'Use ``a ` [x](url)\n  b`` here',
  'Use ``a ` [x](url)\n  b`` here',
  'Use a ` [x](url) b here',
  '<p>Use <code class="notranslate">a ` [x](url) b</code> here</p>');
eq("rendered multiline code is safe from bot-noise line filter",
  'Code: `\nCopilot uses AI. Check for mistakes.\nkeep` please',
  'Code: `\nCopilot uses AI. Check for mistakes.\nkeep` please',
  'Code: Copilot uses AI. Check for mistakes. keep please',
  '<p>Code: <code class="notranslate"> Copilot uses AI. Check for mistakes. keep</code> please</p>');
eq("HTML comment block is not mistaken for inline code",
  'Use `before\n  <!-- keep me -->\n  after` here',
  'Use `before\n\n  after` here',
  'Use `before after` here',
  '<p>Use `before</p>\n<p>after` here</p>');
eq("HTML block interrupting a pseudo code span loses invisible tags",
  'Use `start\n  <div>x</div>\n  end`',
  'Use `start\n  x\n  end`',
  'Use `start x end`',
  '<p>Use `start</p>\n  <div>x</div>\n  end`');
eq("hidden HTML block cannot consume a later real code match",
  'Fake: `\n  <!-- keep me -->\n  <div>x</div>`\n\nReal: `\n    <!-- keep me -->\n    <div>x</div>`',
  'Fake: `\n\n  x`\n\nReal: `\n    <!-- keep me -->\n    <div>x</div>`',
  'Fake: ` x Real: <!-- keep me --> <div>x</div>',
  '<p>Fake: `</p>\n  \n  <div>x</div>`\n<p>Real: <code class="notranslate"> &lt;!-- keep me --&gt; &lt;div&gt;x&lt;/div&gt;</code></p>');
eq("Qodo pre hard wraps still reflow despite backticks",
  '<pre>reads `SELECT version ... LIMIT\n1`, next</pre>',
  'reads `SELECT version ... LIMIT 1`, next',
  'reads `SELECT version ... LIMIT\n1`, next',
  '<pre class="notranslate">reads `SELECT version ... LIMIT\n1`, next</pre>');

// ─── Review-audit regression cases (findings 2.1–2.6) ───────────────────────

eq("fenced code example SHOWING a details tag is kept (finding 2.1)",
  "Add a details tag:\n```html\n<details><summary>foo</summary>bar</details>\n```\nUse that pattern.",
  "Add a details tag:\n```html\n<details><summary>foo</summary>bar</details>\n```\nUse that pattern.");

eq("bot details footer CONTAINING a fence is removed whole (finding 2.1 dual)",
  "Real finding.\n<details><summary>Walkthrough</summary>\n\n```log\nnoise line\n```\n\npromo</details>",
  "Real finding.");

eq("fenced code example SHOWING an html comment is kept (finding 2.1 dual)",
  "Example:\n```html\n<!-- keep me -->\n```\nDone.",
  "Example:\n```html\n<!-- keep me -->\n```\nDone.");

eq("mailto reference link unwraps when defined (finding 2.2)",
  "Mail [team][1]\n\n[1]: mailto:team@example.com",
  "Mail team");

eq("two-level paren URL unwraps (finding 2.3)",
  "See [text](https://wiki.org/foo_(bar_(baz))_qux) here",
  "See text here");

eq("anchor wrapping only an image leaves no double space (finding 2.5)",
  "Click <a href=\"x\"><img src=\"y\"/></a> here",
  "Click here");

// ─── Idempotency: clean(clean(x)) === clean(x) ───────────────────────────────

const idempotencyInputs = [
  "Check [this guide](https://example.com) for setup",
  "```diff\n-[a](b)\n+[c](d)\n```",
  "Use `[x](y)` and snake_case in array[0].",
  "See [docs][1]\n\n[1]: https://docs.example.com",
  "> [!NOTE]\n> Note prose.\n\n![img](https://x.png) and <https://y.com>",
  "Plain prose with https://bare.example.com typed by the author.",
  "Add a details tag:\n```html\n<details><summary>foo</summary>bar</details>\n```\nUse that pattern.",
  "Mail [team][1]\n\n[1]: mailto:team@example.com",
  "See [text](https://wiki.org/foo_(bar_(baz))_qux) here",
];
for (const input of idempotencyInputs) {
  const once = cleanCommentBody(input);
  const twice = cleanCommentBody(once);
  if (once === twice) { pass++; }
  else failures.push({ name: "idempotency", input, expected: once, got: twice });
}

// ─── Adversarial: never throws, always returns a string ──────────────────────

const adversarial = [
  "",
  null,
  undefined,
  "```\nunclosed fence with [link](https://x.com)",
  "<a href=",
  "![only](https://x.png)",
  "> > [nested](https://x.com) quote",
  "[",
  "]() [](",
  "`unclosed code span with [link](url)",
];
for (const bad of adversarial) {
  try {
    const got = cleanCommentBody(bad);
    if (typeof got === "string") { pass++; }
    else failures.push({ name: "adversarial returns string", input: String(bad), expected: "string", got: typeof got });
  } catch (e) {
    failures.push({ name: "adversarial must not throw", input: String(bad), expected: "no throw", got: e.message });
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

if (failures.length === 0) {
  console.log(`PASS — ${pass} assertions passed.`);
  process.exit(0);
} else {
  console.error(`FAIL — ${failures.length} of ${pass + failures.length} assertions failed:\n`);
  for (const f of failures) {
    console.error(`✗ ${f.name}`);
    console.error(`   input:    ${JSON.stringify(f.input)}`);
    console.error(`   expected: ${JSON.stringify(f.expected)}`);
    console.error(`   got:      ${JSON.stringify(f.got)}`);
  }
  process.exit(1);
}
