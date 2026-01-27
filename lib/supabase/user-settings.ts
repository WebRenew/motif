import { createClient } from "./client"

export interface UserSettings {
  agentRules: string | null
}

/**
 * Get user settings (agent rules, etc.)
 */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("user_settings")
    .select("agent_rules")
    .eq("user_id", userId)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine for new users
    throw error
  }

  return {
    agentRules: data?.agent_rules ?? null,
  }
}

/**
 * Save agent rules (max 500 chars enforced by DB constraint)
 */
export async function saveAgentRules(
  userId: string,
  agentRules: string | null
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        agent_rules: agentRules,
      },
      { onConflict: "user_id" }
    )

  if (error) throw error
}
