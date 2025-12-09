export const runtime = "edge";

export default async function handler(req) {
  return new Response(
    JSON.stringify({ ok: true, message: "Backend OK — edge function works." }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    }
  );
}
