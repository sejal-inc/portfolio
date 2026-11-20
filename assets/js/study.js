/* Renders a full case study from the data below. Each study page sets
   <body data-study="..."> and includes this script. Copy in [brackets]
   is placeholder text waiting for Sejal's draft. */
(function () {
  var STUDIES = {
    saas: {
      num: '01', file: 'saas-blog.html', bg: 'var(--cream)', accent: 'var(--tomato)', drawing: 'd-blog',
      title: 'A blog people actually <em>finish</em>.',
      client: 'Global spend-management SaaS', role: 'Marketing designer, blog and content design', when: '2023 – now',
      team: '[Team: content, SEO, product marketing]',
      summary: 'The blog was the company’s biggest source of organic traffic, and most readers left halfway down the page. I built a visual language that made long, technical posts easy to read, then rebuilt it twice as the brand changed.',
      sections: [
        { h: 'The brief', p: ['[Draft: what the blog looked like when you joined, who reads it (finance teams, accountants, founders) and what the business needed from it.]'], art: 1 },
        { h: 'What I noticed', p: ['[Draft: the insight. For example, that readers skim for the one answer they came for, so every post needed a visual that gives it to them at a glance.]'] },
        { h: 'What I made', p: ['Three blog design systems across two rebrands: templates for headers, inline visuals and comparison tables, and an infographic format that turned dense policy and process content into something people stop for.', '[Draft: how the systems changed with each rebrand, and how writers used them without you.]'], art: 3 },
        { h: 'What changed', metrics: [['#1', 'Most posts rank first on search'], ['3', 'Design systems through two rebrands'], ['[x]', '[Another number: traffic, time on page or shares]']], p: ['Competitors later adopted the infographic format.'] },
        { h: 'Looking back', p: ['[Draft: what you would do differently, and what this taught you about designing for readers rather than for the brand.]'] }
      ]
    },
    textile: {
      num: '02', file: 'textile-brand.html', bg: 'var(--sky)', accent: 'var(--forest)', drawing: 'd-textile',
      title: 'Words that help people <em>choose</em>.',
      client: 'D2C textile brand', role: 'Brand strategist and content designer (freelance)', when: '2026',
      team: '[Team: founder, one collaborator]',
      summary: 'Shoppers were landing on product pages that listed fabric facts but never said why one throw or towel was right for them. I rebuilt how the brand describes, names and presents its products.',
      sections: [
        { h: 'The brief', p: ['[Draft: where the brand was, what it sells, and the problem the founder brought to you.]'], art: 1 },
        { h: 'What I noticed', p: ['[Draft: how shoppers actually read a product page, and what was getting in their way.]'] },
        { h: 'What I made', p: ['A product description framework, a naming system for collections, claim badges in place of long paragraphs, and product page layouts shaped by how shoppers read.', '[Draft: one example of a before and after.]'], art: 3 },
        { h: 'What changed', metrics: [['#1', 'Most collection pages rank first'], ['Top 3', 'Core category terms on search'], ['[x]', '[Another number, if you have one]']], p: [] },
        { h: 'Looking back', p: ['[Draft: what you learnt about writing for people who are about to spend money.]'] }
      ]
    },
    lantana: {
      num: '03', file: 'lantana.html', bg: 'var(--butter)', accent: 'var(--tomato)', drawing: 'd-chair',
      title: 'An invasive weed, worth <em>bidding</em> on.',
      client: 'Passion project', role: 'Concept, brand and campaign', when: 'Since 2023',
      team: '[Collaborators, if any]',
      summary: 'Lantana camara chokes forests across the Western Ghats. The Soliga community uproots it and turns it into furniture. This project gives that work an audience: a concept catalogue, a campaign and an invite-only auction of one-of-a-kind pieces.',
      sections: [
        { h: 'The problem', p: ['[Draft: the weed, the forests, and why most people have never heard of either.]'], art: 1 },
        { h: 'The people', p: ['[Draft: the Soliga, the craft, and the organisations already involved.]'] },
        { h: 'What I made', p: ['[Draft: the catalogue, the campaign idea, and why an auction rather than a shop.]'], art: 3 },
        { h: 'Where it is now', p: ['[Draft: current status and what comes next.]'] }
      ]
    }
  };
  var ORDER = ['saas', 'textile', 'lantana'];

  function art(n, drawing, accent) {
    var shapes = ['50%', '999px 999px 24px 24px', '28px'];
    var out = '<div class="study-art n' + n + '">';
    for (var i = 0; i < n; i++) {
      out += '<div class="ph" style="border-radius:' + shapes[i % 3] + ';background:' + (i % 2 ? 'var(--paper)' : accent) + '">' +
        '<svg class="ph-art drawing" viewBox="0 0 200 200" aria-hidden="true"><use href="#' + drawing + '"/></svg>' +
        '<span class="ph-note">Image placeholder</span></div>';
    }
    return out + '</div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var key = document.body.getAttribute('data-study');
    var s = STUDIES[key];
    if (!s) return;
    var next = STUDIES[ORDER[(ORDER.indexOf(key) + 1) % ORDER.length]];
    var root = document.getElementById('study');
    root.style.setProperty('--bg', s.bg);
    root.style.setProperty('--accent', s.accent);

    var html =
      '<header class="study-hero">' +
        '<a class="back label" href="case-studies.html">← All case studies</a>' +
        '<span class="num">' + s.num + '</span>' +
        '<h1 class="display">' + s.title + '</h1>' +
        '<dl class="facts">' +
          '<div><dt class="label">Client</dt><dd>' + s.client + '</dd></div>' +
          '<div><dt class="label">Role</dt><dd>' + s.role + '</dd></div>' +
          '<div><dt class="label">When</dt><dd>' + s.when + '</dd></div>' +
          '<div><dt class="label">Team</dt><dd>' + s.team + '</dd></div>' +
        '</dl>' +
      '</header>' +
      '<div class="study-cover ph" style="background:' + s.accent + '">' +
        '<svg class="ph-art drawing" viewBox="0 0 200 200" aria-hidden="true"><use href="#' + s.drawing + '"/></svg>' +
        '<span class="ph-note">Cover image placeholder</span></div>' +
      '<p class="study-summary display reveal">' + s.summary + '</p>';

    s.sections.forEach(function (sec, i) {
      html += '<section class="study-sec reveal"><h2 class="label"><span>' + String(i + 1).padStart(2, '0') + '</span>' + sec.h + '</h2><div class="body">';
      if (sec.metrics) {
        html += '<div class="metrics">' + sec.metrics.map(function (m) {
          return '<div><b class="display">' + m[0] + '</b><span>' + m[1] + '</span></div>';
        }).join('') + '</div>';
      }
      sec.p.forEach(function (p) { html += '<p' + (p.charAt(0) === '[' ? ' class="todo"' : '') + '>' + p + '</p>'; });
      html += '</div></section>';
      if (sec.art) html += art(sec.art, s.drawing, s.accent);
    });

    html +=
      '<a class="study-next" href="' + next.file + '" data-hover>' +
        '<span class="label">Next case study</span>' +
        '<span class="display">' + next.title + '</span>' +
        '<svg class="drawing" viewBox="0 0 200 200" aria-hidden="true"><use href="#' + next.drawing + '"/></svg>' +
      '</a>';

    root.innerHTML = html;
    document.title = s.title.replace(/<[^>]+>/g, '') + ' — Sejal Jain';
  });
})();
