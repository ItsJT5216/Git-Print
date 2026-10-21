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
eq("prose newline cleanup leaves literal backslash-n in authored code",
  'Remove unused <code>const lineStart = s.lastIndexOf("\\n", start - 1) + 1;</code>.',
  'Remove unused `const lineStart = s.lastIndexOf("\\n", start - 1) + 1;`.',
  'Remove unused const lineStart = s.lastIndexOf("\\n", start - 1) + 1;.',
  '<p>Remove unused <code class="notranslate">const lineStart = s.lastIndexOf("\\n", start - 1) + 1;</code>.</p>');
eq("unmatched backtick in a prior paragraph does not hide HTML code",
  "An unmatched ` tick.\n\nUse <code class=\"x\">npm test</code>.",
  "An unmatched ` tick.\n\nUse `npm test`.",
  "An unmatched ` tick.\n\nUse npm test.",
  '<p>An unmatched ` tick.</p>\n<p>Use <code class="notranslate">npm test</code>.</p>');
eq("unmatched backtick does not cross an ATX heading before HTML code",
  'An unmatched ` tick.\n# Heading\nUse <code class="x">npm test</code>.',
  'An unmatched ` tick.\n# Heading\nUse `npm test`.',
  'An unmatched ` tick.\nHeading\nUse npm test.',
  '<p>An unmatched ` tick.</p>\n<h1>Heading</h1>\n<p>Use <code class="notranslate">npm test</code>.</p>');
eq("backslash before a code-span closer remains literal",
  "<code>&lt;code&gt;`C:\\`&lt;/code&gt;</code>",
  "`<code>C:\\</code>`",
  "<code>C:\\</code>",
  '<p><code class="notranslate">&lt;code&gt;<code class="notranslate">C:\\</code>&lt;/code&gt;</code></p>');
eq("authored code flattens nested HTML and decodes visible entities",
  '<code class="x">foo <em>bar</em> &lt; b &amp;&amp; c</code>',
  '`foo bar < b && c`',
  'foo bar < b && c',
  '<p><code class="notranslate">foo <em>bar</em> &lt; b &amp;&amp; c</code></p>');
eq("authored code decodes GitHub's named HTML5 entities",
  '<code class="x">&copy; &mdash; &hellip; &eacute; &trade; &nbsp; &Tab; &#x1F680;</code>',
  '`© — … é ™   \t 🚀`',
  '© — … é ™   \t 🚀',
  '<p><code class="notranslate">© — … é ™   \t 🚀</code></p>');
eq("authored code applies Markdown escapes before decoding entities",
  '<code class="x">\\*bold\\* \\&amp;</code>',
  '`*bold* &amp;`',
  '*bold* &amp;',
  '<p><code class="notranslate">*bold* &amp;amp;</code></p>');
eq("authored code keeps explicit HTML line breaks",
  '<code class="x">foo<br>bar</code>',
  '<code>foo<br>bar</code>',
  'foo\nbar',
  '<p><code class="notranslate">foo<br>bar</code></p>');
eq("authored code keeps line breaks rendered from source newlines",
  '<code class="x">foo\nbar</code>',
  '<code>foo<br>bar</code>',
  'foo\nbar',
  '<p><code class="notranslate">foo<br>\nbar</code></p>');
eq("authored code matches GitHub replacement for invalid numeric references",
  '<code class="x">x &#0; &#xD800; &#x110000; &#128; &#129; y</code>',
  '`x � � � � � y`',
  'x � � � � � y',
  '<p><code class="notranslate">x � � � � � y</code></p>');
eq("nested Markdown code keeps its literal HTML spelling",
  '<code class="x">foo `<em>bar</em>`</code>',
  '`foo <em>bar</em>`',
  'foo <em>bar</em>',
  '<p><code class="notranslate">foo <code class="notranslate">&lt;em&gt;bar&lt;/em&gt;</code></code></p>');
eq("nested Markdown code keeps entity spellings",
  '<code class="x">foo `&lt;em&gt;bar&lt;/em&gt;`</code>',
  '`foo &lt;em&gt;bar&lt;/em&gt;`',
  'foo &lt;em&gt;bar&lt;/em&gt;',
  '<p><code class="notranslate">foo <code class="notranslate">&amp;lt;em&amp;gt;bar&amp;lt;/em&amp;gt;</code></code></p>');
eq("attribute-bearing code flattens unescaped Markdown ticks like GitHub does",
  '<code class="language-js">const s = `hi`;</code>', '`const s = hi;`',
  'const s = hi;',
  '<p><code class="notranslate">const s = <code class="notranslate">hi</code>;</code></p>');
