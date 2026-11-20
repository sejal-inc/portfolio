/* Hand-drawn illustration set for Sejal Jain's portfolio.
   Each drawing is an SVG <symbol>; pages use <svg><use href="#d-name"/></svg>.
   Colours come from CSS variables, so a palette change recolours every drawing. */

/* Shared jigsaw outline (100 x 100 box), also used by the 404 canvas */
var PIECE = 'M20 30 H40 C38 16 62 16 60 30 H80 V50 C94 48 94 72 80 70 V90 H60 C62 78 38 78 40 90 H20 V70 C32 72 32 48 20 50 Z';

(function () {
  var S = 'stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  var T = 'stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  var sprite =
    '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
    '<defs>' +
    /* Subtle hand-drawn wobble: nudges straight lines so they read as drawn, not plotted */
    '<filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
    '<filter id="wobble2" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
    '</defs>' +

    /* Open sketchbook -> Case studies */
    '<symbol id="d-sketchbook" viewBox="0 0 200 200">' +
      '<path d="M22 72 L22 160 C58 148 88 152 100 164 C112 152 142 148 178 160 L178 72 Z" fill="var(--tomato)" ' + S + '/>' +
      '<path d="M30 62 C60 50 88 54 100 66 C112 54 140 50 170 62 L170 150 C140 139 112 142 100 154 C88 142 60 139 30 150 Z" fill="var(--paper)" ' + S + '/>' +
      '<path d="M100 66 L100 154" fill="none" ' + S + '/>' +
      '<path d="M142 58 L142 36 L148 43 L154 36 L154 58" fill="var(--butter)" ' + S + '/>' +
      '<path d="M44 82 C52 75 60 88 68 81 S82 76 88 83" fill="none" ' + T + '/>' +
      '<path d="M44 98 L86 94 M44 110 L80 107 M44 122 L74 120" fill="none" ' + T + '/>' +
      '<circle cx="134" cy="92" r="13" fill="var(--sky)" ' + T + '/>' +
      '<path d="M116 124 C128 114 142 132 156 118 M150 116 L157 118 L155 125" fill="none" ' + T + '/>' +
    '</symbol>' +

    /* Stack of printed photos -> Selected work */
    '<symbol id="d-photos" viewBox="0 0 200 200">' +
      '<g transform="rotate(-11 100 104)"><rect x="46" y="44" width="108" height="122" rx="3" fill="var(--sky)" ' + S + '/></g>' +
      '<g transform="rotate(7 100 104)"><rect x="46" y="44" width="108" height="122" rx="3" fill="var(--butter)" ' + S + '/></g>' +
      '<g transform="rotate(-2 100 104)">' +
        '<rect x="46" y="44" width="108" height="122" rx="3" fill="var(--paper)" ' + S + '/>' +
        '<rect x="56" y="54" width="88" height="78" fill="var(--blush)" ' + T + '/>' +
        '<circle cx="124" cy="74" r="9" fill="var(--butter)" ' + T + '/>' +
        '<path d="M56 120 L80 94 L96 110 L108 98 L144 126 L144 132 L56 132 Z" fill="var(--forest)" ' + T + '/>' +
        '<path d="M64 148 C76 144 88 152 100 147" fill="none" ' + T + '/>' +
      '</g>' +
    '</symbol>' +

    /* Hand mirror -> About */
    '<symbol id="d-mirror" viewBox="0 0 200 200">' +
      '<path d="M91 130 L86 184 C86 192 114 192 114 184 L109 130 Z" fill="var(--tomato)" ' + S + '/>' +
      '<ellipse cx="100" cy="76" rx="50" ry="60" fill="var(--butter)" ' + S + '/>' +
      '<ellipse cx="100" cy="76" rx="38" ry="47" fill="var(--sky)" ' + S + '/>' +
      '<path d="M78 58 C82 46 92 40 101 38 M76 72 C76 68 77 65 78 63" fill="none" stroke="var(--paper)" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="100" cy="140" r="7" fill="var(--paper)" ' + T + '/>' +
    '</symbol>' +

    /* Envelope with a stamp -> Contact */
    '<symbol id="d-envelope" viewBox="0 0 200 200">' +
      '<rect x="30" y="58" width="140" height="94" rx="5" fill="var(--paper)" ' + S + '/>' +
      '<path d="M30 63 L100 112 L170 63" fill="none" ' + S + '/>' +
      '<path d="M30 148 L84 106 M170 148 L116 106" fill="none" ' + T + '/>' +
      '<rect x="128" y="68" width="30" height="34" fill="var(--tomato)" stroke="var(--ink)" stroke-width="1.8" stroke-dasharray="3 3"/>' +
      '<path d="M143 92 C134 85 134 77 139 76 C141 75 143 77 143 79 C143 77 145 75 147 76 C152 77 152 85 143 92 Z" fill="var(--paper)" ' + T + '/>' +
      '<path d="M44 128 L74 128 M44 136 L66 136" fill="none" ' + T + '/>' +
    '</symbol>' +

    /* Folded sheet with paperclip -> Resume */
    '<symbol id="d-resume" viewBox="0 0 200 200">' +
      '<path d="M50 34 L134 34 L156 56 L156 172 L50 172 Z" fill="var(--paper)" ' + S + '/>' +
      '<path d="M134 34 L134 56 L156 56" fill="var(--sky)" ' + S + '/>' +
      '<circle cx="80" cy="74" r="12" fill="var(--blush)" ' + T + '/>' +
      '<path d="M100 68 L138 68 M100 80 L128 80" fill="none" ' + T + '/>' +
      '<path d="M66 104 L140 104 M66 118 L132 118 M66 132 L140 132 M66 146 L114 146" fill="none" ' + T + '/>' +
      '<path d="M66 16 L66 62 C66 72 80 72 80 62 L80 26 C80 16 60 16 60 26 L60 58" fill="none" stroke="var(--forest)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</symbol>' +

    /* Pencil (decorative) */
    '<symbol id="d-pencil" viewBox="0 0 200 200">' +
      '<path d="M44 148 L140 52 L156 68 L60 164 Z" fill="var(--butter)" ' + S + '/>' +
      '<path d="M50 154 L146 58" fill="none" ' + T + '/>' +
      '<path d="M140 52 L152 40 L168 56 L156 68 Z" fill="var(--tomato)" ' + S + '/>' +
      '<path d="M44 148 L60 164 L32 176 Z" fill="var(--paper)" ' + S + '/>' +
      '<path d="M32 176 L37 163 L45 171 Z" fill="var(--ink)" ' + T + '/>' +
    '</symbol>' +

    /* Lantana sprig (decorative, a nod to the Lantana project) */
    '<symbol id="d-lantana" viewBox="0 0 200 200">' +
      '<path d="M102 196 C98 160 106 126 100 84 M101 140 C118 128 132 116 140 98" fill="none" ' + S + '/>' +
      '<path d="M100 150 C82 146 70 136 66 122 C82 122 96 132 100 150 Z" fill="var(--forest)" ' + T + '/>' +
      '<path d="M104 118 C122 118 134 108 138 94 C122 94 108 104 104 118 Z" fill="var(--forest)" ' + T + '/>' +
      '<path d="M100 172 C118 170 128 160 132 148 C116 148 104 158 100 172 Z" fill="var(--forest)" ' + T + '/>' +
      floretCluster(100, 66, 1) + floretCluster(142, 84, 0.72) +
    '</symbol>' +

    /* Jigsaw piece (cursor, loader, 404) */
    '<symbol id="d-piece" viewBox="0 0 100 100">' +
      '<path d="' + PIECE + '" fill="currentColor" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>' +
    '</symbol>' +

    /* Case study drawings */
    '<symbol id="d-blog" viewBox="0 0 200 200">' +
      '<rect x="58" y="30" width="112" height="140" rx="4" fill="var(--sky)" ' + S + '/>' +
      '<rect x="32" y="44" width="112" height="140" rx="4" fill="var(--paper)" ' + S + '/>' +
      '<path d="M32 62 L144 62" fill="none" ' + S + '/>' +
      '<circle cx="42" cy="53" r="2.5" fill="var(--tomato)"/><circle cx="51" cy="53" r="2.5" fill="var(--butter)"/>' +
      '<path d="M46 78 L118 78 M46 88 L104 88" fill="none" ' + T + '/>' +
      '<rect x="48" y="102" width="80" height="56" rx="3" fill="var(--cream)" ' + T + '/>' +
      '<rect x="60" y="128" width="12" height="22" fill="var(--tomato)" ' + T + '/>' +
      '<rect x="80" y="116" width="12" height="34" fill="var(--butter)" ' + T + '/>' +
      '<rect x="100" y="110" width="12" height="40" fill="var(--forest)" ' + T + '/>' +
      '<path d="M46 170 L110 170" fill="none" ' + T + '/>' +
    '</symbol>' +

    '<symbol id="d-textile" viewBox="0 0 200 200">' +
      '<rect x="36" y="130" width="128" height="34" rx="10" fill="var(--forest)" ' + S + '/>' +
      '<rect x="44" y="98" width="116" height="34" rx="10" fill="var(--butter)" ' + S + '/>' +
      '<path d="M58 106 L58 124 M74 106 L74 124 M90 106 L90 124" fill="none" ' + T + '/>' +
      '<rect x="40" y="66" width="122" height="34" rx="10" fill="var(--tomato)" ' + S + '/>' +
      '<path d="M40 83 C80 76 120 90 162 83" fill="none" stroke="var(--paper)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M150 70 C156 50 152 38 142 32" fill="none" ' + T + '/>' +
      '<path d="M124 22 L150 22 L156 30 L150 38 L124 38 Z" fill="var(--paper)" ' + T + '/>' +
      '<circle cx="150" cy="30" r="2.4" fill="var(--ink)"/>' +
    '</symbol>' +

    '<symbol id="d-chair" viewBox="0 0 200 200">' +
      '<path d="M62 112 L56 186 M138 112 L146 186 M74 120 L72 176 M126 120 L130 176" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M50 108 C80 100 120 100 152 108 L146 122 C116 116 84 116 56 122 Z" fill="var(--butter)" ' + S + '/>' +
      '<path d="M60 106 C58 76 60 50 64 22 M140 106 C142 76 140 50 136 22" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M62 30 C90 22 112 24 138 30 M62 52 C90 46 112 48 138 54 M66 46 L134 92 M134 40 L68 90" fill="none" ' + T + '/>' +
      '<path d="M56 152 C82 146 118 146 144 152" fill="none" ' + T + '/>' +
      floretCluster(118, 96, 0.55) +
    '</symbol>' +

    '</svg>';

  function floretCluster(cx, cy, s) {
    var cols = ['var(--tomato)', 'var(--butter)', 'var(--pink)', 'var(--tomato)', 'var(--butter)', 'var(--pink)', 'var(--butter)', 'var(--tomato)', 'var(--pink)'];
    var pts = [[0, 0], [-14, -6], [14, -6], [-8, 10], [8, 10], [0, -16], [-20, 8], [20, 8], [0, 18]];
    var out = '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')">';
    for (var i = 0; i < pts.length; i++) {
      out += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="7.5" fill="' + cols[i] + '" stroke="var(--ink)" stroke-width="1.6"/>' +
             '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="1.6" fill="var(--ink)"/>';
    }
    return out + '</g>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var holder = document.createElement('div');
    holder.innerHTML = sprite;
    document.body.insertBefore(holder.firstChild, document.body.firstChild);
  });
})();
