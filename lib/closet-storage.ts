import type { Clothing, Outfit } from "./closet";
export type ClosetState = {
  items: Clothing[];
  saved: Outfit[];
  tutorialDone?: boolean;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("wera-closet", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("closet");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readCloset(): Promise<ClosetState | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("closet", "readonly");
    const request = tx.objectStore("closet").get("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeCloset(value: ClosetState) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("closet", "readwrite");
    tx.objectStore("closet").put(value, "state");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}
