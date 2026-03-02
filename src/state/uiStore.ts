import { create } from "zustand";

export type PreviewView = "player" | "dm";

type UiStore = {
  previewView: PreviewView;
  setPreviewView: (view: PreviewView) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  previewView: "player",
  setPreviewView: (previewView) => set({ previewView }),
}));
