/**
 * Tabs fed by a campaign of their own. A lead sent to one of these lands even
 * when the phone already sits in another tab (a parent from the general ad who
 * now asks about goalkeeper training); only a second copy in the same tab is
 * refused. A tab the webhook finds or makes by name (`tab_name`, one per sheet
 * tab) is treated the same way. Every other tab keeps the ad rule: a phone in
 * any tab is not added.
 */
export const OWN_CAMPAIGN_TAB_SLUGS: readonly string[] = ["goalkeepers"];

/** Whether a webhook lead is refused only by a copy in its own tab. */
export function isPerTabCampaign(input: { slug: string | null; byName: boolean }): boolean {
  return input.byName || (input.slug !== null && OWN_CAMPAIGN_TAB_SLUGS.includes(input.slug));
}

export interface ExistingLead {
  id: string;
  tab_id: string;
}

export interface WebhookLeadVerdict {
  /** The lead that makes this one a duplicate, or null to insert it. */
  duplicateOf: string | null;
  /** The WhatsApp flow goes only to a phone no tab holds yet. */
  sendFlow: boolean;
}

export function webhookLeadVerdict(input: {
  perTab: boolean;
  targetTabId: string;
  existing: readonly ExistingLead[];
}): WebhookLeadVerdict {
  const { perTab, targetTabId, existing } = input;
  const blocking = perTab ? existing.find((l) => l.tab_id === targetTabId) : existing[0];
  return {
    duplicateOf: blocking?.id ?? null,
    sendFlow: existing.length === 0,
  };
}
