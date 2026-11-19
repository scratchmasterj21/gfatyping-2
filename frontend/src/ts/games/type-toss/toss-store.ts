import { callApi } from "../../api-client";
import { isAuthenticated } from "../../states/core";

/** Prize booth (api/claim-reward, type "tossBooth"): banked tickets + prizes. */
export type Booth = { tickets: number; prizes: string[]; bought?: boolean };

/** Bank tickets (0 = just read) and/or buy a prize. */
export async function boothRequest(
  tickets: number,
  buy?: string,
): Promise<Booth> {
  if (!isAuthenticated()) return { tickets: 0, prizes: [] };
  const res = await callApi<Booth>("/api/claim-reward", {
    type: "tossBooth",
    score: Math.max(0, Math.min(1500, Math.round(tickets))),
    ...(buy === undefined ? {} : { category: buy }),
  });
  return {
    tickets: res.tickets ?? 0,
    prizes: res.prizes ?? [],
    bought: res.bought === true,
  };
}
