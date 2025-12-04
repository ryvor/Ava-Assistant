// ava/nlu/rasaClient.ts
import http from "http";

export interface NluIntent {
  name: string;
  confidence: number;
}

export interface NluResult {
  text: string;
  intent: NluIntent | null;
  entities: any[];
  raw: any;
}

const RASA_URL = process.env.RASA_URL || "http://localhost:5005/model/parse";

export async function parseText(text: string): Promise<NluResult> {
  const payload = JSON.stringify({ text });

  return new Promise((resolve, reject) => {
    const url = new URL(RASA_URL);

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);

          const intent = json.intent ?? null;
          const entities = json.entities ?? [];

          const nluResult: NluResult = {
            text,
            intent,
            entities,
            raw: json,
          };

          resolve(nluResult);
        } catch (err) {
          reject(new Error("Failed to parse Rasa response: " + body));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}
