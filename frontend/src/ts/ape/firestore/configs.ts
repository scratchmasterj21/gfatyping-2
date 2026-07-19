import {
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  setDoc,
} from "firebase/firestore";
import {
  db,
  Handler,
  ok,
  okMessage,
  requireUid,
  stripUndefined,
} from "./common";

function configRef(uid: string): DocumentReference {
  return doc(db(), "users", uid, "config", "main");
}

export const get: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const snap = await getDoc(configRef(uid));
  return ok(snap.exists() ? snap.data() : null);
};

export const save: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  const body = stripUndefined((ctx.body ?? {}) as Record<string, unknown>);
  await setDoc(configRef(uid), body, { merge: true });
  return okMessage("config updated");
};

export const remove: Handler = async (ctx) => {
  const uid = requireUid(ctx);
  await deleteDoc(configRef(uid));
  return okMessage("config deleted");
};
