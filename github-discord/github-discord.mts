import { Context } from '@netlify/functions'
import * as crypto from "crypto";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? "";

const onStar = (payload: any): string => {
  let message = ""
  const { action, sender, starred_at, repository } = payload
  if (starred_at) {
    message = `User ${sender.login} ${action} start on ${repository.full_name}`
  }

  return message
}

const onIssue = (payload: any): string => {
  const { action, issue } = payload

  const messageAction: { [key: string]: string } = {
    "opened": `an issue was opened with this title ${issue.title} by ${issue.user.login}`,
    "closed": `an issue was closed with this title ${issue.title} by ${issue.user.login}`,
    "reopened": `an issue was reopened with this title ${issue.title} by ${issue.user.login}`,
  }
  return messageAction[action] ?? "Something message"
}

const verifySignature = (request: Request, payload: string) => {
  const signature = crypto
    .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  const xHubSignature = request.headers.get("x-hub-signature-256") ?? "Unknown";

  let trusted = Buffer.from(`sha256=${signature}`, 'ascii');
  let untrusted = Buffer.from(xHubSignature, 'ascii');
  return crypto.timingSafeEqual(trusted, untrusted);

}

const notify = async (message: string) => {
  const body = {
    content: message,
  }
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    return false;
  }

  return true
}

export default async (request: Request, context: Context) => {
  try {
    const githubEvent = request.headers.get("x-github-event");
    if (!githubEvent) {
      return new Response(JSON.stringify({ message: "No publish in discord" }))
    }
    const payload = await request.json() ?? {}
    const isSignatureValid = verifySignature(request, JSON.stringify(payload));

    if (!isSignatureValid) {
      return new Response(JSON.stringify({ message: "Signature invalid" }), {
        status: 500,
      })
    }

    const action: { [key: string]: Function } = {
      "star": onStar,
      "issues": onIssue
    }
    const message = action[githubEvent](payload);

    await notify(message);

    return new Response(JSON.stringify({ message: "done" }))
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.toString() }), {
      status: 500,
    })
  }
}
