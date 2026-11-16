import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function secretKey(): string {
  const packed = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (packed) {
    try {
      const parsed = JSON.parse(packed);
      const value = parsed.default ?? Object.values(parsed)[0];
      if (typeof value === "string" && value) return value;
    } catch { /* use legacy server-only key below */ }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("Server secret key is not configured");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return json({ error: "Sign in first" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser(token);
    const caller = authData.user;
    if (authError || !caller || caller.is_anonymous) return json({ error: "A registered account is required" }, 403);

    const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = body?.action;
    const { data: existingProfile } = await admin.from("profiles").select("id,username,display_name,bio,avatar_url").eq("username", "bubble_test_bot").maybeSingle();
    let bot = existingProfile;
    if (!bot) {
      const botEmail = "bubble-test-bot+tjmbzhcshztxwpzinenj@example.com";
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = listed?.users?.find((u) => u.email === botEmail);
      let botId = existingUser?.id;
      if (!botId) {
        const randomPassword = crypto.randomUUID() + "-" + crypto.randomUUID() + "-Aa9!";
        const { data: created, error } = await admin.auth.admin.createUser({
          email: botEmail, password: randomPassword, email_confirm: true,
          user_metadata: { username: "bubble_test_bot", display_name: "Bubble Test Bot", is_test_bot: true },
        });
        if (error) throw error;
        botId = created.user.id;
      }
      const { error: profileError } = await admin.from("profiles").upsert({
        id: botId, username: "bubble_test_bot", display_name: "Bubble Test Bot",
        bio: "Automated test account for friend requests and private-message checks.",
      }, { onConflict: "id" });
      if (profileError) throw profileError;
      const { data: savedBot, error: savedBotError } = await admin.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", botId).single();
      if (savedBotError) throw savedBotError;
      bot = savedBot;
    }
    if (bot.id === caller.id) return json({ error: "This account cannot test itself" }, 400);
    const a = caller.id < bot.id ? caller.id : bot.id;
    const b = caller.id < bot.id ? bot.id : caller.id;
    const { data: friendship } = await admin.from("friendships").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();

    if (action === "invite") {
      if (friendship) return json({ bot, already_friends: true });
      const { data: pending } = await admin.from("friend_requests").select("id").eq("sender_id", bot.id).eq("receiver_id", caller.id).eq("status", "pending").maybeSingle();
      if (!pending) {
        const { error } = await admin.from("friend_requests").insert({ sender_id: bot.id, receiver_id: caller.id, status: "pending" });
        if (error) throw error;
      }
      return json({ bot, request_sent: true });
    }

    if (action === "accept-outgoing") {
      if (friendship) return json({ bot, already_friends: true });
      const { data: pending, error } = await admin.from("friend_requests").select("id").eq("sender_id", caller.id).eq("receiver_id", bot.id).eq("status", "pending").maybeSingle();
      if (error) throw error;
      if (!pending) return json({ error: "No outgoing request to the test bot was found" }, 404);
      const { error: updateError } = await admin.from("friend_requests").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", pending.id);
      if (updateError) throw updateError;
      const { error: friendshipError } = await admin.from("friendships").upsert({ user_a: a, user_b: b }, { onConflict: "user_a,user_b" });
      if (friendshipError) throw friendshipError;
      return json({ bot, accepted: true });
    }

    if (action === "reply") {
      const conversationId = body?.conversation_id;
      if (typeof conversationId !== "string") return json({ error: "Conversation ID is required" }, 400);
      const { data: conversation, error: conversationError } = await admin.from("private_conversations").select("id,user_a,user_b").eq("id", conversationId).maybeSingle();
      if (conversationError || !conversation) return json({ error: "Conversation not found" }, 404);
      const participants = [conversation.user_a, conversation.user_b];
      if (!participants.includes(caller.id) || !participants.includes(bot.id)) return json({ error: "Conversation is not between you and the test bot" }, 403);
      const messageId = body?.message_id;
      if (typeof messageId !== "string") return json({ error: "Message ID is required" }, 400);
      const { data: latest, error: latestError } = await admin.from("private_messages").select("id,sender_id,body,created_at").eq("id", messageId).eq("conversation_id", conversationId).eq("sender_id", caller.id).maybeSingle();
      if (latestError) throw latestError;
      if (!latest) return json({ error: "The message to reply to was not found" }, 404);
      const { data: duplicate } = await admin.from("private_messages").select("id").eq("conversation_id", conversationId).eq("sender_id", bot.id).eq("body", "Bubble Chat test reply: " + messageId).maybeSingle();
      if (duplicate) return json({ replied: true, duplicate_suppressed: true });
      const lower = String(latest.body ?? "").toLowerCase();
      let reply = "Test bot here. Your message reached the private conversation. Friend and message checks are working in this preview.";
      if (lower.includes("hello") || lower.includes("hi")) reply = "Hello! I'm the Bubble Chat test bot. This private chat is connected.";
      else if (lower.includes("friend")) reply = "Friend-system check: if we are friends, the request and acceptance flow has completed. You can test unfriending too.";
      else if (lower.includes("help")) reply = "Try sending 'hello', 'friend test', or any message. I reply here so you can test the private chat.";
      const { error: sendError } = await admin.from("private_messages").insert({ conversation_id: conversationId, sender_id: bot.id, body: reply + "\\n\\nBubble Chat test reply: " + messageId });
      if (sendError) throw sendError;
      return json({ replied: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("friend-test-bot:", error);
    return json({ error: "The test bot could not complete that action" }, 500);
  }
});
