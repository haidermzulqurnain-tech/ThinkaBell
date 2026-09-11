import { env } from "@thinkabell/config";
import type { PushNotificationPayload, EmailNotificationPayload } from "../types";
import { logger } from "../utils/logger";

export interface INotificationClient {
  sendPush(subscriptionIdOrPlayerId: string, payload: PushNotificationPayload): Promise<boolean>;
  sendEmail(email: string, payload: EmailNotificationPayload): Promise<boolean>;
}

class NotificationClient implements INotificationClient {
  private oneSignalAppId: string;
  private oneSignalApiKey: string;
  private mailerLiteApiKey: string;

  constructor() {
    this.oneSignalAppId = env.ONESIGNAL_APP_ID || env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    this.oneSignalApiKey = env.ONESIGNAL_REST_API_KEY;
    this.mailerLiteApiKey = env.MAILERLITE_API_KEY;
  }

  /**
   * Dispatch push notification via OneSignal REST API
   */
  async sendPush(subscriptionIdOrPlayerId: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!this.oneSignalAppId || !this.oneSignalApiKey) {
      logger.info("[NotificationClient:Push] (Simulation) OneSignal push sent:", {
        recipient: subscriptionIdOrPlayerId,
        title: payload.title,
        message: payload.message,
        url: payload.url,
      });
      return true;
    }

    try {
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${this.oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: this.oneSignalAppId,
          include_subscription_ids: [subscriptionIdOrPlayerId],
          headings: { en: payload.title },
          contents: { en: payload.message },
          url: payload.url,
          big_picture: payload.imageUrl,
          data: payload.data,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[NotificationClient:Push] OneSignal API error HTTP ${response.status}`, errorText);
        return false;
      }

      logger.info(`[NotificationClient:Push] Push delivered to ${subscriptionIdOrPlayerId}`);
      return true;
    } catch (err) {
      logger.error(`[NotificationClient:Push] Failed to send push to ${subscriptionIdOrPlayerId}:`, err);
      return false;
    }
  }

  /**
   * Dispatch email notification via MailerLite API
   */
  async sendEmail(email: string, payload: EmailNotificationPayload): Promise<boolean> {
    if (!this.mailerLiteApiKey) {
      logger.info("[NotificationClient:Email] (Simulation) MailerLite email sent:", {
        recipient: email,
        subject: payload.subject,
        body: payload.body.substring(0, 100) + "...",
      });
      return true;
    }

    try {
      // MailerLite transactional / subscriber campaign dispatch
      const htmlContent =
        payload.html ||
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">ThinkaBell Price Drop Alert!</h2>
          <p style="font-size: 16px; color: #374151;">${payload.body}</p>
          ${
            payload.dealUrl
              ? `<div style="margin-top: 24px;">
                  <a href="${payload.dealUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Claim Deal Now &rarr;
                  </a>
                </div>`
              : ""
          }
          <hr style="margin-top: 32px; border: 0; border-top: 1px solid #e5e7eb;" />
          <p style="font-size: 12px; color: #9ca3af; margin-top: 12px;">
            You received this email because you subscribed to ThinkaBell deal alerts.
          </p>
        </div>
      `;

      const response = await fetch("https://connect.mailerlite.com/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.mailerLiteApiKey}`,
        },
        body: JSON.stringify({
          to: email,
          subject: payload.subject,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        // Some accounts use the subscribers API to trigger automated flows
        logger.warn(`[NotificationClient:Email] MailerLite API responded with status ${response.status}`);
        return false;
      }

      logger.info(`[NotificationClient:Email] Email delivered to ${email}`);
      return true;
    } catch (err) {
      logger.error(`[NotificationClient:Email] Failed to send email to ${email}:`, err);
      return false;
    }
  }
}

export const notificationClient: INotificationClient = new NotificationClient();
