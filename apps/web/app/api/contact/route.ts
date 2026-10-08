import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notificationClient } from "@thinkabell/shared";
import { rateLimit, escapeHtml } from "@thinkabell/shared";
import { env } from "@thinkabell/config";
import { validateCsrfToken } from "@/src/utils/csrf";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Invalid email format"),
  subject: z.string().min(3, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const csrfValid = await validateCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "unknown-ip";
    const allowed = await rateLimit(`contact:${ip}`, 5, 300, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429, headers: { "Retry-After": "300" } },
      );
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const validation = contactSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    const { name, email, subject, message } = validation.data;

    // Escape all user-controlled fields before HTML interpolation.
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    const sent = await notificationClient.sendEmail(
      env.CONTACT_EMAIL || env.BREVO_SENDER_EMAIL,
      {
        subject: `ThinkaBell Contact: ${safeSubject}`,
        body: `New contact form submission:\n\nName: ${safeName}\nEmail: ${safeEmail}\nSubject: ${safeSubject}\n\nMessage:\n${safeMessage}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #2563eb; margin-bottom: 8px;">New Contact Form Submission</h2>
            <p style="font-size: 14px; color: #374151; margin-bottom: 4px;"><strong>Name:</strong> ${safeName}</p>
            <p style="font-size: 14px; color: #374151; margin-bottom: 12px;"><strong>Email:</strong> ${safeEmail}</p>
            <p style="font-size: 14px; color: #374151; margin-bottom: 12px;"><strong>Subject:</strong> ${safeSubject}</p>
            <div style="background: #f9fafb; padding: 12px; border-radius: 6px;">
              <p style="font-size: 14px; color: #374151; white-space: pre-wrap;">${safeMessage}</p>
            </div>
          </div>
        `,
        recipientEmail: email,
      },
    );

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send message. Please try again later." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Message sent successfully. We'll get back to you soon.",
    });
  } catch (err) {
    console.error("[ContactAPI] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
