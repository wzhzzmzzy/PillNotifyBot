export function updateText(params: {
  title: string;
  message: string;
  signature: string;
  icon: string;
  link: string;
}) {
  if (!import.meta.env.QUOTE_API_KEY) return "No QUOTE_API_KEY";
  if (!import.meta.env.QUOTE_DEVICE_ID) return "No QUOTE_DEVICE_ID";

  return fetch("https://dot.mindreset.tech/api/open/text", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.QUOTE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshNow: true,
      deviceId: import.meta.env.QUOTE_DEVICE_ID,
      ...params,
    }),
  }).then((res) => res.json());
}
