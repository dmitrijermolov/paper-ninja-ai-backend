export const runtime = "edge";

export default async function handler(request) {
  return new Response("Backend OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}
