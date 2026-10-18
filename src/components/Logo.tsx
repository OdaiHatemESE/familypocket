import React, { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

/**
 * The قديش mark: the Arabic ق (its two dots) and a Q, with a mint leaf for growth.
 * Same geometry as assets/brand/mark.py, which renders the app icon and splash.
 * `tone`: 'light' draws the letter in white (for dark backgrounds), 'dark' in deep teal.
 */
export function Logo({ size = 64, tone = 'dark' }: { size?: number; tone?: 'light' | 'dark' }) {
  // Unique ids, so several logos on one screen don't share gradients
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const body = tone === 'light' ? '#FFFFFF' : `url(#dark${id})`;
  const width = (size * 700) / 790;
  return (
    <Svg width={width} height={size} viewBox="120 140 700 790" accessibilityLabel="قديش">
      <Defs>
        <LinearGradient id={`dark${id}`} gradientUnits="userSpaceOnUse" x1="160" y1="140" x2="780" y2="900">
          <Stop offset="0" stopColor="#0F4350" />
          <Stop offset="1" stopColor="#06161E" />
        </LinearGradient>
        <LinearGradient id={`mint${id}`} gradientUnits="userSpaceOnUse" x1="140" y1="480" x2="600" y2="900">
          <Stop offset="0" stopColor="#3CF5B4" />
          <Stop offset="1" stopColor="#12C089" />
        </LinearGradient>
        <LinearGradient id={`deep${id}`} x1="0" y1="0" x2="1" y2="0.3">
          <Stop offset="0" stopColor="#0B7A5B" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#0A5E48" stopOpacity="0.95" />
        </LinearGradient>
        <ClipPath id={`bowl${id}`}>
          <Circle cx="430" cy="620" r="290" />
        </ClipPath>
        <Mask id={`cut${id}`} x="0" y="0" width="1000" height="1000" maskUnits="userSpaceOnUse">
          <Rect x="0" y="0" width="1000" height="1000" fill="#fff" />
          <Circle cx="440" cy="618" r="163" fill="#000" />
        </Mask>
      </Defs>
      <G mask={`url(#cut${id})`}>
        <Circle cx="430" cy="620" r="290" fill={body} />
        <Path d="M600 620 H720 V752 C720 792 744 810 774 814 C796 817 800 840 778 846 C712 862 600 856 600 762 Z" fill={body} />
      </G>
      <G clipPath={`url(#bowl${id})`}>
        <Path d="M150 430 C220 560 330 660 452 712 C510 737 560 780 604 858 L604 1000 L90 1000 L90 430 Z" fill={`url(#mint${id})`} />
        <Path d="M604 858 C540 790 470 752 360 724 C440 790 520 840 604 858 Z" fill={`url(#deep${id})`} />
      </G>
      <Circle cx="470" cy="214" r="62" fill={body} />
      <Circle cx="628" cy="214" r="62" fill={body} />
    </Svg>
  );
}
