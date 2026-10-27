// electron/preload.ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("employeeDesktop", {
  platform: process.platform,
  electron: process.versions.electron,
  node: process.versions.node,
});
