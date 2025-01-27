import { Context } from '@netlify/functions'

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";

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

    const githubEvent = request.headers.get("x-github-event") ?? "Unknown";
    const payload = request.body;

    const action: { [key: string]: Function } = {
      "star": onStar,
      "issues": onIssue
    }
    const message = action[githubEvent](payload);

    await notify(message);

    return new Response(JSON.stringify({ message: "done" }), {
      
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.toString() }), {
      status: 500,
    })
  }
}
