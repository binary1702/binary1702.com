import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

type FormData = {
  kind?: "assessment" | "conversation";
  name: string;
  business?: string;
  role?: string;
  email: string;
  concern: string;
  decider?: string;
  systems?: string;
  outcome?: string;
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendEmail(data: FormData) {
  const { name, business, role, email, concern, decider, systems, outcome } = data;
  const isAssessment = data.kind === "assessment";
  const heading = isAssessment ? "Enterprise Workflow Assessment request" : "New conversation request";

  const html = `
    <h2>${heading}</h2>
    <p><strong>Name:</strong> ${name}</p>
    ${business ? `<p><strong>Company:</strong> ${business}</p>` : ""}
    ${role ? `<p><strong>Role:</strong> ${role}</p>` : ""}
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>${isAssessment ? "Operational problem" : "What's happening"}:</strong></p>
    <p>${concern.replace(/\n/g, "<br>")}</p>
    ${systems ? `<p><strong>Systems / departments:</strong> ${systems}</p>` : ""}
    ${outcome ? `<p><strong>What "fixed" looks like:</strong> ${outcome}</p>` : ""}
    ${decider ? `<p><strong>Decision maker:</strong> ${decider}</p>` : ""}
  `;

  const text = `
${heading}

Name: ${name}
${business ? `Company: ${business}\n` : ""}${role ? `Role: ${role}\n` : ""}Email: ${email}

${isAssessment ? "Operational problem" : "What's happening"}:
${concern}
${systems ? `\nSystems / departments: ${systems}` : ""}${outcome ? `\nWhat "fixed" looks like: ${outcome}` : ""}${decider ? `\nDecision maker: ${decider}` : ""}
  `.trim();

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER,
    replyTo: email,
    subject: `${isAssessment ? "Assessment request" : "New lead"}: ${name}${business ? ` (${business})` : ""}`,
    text,
    html,
  });
}

async function sendSlack(data: FormData) {
  const { name, business, role, email, concern, decider, systems, outcome } = data;
  const isAssessment = data.kind === "assessment";

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = [
    isAssessment ? `🏢 *Assessment request*` : `✨ *Request Received!*`,
    `🎉 *${name}*${role ? ` (${role})` : ""}${business ? ` · ${business}` : ""} — ${email}`,
    `🗣️ ${concern}`,
    systems ? `🧩 ${systems}` : "",
    outcome ? `🎯 ${outcome}` : "",
    decider ? `🫂 ${decider}` : "",
  ].filter(Boolean).join("\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const data: FormData = await req.json();

    if (!data.name || !data.email || !data.concern) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await Promise.all([sendEmail(data), sendSlack(data)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Form submission error:", error);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
