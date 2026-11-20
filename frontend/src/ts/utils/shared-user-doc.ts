import { collection, doc, DocumentSnapshot, getDoc } from "firebase/firestore";

import { getDb } from "../firebase";

/**
 * One read for many callers. After a test, every shop (avatar, hands, pets,
 * RGB, caret...) refreshes its coin balance at the same moment, and each
 * used to read users/{uid} on its own - ~10 reads at once, right as the next
 * test starts. Calls made while a read is still in flight now share it.
 * Only in-flight reads are shared, so a read after a purchase is always fresh.
 */
const inFlight = new Map<string, Promise<DocumentSnapshot>>();

export async function getUserDocShared(uid: string): Promise<DocumentSnapshot> {
  const pending = inFlight.get(uid);
  if (pending !== undefined) return pending;
  const read = getDoc(doc(collection(getDb(), "users"), uid)).finally(() => {
    inFlight.delete(uid);
  });
  inFlight.set(uid, read);
  return read;
}
