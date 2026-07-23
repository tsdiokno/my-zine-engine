/**
 * =============================================================================
 * MODULE: Editor State Store (`/src/editor/store.ts`)
 * SINGLE RESPONSIBILITY:
 *   Provides a unified, reactive vanilla Zustand store (`createStore`) managing
 *   document state, undo/redo history stacks, selection states, and canvas attributes.
 *
 * SYSTEM ARCHITECTURE & DATA FLOW:
 *   - Powered by `zustand/vanilla` to guarantee reactivity without React dependency lock-in.
 *   - Uses `lodash-es/cloneDeep` for robust, reference-isolated undo/redo snapshot copies.
 * =============================================================================
 */

import { createStore } from 'zustand/vanilla';
import cloneDeep from 'lodash-es/cloneDeep';
import { ZineElement, UndoSnapshot, EditorState } from './types';

export const MAX_UNDO_DEPTH = 50;
export const CANVAS_BASELINE_WIDTH = 390;

export interface EditorStoreState extends EditorState {
  // Action Handlers
  setActivePage: (pagePath: string) => void;
  setElements: (elements: ZineElement[]) => void;
  updateElement: (index: number, changes: Partial<ZineElement>) => void;
  addElement: (element: ZineElement) => void;
  deleteSelectedElements: () => void;
  duplicateSelectedElements: () => void;
  moveElement: (index: number, direction: 'forward' | 'front' | 'backward' | 'back') => void;
  setSelectedIndices: (indices: number[]) => void;
  selectElement: (index: number, isShift?: boolean) => void;
  setBackgroundColor: (color: string) => void;
  setGoogleFonts: (fonts: string[]) => void;
  setCanvasX: (x: number) => void;
  setHorizontalScroll: (enabled: boolean) => void;
  setIsUnsaved: (unsaved: boolean) => void;
  
  // History Stack Actions
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;
  resetHistory: () => void;
}

