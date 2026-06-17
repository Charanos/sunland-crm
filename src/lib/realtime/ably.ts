import Ably from "ably";

let restClient: Ably.Rest | null = null;

export function getAblyRest() {
  if (restClient) {
    return restClient;
  }

  const key = process.env.ABLY_API_KEY;

  if (!key) {
    return null;
  }

  restClient = new Ably.Rest({ key });
  return restClient;
}

export async function getAblyToken(userId: string) {
  const ably = getAblyRest();

  if (!ably) {
    throw new Error("ABLY_API_KEY is not configured");
  }

  return ably.auth.createTokenRequest({ clientId: userId });
}
