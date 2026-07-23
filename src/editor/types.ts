/**
 * =============================================================================
 * MODULE: Editor Domain Types (`/src/editor/types.ts`)
 * SINGLE RESPONSIBILITY:
 *   Provides strict, centralized TypeScript interfaces and type aliases for all
 *   canvas elements, graphic properties, undo/redo state snapshots, and page listings.
 * =============================================================================
 */

export type ElementType = 'text' | 'shape' | 'image' | 'frame';

export interface ShadowItem {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface ZineElement {
  type: ElementType;
  x: number; // Stored as percentage of baseline canvasWidth (390px)
  y: number; // Stored as percentage of baseline canvasWidth (390px)
  w: number; // Width as percentage of baseline canvasWidth (390px)
  h?: number; // Height as percentage of baseline canvasWidth for shapes/images/frames
  
  // Typography
  content?: string; // HTML or plain text string
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  color?: string;
  textAlign?: string;
  tracking?: string; // CSS letter-spacing
  leading?: number; // CSS line-height
  
  // Fills & Vectors
  fillType?: 'solid' | 'gradient' | 'none';
  fillColor?: string;
  gradientColorStart?: string;
  gradientColorEnd?: string;
  gradientAngle?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shapeType?: 'rectangle' | 'circle' | 'triangle' | 'star' | 'heart' | 'custom';
  customSvgPath?: string;
  
  // Media & Images
  src?: string;
  aspectRatio?: string;
  bgImage?: string;
  bgImageMode?: 'cover' | 'contain' | 'tile';
  
  // Borders & Corner Radii
  borderRadius?: number;
  elementBorderRadius?: number;
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: number;
  
  // Spacing & Box Model
  linkPadding?: boolean;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  
  // 3D Spatial Transforms & Skew
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  skewX?: number;
  skewY?: number;
  
  // Composition & FX
  opacity?: number;
  blendMode?: string;
  shadowEnable?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  shadows?: ShadowItem[];
  
  // Hyperlinks & Custom Identifiers
  customId?: string;
  hyperlink?: string;
  hyperlinkTarget?: string;
  hyperlinkType?: 'page' | 'external';
}

export interface UndoSnapshot {
  elements: ZineElement[];
  backgroundColor: string;
  activeElementIndex: number | null;
  selectedIndices: number[];
}

export interface EditorState {
  activePage: string;
  elements: ZineElement[];
  selectedIndices: number[];
  activeElementIndex: number | null;
  googleFonts: string[];
  backgroundColor: string;
  canvasX: number;
  horizontalScroll: boolean;
  isUnsaved: boolean;
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];
}

export interface PageInfo {
  path: string;
  title: string;
  isDefault?: boolean;
}
