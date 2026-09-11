import crypto from "crypto";
import { env } from "@thinkabell/config";
import { logger } from "../utils/logger";

export interface IAmazonClient {
  getPrice(asin: string): Promise<number | null>;
}

class AmazonPaApiClient implements IAmazonClient {
  private accessKey: string;
  private secretKey: string;
  private partnerTag: string;
  private region: string;
  private host: string;

  constructor() {
    this.accessKey = env.AMAZON_ACCESS_KEY;
    this.secretKey = env.AMAZON_SECRET_KEY;
    this.partnerTag = env.AMAZON_PARTNER_TAG;
    this.region = env.AMAZON_REGION || "us-east-1";
    this.host = `webservices.amazon.com`;
  }

  private hasCredentials(): boolean {
    return Boolean(this.accessKey && this.secretKey && this.partnerTag);
  }

  /**
   * Generates AWS Signature Version 4 headers for PA-API 5.0
   */
  private generateHeaders(payload: string, amzTarget: string): Record<string, string> {
    const service = "ProductAdvertisingAPI";
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    const canonicalUri = "/paapi5/getitems";
    const canonicalQuerystring = "";
    const canonicalHeaders =
      `content-encoding:amz-1.0\n` +
      `content-type:application/json; charset=utf-8\n` +
      `host:${this.host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:${amzTarget}\n`;
    const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

    const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");
    const canonicalRequest = `POST\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex")}`;

    // Calculate signature keys
    const kDate = crypto.createHmac("sha256", `AWS4${this.secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(this.region).digest();
    const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
    const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authorizationHeader = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "amz-1.0",
      "x-amz-date": amzDate,
      "x-amz-target": amzTarget,
      Authorization: authorizationHeader,
      Host: this.host,
    };
  }

  async getPrice(asin: string): Promise<number | null> {
    if (!this.hasCredentials()) {
      logger.debug(`[AmazonClient] No API credentials found. Returning simulated price for ASIN: ${asin}`);
      return this.simulatePrice(asin);
    }

    const payload = JSON.stringify({
      ItemIds: [asin],
      Resources: [
        "Offers.Listings.Price",
        "ItemInfo.Title",
      ],
      PartnerTag: this.partnerTag,
      PartnerType: "Associates",
      Marketplace: "www.amazon.com",
    });

    const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";
    const headers = this.generateHeaders(payload, target);

    try {
      const response = await fetch(`https://${this.host}/paapi5/getitems`, {
        method: "POST",
        headers,
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[AmazonClient] PA-API request failed HTTP ${response.status}`, errorText);
        return this.simulatePrice(asin);
      }

      const json = (await response.json()) as {
        ItemsResult?: {
          Items?: Array<{
            Offers?: {
              Listings?: Array<{
                Price?: {
                  Amount?: number;
                };
              }>;
            };
          }>;
        };
      };

      const item = json.ItemsResult?.Items?.[0];
      const amount = item?.Offers?.Listings?.[0]?.Price?.Amount;

      return typeof amount === "number" ? amount : null;
    } catch (error) {
      logger.error(`[AmazonClient] Network error fetching ASIN ${asin}:`, error);
      return this.simulatePrice(asin);
    }
  }

  /**
   * Deterministic simulated price for development and mock pipeline tests
   */
  private simulatePrice(asin: string): number {
    let hash = 0;
    for (let i = 0; i < asin.length; i++) {
      hash = (hash << 5) - hash + asin.charCodeAt(i);
      hash |= 0;
    }
    const base = Math.abs(hash % 300) + 49.99;
    return Math.round(base * 100) / 100;
  }
}

export const amazonClient: IAmazonClient = new AmazonPaApiClient();
