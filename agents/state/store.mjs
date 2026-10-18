// Conversation store. The host calls one typed method per source, so the provenance
// tag is decided by CODE at the call site, never by the model or the customer.
// There is deliberately no generic append(provenance, ...) in the public API.

export const PROVENANCE = ["customer", "tool", "model", "human", "system"];
export const VERIFIED_PROVENANCE = new Set(["tool", "system"]);

const text = (v) => (typeof v === "string" ? v : JSON.stringify(v));

export function createStore(client) {
  async function insert(conversationId, provenance, content, extra = {}) {
    const row = {
      conversation_id: conversationId,
      provenance,
      content: text(content),
      ...extra,
    };
    // `verified` is never sent: the database generates it from the provenance.
    const { data, error } = await client
      .from("messages")
      .insert(row)
      .select(
        "id,seq,provenance,verified,content,tool_name,tool_use_id,created_at",
      )
      .single();
    if (error) throw new Error(`store: ${error.message}`);
    return data;
  }

  return {
    async startConversation(customerId) {
      const { data, error } = await client
        .from("conversations")
        .insert({ customer_id: customerId })
        .select("id,customer_id,created_at")
        .single();
      if (error) throw new Error(`store: ${error.message}`);
      return data;
    },
    addCustomer: (cid, content) => insert(cid, "customer", content),
    addModel: (cid, content) => insert(cid, "model", content),
    addHuman: (cid, content) => insert(cid, "human", content),
    addSystem: (cid, content) => insert(cid, "system", content),
    addTool: (cid, { name, toolUseId = null, result }) =>
      insert(cid, "tool", result, { tool_name: name, tool_use_id: toolUseId }),
    async history(conversationId) {
      const { data, error } = await client
        .from("messages")
        .select(
          "id,seq,provenance,verified,content,tool_name,tool_use_id,created_at",
        )
        .eq("conversation_id", conversationId)
        .order("seq");
      if (error) throw new Error(`store: ${error.message}`);
      return data;
    },
  };
}

// Turns stored history into API messages. The API only knows user and assistant, so
// the provenance label is written INTO the text. The model sees which lines are
// verified tool results and which are claims, including its own earlier words.
export function toModelMessages(history) {
  const out = [];
  const push = (role, content) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`;
    else out.push({ role, content });
  };
  for (const m of history) {
    switch (m.provenance) {
      case "customer":
        push("user", `[customer says, unverified] ${m.content}`);
        break;
      case "tool":
        push("user", `[tool result: ${m.tool_name}, verified] ${m.content}`);
        break;
      case "human":
        push("user", `[human agent note, unverified] ${m.content}`);
        break;
      case "system":
        push("user", `[system notice, verified] ${m.content}`);
        break;
      case "model":
        push("assistant", m.content);
        break;
      default:
        throw new Error(`Unknown provenance: ${m.provenance}`);
    }
  }
  return out;
}

// What the handoff package reads from the tags: verified findings come only from
// rows whose provenance is tool; the agent note is the latest model row, unverified.
export function handoffInputsFromHistory(history) {
  const findings = [];
  for (const m of history) {
    if (m.provenance !== "tool" || m.verified !== true) continue;
    let body;
    try {
      body = JSON.parse(m.content);
    } catch {
      continue;
    }
    if (body && typeof body === "object")
      findings.push({ source: `mcp:${m.tool_name}`, ...body });
  }
  const lastModel = [...history]
    .reverse()
    .find((m) => m.provenance === "model");
  const lastCustomer = [...history]
    .reverse()
    .find((m) => m.provenance === "customer");
  return {
    findings,
    agentNote: lastModel?.content ?? null,
    customerMessage: lastCustomer?.content ?? null,
  };
}
