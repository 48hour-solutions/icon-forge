
export type IconStyle = 'Flat' | 'Outlined' | 'Filled' | '3D' | 'Hand-drawn';
export type ShadowStyle = 'None' | 'Drop Shadow' | 'Long Shadow' | 'Inner Shadow';

export interface ColorPalette {
  name: string;
  colors: string[];
}

export interface IconForgeFormValues {
  prompt: string;
  style: IconStyle;
  width: number;
  height: number;
  paletteName?: string;
  shadow: ShadowStyle;
  referenceImageDataUri?: string;
}

export interface IconData {
  id: string;
  prompt: string;
  dataUri: string;
  createdAt: Date;
  settings: IconForgeFormValues;
}
