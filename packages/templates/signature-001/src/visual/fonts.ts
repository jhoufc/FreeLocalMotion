import { createFontSet } from '@lms/motion-core';
import archivoLatin from '../fonts/archivo-latin-standard-normal.woff2';
import archivoLatinExt from '../fonts/archivo-latin-ext-standard-normal.woff2';
import interLatin from '../fonts/inter-latin-wght-normal.woff2';
import interLatinExt from '../fonts/inter-latin-ext-wght-normal.woff2';
import monoLatin from '../fonts/jetbrains-mono-latin-wght-normal.woff2';
import monoLatinExt from '../fonts/jetbrains-mono-latin-ext-wght-normal.woff2';

/** Family names are namespaced so they never collide with fonts installed on the machine. */
export const DISPLAY = 'LMS Archivo';
export const TEXT = 'LMS Inter';
export const MONO = 'LMS JetBrains Mono';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export const signatureFonts = createFontSet([
  { family: DISPLAY, url: archivoLatin, weight: '100 900', stretch: '62% 125%', unicodeRange: LATIN },
  { family: DISPLAY, url: archivoLatinExt, weight: '100 900', stretch: '62% 125%', unicodeRange: LATIN_EXT },
  { family: TEXT, url: interLatin, weight: '100 900', unicodeRange: LATIN },
  { family: TEXT, url: interLatinExt, weight: '100 900', unicodeRange: LATIN_EXT },
  { family: MONO, url: monoLatin, weight: '100 800', unicodeRange: LATIN },
  { family: MONO, url: monoLatinExt, weight: '100 800', unicodeRange: LATIN_EXT },
]);
