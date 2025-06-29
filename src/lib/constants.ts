
import type { ColorPalette, IconStyle, ShadowStyle } from './types';

export const PREDEFINED_PALETTES: ColorPalette[] = [
  { name: 'Samsung Blue', colors: ['#326281', '#77B5FE', '#F2F4F7', '#1D3C53'] },
  { name: 'Sunset', colors: ['#FFC3A0', '#FFAC81', '#FF928B', '#FF8993', '#FF8E9E'] },
  { name: 'Oceanic', colors: ['#AEEEEE', '#87CEEB', '#4682B4', '#5F9EA0', '#008B8B'] },
  { name: 'Forest', colors: ['#D2B48C', '#8FBC8F', '#2E8B57', '#556B2F', '#8B4513'] },
  { name: 'Monochrome', colors: ['#CCCCCC', '#999999', '#666666', '#333333', '#000000'] },
  { name: 'Vibrant', colors: ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#F1C40F'] },
  { name: 'Pastel', colors: ['#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFFFD1', '#CAFFBF'] },
  { name: 'Corporate', colors: ['#003f5c', '#58508d', '#bc5090', '#ff6361', '#ffa600'] },
  { name: 'Retro', colors: ['#D8CDBA', '#B5A589', '#847963', '#4E483A', '#2A261F'] },
];

export const ICON_STYLES: IconStyle[] = ['Flat', 'Outlined', 'Filled', '3D', 'Hand-drawn'];

export const SHADOW_STYLES: ShadowStyle[] = ['None', 'Drop Shadow', 'Long Shadow', 'Inner Shadow'];
