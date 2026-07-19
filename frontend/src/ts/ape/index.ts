import { buildClient } from "./adapters/firestore-adapter";
import { contract } from "@monkeytype/contracts";
import { devContract } from "@monkeytype/contracts/dev";

// The transport no longer hits an HTTP backend. Requests are dispatched to
// Firestore handlers (see ./firestore). Out-of-scope routes resolve to 501.
const firestoreClient = buildClient(contract);
const devClient = buildClient(devContract);

// API Endpoints
const Ape = {
  ...firestoreClient,
  dev: devClient,
};

export default Ape;