export const editorStore = createStore<EditorStoreState>((set, get) => ({
  activePage: '/',
  elements: [],
  selectedIndices: [],
  activeElementIndex: null,
  googleFonts: ['Syne'],
  backgroundColor: '#111111',
  canvasX: 50,
  horizontalScroll: false,
  isUnsaved: false,
  undoStack: [],
  redoStack: [],

  setActivePage: (pagePath) => set({ activePage: pagePath }),

  setElements: (elements) => set({ elements }),

  updateElement: (index, changes) => set((state) => {
    const updated = [...state.elements];
    if (updated[index]) {
      updated[index] = { ...updated[index], ...changes };
    }
    return { elements: updated, isUnsaved: true };
  }),

  addElement: (element) => set((state) => ({
    elements: [...state.elements, element],
    activeElementIndex: state.elements.length,
    selectedIndices: [state.elements.length],
    isUnsaved: true
  })),

  deleteSelectedElements: () => set((state) => {
    if (state.selectedIndices.length === 0 && state.activeElementIndex === null) {
      return state;
    }
    const targetIndices = new Set(
      state.selectedIndices.length > 0
        ? state.selectedIndices
        : (state.activeElementIndex !== null ? [state.activeElementIndex] : [])
    );
    const remaining = state.elements.filter((_, idx) => !targetIndices.has(idx));
    return {
      elements: remaining,
      selectedIndices: [],
      activeElementIndex: null,
      isUnsaved: true
    };
  }),

  duplicateSelectedElements: () => set((state) => {
    const targetIndices = state.selectedIndices.length > 0
      ? state.selectedIndices
      : (state.activeElementIndex !== null ? [state.activeElementIndex] : []);
    
    if (targetIndices.length === 0) return state;

    const duplicates = targetIndices
      .map(idx => state.elements[idx])
      .filter(Boolean)
      .map(el => {
        const copy = cloneDeep(el);
        copy.x += 3; // Offset duplicate slightly horizontally
        copy.y += 3; // Offset duplicate slightly vertically
        return copy;
      });

    const newElements = [...state.elements, ...duplicates];
    const newSelectedIndices = Array.from(
      { length: duplicates.length },
      (_, i) => state.elements.length + i
    );

    return {
      elements: newElements,
      selectedIndices: newSelectedIndices,
      activeElementIndex: newSelectedIndices[newSelectedIndices.length - 1] ?? null,
      isUnsaved: true
    };
  }),

  moveElement: (index, direction) => set((state) => {
    if (index < 0 || index >= state.elements.length) return state;
    const elements = [...state.elements];
    const el = elements.splice(index, 1)[0];
    
    let newIndex = index;
    if (direction === 'forward') newIndex = Math.min(elements.length, index + 1);
    else if (direction === 'front') newIndex = elements.length;
    else if (direction === 'backward') newIndex = Math.max(0, index - 1);
    else if (direction === 'back') newIndex = 0;
    
    elements.splice(newIndex, 0, el);
    
    // update selection if it was the selected element
    const newSelectedIndices = state.selectedIndices.map(i => {
      if (i === index) return newIndex;
      if (i > index && i <= newIndex) return i - 1; // It moved past them
      if (i < index && i >= newIndex) return i + 1; // It moved before them
      return i;
    });
    const newActiveIndex = state.activeElementIndex === index ? newIndex : 
                           (state.activeElementIndex !== null && state.activeElementIndex > index && state.activeElementIndex <= newIndex) ? state.activeElementIndex - 1 :
                           (state.activeElementIndex !== null && state.activeElementIndex < index && state.activeElementIndex >= newIndex) ? state.activeElementIndex + 1 :
                           state.activeElementIndex;
                           
    return {
      elements,
      selectedIndices: newSelectedIndices,
      activeElementIndex: newActiveIndex,
      isUnsaved: true
    };
  }),

  setSelectedIndices: (indices) => set({
    selectedIndices: indices,
    activeElementIndex: indices.length > 0 ? indices[indices.length - 1] : null
  }),

  selectElement: (index, isShift = false) => set((state) => {
    if (isShift) {
      const exists = state.selectedIndices.includes(index);
      const newIndices = exists
        ? state.selectedIndices.filter(i => i !== index)
        : [...state.selectedIndices, index];
      return {
        selectedIndices: newIndices,
        activeElementIndex: newIndices.length > 0 ? newIndices[newIndices.length - 1] : null
      };
    } else {
      return {
        selectedIndices: [index],
        activeElementIndex: index
      };
    }
  }),

  setBackgroundColor: (color) => set({ backgroundColor: color, isUnsaved: true }),

  setGoogleFonts: (fonts) => set({ googleFonts: fonts }),

  setCanvasX: (x) => set({ canvasX: x, isUnsaved: true }),

  setHorizontalScroll: (enabled) => set({ horizontalScroll: enabled, isUnsaved: true }),

  setIsUnsaved: (unsaved) => set({ isUnsaved: unsaved }),

  pushUndoState: () => {
    const state = get();
    const snapshot: UndoSnapshot = {
      elements: cloneDeep(state.elements),
      backgroundColor: state.backgroundColor,
      activeElementIndex: state.activeElementIndex,
      selectedIndices: [...state.selectedIndices]
    };
    const newUndoStack = [...state.undoStack, snapshot];
    if (newUndoStack.length > MAX_UNDO_DEPTH) {
      newUndoStack.shift();
    }
    set({ undoStack: newUndoStack, redoStack: [] });
  },

  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const currentSnapshot: UndoSnapshot = {
      elements: cloneDeep(state.elements),
      backgroundColor: state.backgroundColor,
      activeElementIndex: state.activeElementIndex,
      selectedIndices: [...state.selectedIndices]
    };
    const prevSnapshot = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    
    return {
      elements: cloneDeep(prevSnapshot.elements),
      backgroundColor: prevSnapshot.backgroundColor,
      activeElementIndex: prevSnapshot.activeElementIndex,
      selectedIndices: [...prevSnapshot.selectedIndices],
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, currentSnapshot],
      isUnsaved: true
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const currentSnapshot: UndoSnapshot = {
      elements: cloneDeep(state.elements),
      backgroundColor: state.backgroundColor,
      activeElementIndex: state.activeElementIndex,
      selectedIndices: [...state.selectedIndices]
    };
    const nextSnapshot = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);

    return {
      elements: cloneDeep(nextSnapshot.elements),
      backgroundColor: nextSnapshot.backgroundColor,
      activeElementIndex: nextSnapshot.activeElementIndex,
      selectedIndices: [...nextSnapshot.selectedIndices],
      undoStack: [...state.undoStack, currentSnapshot],
      redoStack: newRedoStack,
      isUnsaved: true
    };
  }),

  resetHistory: () => set({ undoStack: [], redoStack: [] })
}));