eq("attribute-bearing code retains escaped visible backticks with a safe delimiter",
  '<code class="language-js">const s = \\`hi\\`;</code>', '``const s = `hi`;``',
  'const s = `hi`;',
  '<p><code class="notranslate">const s = `hi`;</code></p>');
eq("attribute-bearing code pads a visible leading backtick safely",
  '<code class="x">\\`leading</code>', '`` `leading ``', '`leading',
  '<p><code class="notranslate">`leading</code></p>');
eq("attribute-bearing code pads a visible trailing backtick safely",
  '<code class="x">trailing\\`</code>', '`` trailing` ``', 'trailing`',
  '<p><code class="notranslate">trailing`</code></p>');
eq("HTML code syntax shown inside a Markdown span stays literal",
  'Example: `<code class="x">`', 'Example: `<code class="x">`',
  'Example: <code class="x">',
  '<p>Example: <code class="notranslate">&lt;code class="x"&gt;</code></p>');
eq("invisible tag-only body becomes empty before card numbering",
  '<center>\n<img src="https://img.shields.io/badge/x.svg">\n</center>', '', '');
eq("invisible wrapper is removed before whitespace tidy",
  '<x-wrap>\nHello there\n</x-wrap>', 'Hello there', 'Hello there');
eq("GitHub-visible script-looking text stays inert in Markdown",
  'Raw <script>value</script> text',
  'Raw &lt;script&gt;value&lt;/script&gt; text',
  'Raw <script>value</script> text',
  '<p dir="auto">Raw &lt;script&gt;value&lt;/script&gt; text</p>');

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
const repeatedAngles = "<".repeat(256);
eq("angle-heavy rendered code remains matched without interpreting tags",
  `Use \`start\n  ${repeatedAngles}[x](url)\nend\``,
  `Use \`start\n  ${repeatedAngles}[x](url)\nend\``,
  `Use start ${repeatedAngles}[x](url) end`,
  `<p>Use <code class="notranslate">start ${"&lt;".repeat(256)}[x](url) end</code></p>`);
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
eq("no-space comparison before code is not an HTML tag opener",
  'When x<y, use `handlers[type](event)\n  .catch(log)`',
  'When x<y, use `handlers[type](event)\n  .catch(log)`',
  'When x<y, use handlers[type](event) .catch(log)',
  '<p>When x&lt;y, use <code class="notranslate">handlers[type](event) .catch(log)</code></p>');
eq("an earlier closed code span cannot fake an unfinished HTML tag",
  'Example: `a <b` then `start\n  <span>[x](url)</span>\nend`',
  'Example: `a <b` then `start\n  <span>[x](url)</span>\nend`',
  'Example: a <b then start <span>[x](url)</span> end',
  '<p>Example: <code class="notranslate">a &lt;b</code> then <code class="notranslate">start &lt;span&gt;[x](url)&lt;/span&gt; end</code></p>');
eq("a literal pre example cannot exclude later confirmed code",
  'Earlier `<pre>` then `x\n  <span>[y](url)</span>\nend` and later </pre>',
  'Earlier `<pre>` then `x\n  <span>[y](url)</span>\nend` and later',
  'Earlier <pre> then x <span>[y](url)</span> end and later',
  '<p dir="auto">Earlier <code class="notranslate">&lt;pre&gt;</code> then <code class="notranslate">x &lt;span&gt;[y](url)&lt;/span&gt; end</code> and later </p>');
eq("lazy blockquote continuation keeps its enclosing quote depth",
  '> Intro\nUse `a\n> [x](url)`',
  '> Intro\nUse `a\n> [x](url)`',
  'Intro Use a [x](url)',
  '<blockquote><p dir="auto">Intro<br>\nUse <code class="notranslate">a [x](url)</code></p></blockquote>');
eq("nested lazy blockquote continuation keeps both quote markers",
  '> > Intro\nUse `a\n> > [x](url)`',
  '> > Intro\nUse `a\n> > [x](url)`',
  'Intro Use a [x](url)',
  '<blockquote>\n<blockquote>\n<p dir="auto">Intro<br>\nUse <code class="notranslate">a [x](url)</code></p>\n</blockquote>\n</blockquote>');
eq("block interruption cannot consume a later heading-shaped code match",
  'Fake: `start\n# [x](url)\nend`\n\nReal: `start\n    # [x](url)\nend`',
  'Fake: `start\n# x\nend`\n\nReal: `start\n    # [x](url)\nend`',
  'Fake: start x end Real: start # [x](url) end',
  '<p dir="auto">Fake: `start</p>\n<h1 dir="auto"><a href="url">x</a></h1>\n<p dir="auto">end`</p>\n<p dir="auto">Real: <code class="notranslate">start # [x](url) end</code></p>');
