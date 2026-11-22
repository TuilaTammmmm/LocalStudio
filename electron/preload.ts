import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFolderDialog: (options?: { title?: string }) => ipcRenderer.invoke('dialog:openFolder', options),
  openFileDialog: (options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  minimizeToTray: () => ipcRenderer.invoke('app:minimizeToTray'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('open-settings', handler);
    return () => ipcRenderer.removeListener('open-settings', handler);
  },
});
