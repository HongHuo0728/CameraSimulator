export {};
declare global {
  interface Window {
    desktop?: {
      windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
      onCloseRequested(callback: () => Promise<void>): () => void;
      finishClose(saved: boolean): Promise<void>;
      openConfig(): Promise<string | null>;
      saveConfig(text: string, name: string): Promise<boolean>;
      readDraft(): Promise<string | null>;
      writeDraft(text: string): Promise<void>;
      savePhoto(data: string, name: string): Promise<boolean>;
    };
  }
}
