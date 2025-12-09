export const runtime = "edge";

export default async function handler(req) {
  return new Response("TEST OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
}