eq("thematic-break prefixes do not interrupt rendered multiline code",
  'Use `start\n---flag [x](url)\nend` here',
  'Use `start\n---flag [x](url)\nend` here',
  'Use start ---flag [x](url) end here',
  '<p>Use <code class="notranslate">start ---flag [x](url) end</code> here</p>');
eq("setext heading boundary cannot consume a later real code match",
  'Fake: `start\n===\n[x](url)\nend`\n\nReal: `start\n    ===\n    [x](url)\n    end`',
  'Fake: `start\n===\nx\nend`\n\nReal: `start\n    ===\n    [x](url)\n    end`',
  'Fake: `start\n===\nx\nend` Real: start === [x](url) end',
  '<h1>Fake: `start</h1>\n<p><a href="url">x</a><br>\nend`</p>\n<p>Real: <code class="notranslate">start === [x](url) end</code></p>');
eq("block interruption cannot consume a later thematic-break code match",
  'Fake: `start\n---\n[x](url)\nend`\n\nReal: `start\n    ---\n    [x](url)\n    end`',
  'Fake: `start\n---\nx\nend`\n\nReal: `start\n    ---\n    [x](url)\n    end`',
  'Fake: start x end Real: start --- [x](url) end',
  '<h2 dir="auto">Fake: `start</h2>\n<p dir="auto"><a href="url">x</a><br>\nend`</p>\n<p dir="auto">Real: <code class="notranslate">start --- [x](url) end</code></p>');
eq("block interruption cannot consume a later list-shaped code match",
  'Fake: `start\n- [x](url)\nend`\n\nReal: `start\n    - [x](url)\n    end`',
  'Fake: `start\n- x\nend`\n\nReal: `start\n    - [x](url)\n    end`',
  'Fake: start x end Real: start - [x](url) end',
  '<p dir="auto">Fake: `start</p>\n<ul dir="auto">\n<li><a href="url">x</a><br>\nend`</li>\n</ul>\n<p dir="auto">Real: <code class="notranslate">start - [x](url) end</code></p>');
eq("block interruption cannot consume a later blockquote-shaped code match",
  'Fake: `start\n> [x](url)\nend`\n\nReal: `start\n    > [x](url)\n    end`',
  'Fake: `start\n> x\nend`\n\nReal: `start\n    > [x](url)\n    end`',
  'Fake: start x end Real: start > [x](url) end',
  '<p dir="auto">Fake: `start</p>\n<blockquote>\n<p dir="auto"><a href="url">x</a><br>\nend`</p>\n</blockquote>\n<p dir="auto">Real: <code class="notranslate">start &gt; [x](url) end</code></p>');
eq("block interruption cannot consume code from a later fenced block match",
  'Fake: `start\n```text\n[x](url)\n```\nend`\n\nReal: `start\n    ```text\n    [x](url)\n    ```\n    end`',
  'Fake: `start\n```text\n[x](url)\n```\nend`\n\nReal: `start\n    ```text\n    [x](url)\n    ```\n    end`',
  'Fake: start x end Real: start ```text [x](url) ``` end',
  '<p dir="auto">Fake: `start</p>\n<pre lang="text" class="notranslate"><code class="notranslate">[x](url)\n</code></pre>\n<p dir="auto">end`</p>\n<p dir="auto">Real: <code class="notranslate">start ```text [x](url) ``` end</code></p>');
eq("single-line code cannot consume a later multiline code occurrence",
  'Use `x`\na [x](url) ` a [x](url)\n`',
  'Use `x`\na x ` a [x](url)\n`',
  'Use x a x a [x](url)',
  '<p dir="auto">Use <code class="notranslate">x</code><br>\na <a href="url">x</a> <code class="notranslate">a [x](url)</code></p>');
eq("a single-line span does not desynchronize the reported CodeRabbit example",
  'Use `x` and `<div class="a">\n  y</div>` here',
  'Use `x` and `<div class="a">\n  y</div>` here',
  'Use x and <div class="a"> y</div> here',
  '<p dir="auto">Use <code class="notranslate">x</code> and <code class="notranslate">&lt;div class="a"&gt; y&lt;/div&gt;</code> here</p>');
const malformedTagRun = `<A ${" ".repeat(256)}${"<".repeat(256)}`;
eq("malformed tag-like text in a multiline span stays literal",
  `Before \`start\n  ${malformedTagRun}\nend\` after`,
  `Before \`start\n  ${malformedTagRun}\nend\` after`);
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

eq("nested tokens in multiline code tags are restored from the outside in",
  'Use ``start\n<div data-x="`value`">\nend`` here',
  'Use ``start\n<div data-x="`value`">\nend`` here');

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
