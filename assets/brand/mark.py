# Builds the قديش mark (ق + Q, two dots, mint leaf) as SVG variants
import sys
def mark(body='url(#dark)', dots=None, leaf=True, mono=False):
    dots = dots or body
    # Mark geometry in a 1000 box; outer bowl, stem with tail, counter, leaf
    shape = '''
    <clipPath id="bowl"><circle cx="430" cy="620" r="290"/></clipPath>
    <mask id="cut"><rect x="0" y="0" width="1000" height="1000" fill="#fff"/><circle cx="440" cy="618" r="163" fill="#000"/></mask>'''
    outer = '''<g mask="url(#cut)">
      <circle cx="430" cy="620" r="290" fill="{b}"/>
      <path d="M600 620 H720 V752 C720 792 744 810 774 814 C796 817 800 840 778 846 C712 862 600 856 600 762 Z" fill="{b}"/>
    </g>'''.format(b=body)
    leafs = ''
    if leaf and not mono:
        leafs = '''<g clip-path="url(#bowl)">
      <path d="M150 430 C220 560 330 660 452 712 C510 737 560 780 604 858 L604 1000 L90 1000 L90 430 Z" fill="url(#mint)"/>
      <path d="M604 858 C540 790 470 752 360 724 C440 790 520 840 604 858 Z" fill="url(#deep)"/>
    </g>'''
    if mono:
        leafs = ''
    d = '''<circle cx="470" cy="214" r="62" fill="{d}"/><circle cx="628" cy="214" r="62" fill="{d}"/>'''.format(d=dots)
    return shape, outer + leafs + d

DEFS = '''<defs>
  <linearGradient id="dark" gradientUnits="userSpaceOnUse" x1="160" y1="140" x2="780" y2="900"><stop offset="0" stop-color="#0F4350"/><stop offset="1" stop-color="#06161E"/></linearGradient>
  <linearGradient id="mint" gradientUnits="userSpaceOnUse" x1="140" y1="480" x2="600" y2="900"><stop offset="0" stop-color="#3CF5B4"/><stop offset="1" stop-color="#12C089"/></linearGradient>
  <linearGradient id="deep" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#0B7A5B" stop-opacity="0.2"/><stop offset="1" stop-color="#0A5E48" stop-opacity="0.95"/></linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#123A47"/><stop offset="1" stop-color="#061820"/></linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.62" r="0.5"><stop offset="0" stop-color="#2EE6A6" stop-opacity="0.22"/><stop offset="1" stop-color="#2EE6A6" stop-opacity="0"/></radialGradient>
</defs>'''

def svg(size, bg=None, scale=0.72, body='url(#dark)', dots=None, leaf=True, mono=False, glow=False):
    clip, art = mark(body, dots, leaf, mono)
    s = size * scale / 1000
    # mark spans x 140..800, y 132..910 -> centre it
    cx, cy = 455, 532
    tx, ty = size/2 - cx*s, size/2 - cy*s
    back = ''
    if bg == 'dark': back = f'<rect width="{size}" height="{size}" fill="url(#bg)"/>'
    elif bg: back = f'<rect width="{size}" height="{size}" fill="{bg}"/>'
    if glow: back += f'<rect width="{size}" height="{size}" fill="url(#glow)"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{DEFS.replace("<defs>", "<defs>"+clip)}{back}<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})">{art}</g></svg>'

V = {
  # app icon: white mark + mint leaf on deep teal
  'icon': svg(1024, 'dark', 0.70, body='#FFFFFF', glow=True),
  # Android adaptive: foreground in the 66% safe zone, background separate
  'android-icon-foreground': svg(1024, None, 0.50, body='#FFFFFF'),
  'android-icon-background': svg(1024, 'dark', 1, glow=True).replace('<g transform', '<g opacity="0" transform'),
  'android-icon-monochrome': svg(1024, None, 0.50, body='#FFFFFF', mono=True),
  'splash-icon': svg(1024, None, 0.62, body='#FFFFFF'),
  'favicon': svg(196, 'dark', 0.74, body='#FFFFFF'),
  # in-app logos
  'logo-light': svg(512, None, 0.92, body='#FFFFFF'),
  'logo-dark': svg(512, None, 0.92),
  # preview on cream like the concept
  'preview-cream': svg(1024, '#F3F2EE', 0.72),
}
for k, v in V.items(): open(f'{k}.svg', 'w').write(v)
print('ok', list(V))
