/**
 * C.A.R.E handover capture — the concern/topic dropdown shown on the handoff card
 * (founder 2026-07-21). The list is chosen per company by a "business type" setting so
 * the system is ready for e-commerce sellers (order-centric topics) as well as general
 * SaaS/support. "Other" lets the customer type their own specific concern (free text).
 *
 * Pure config + validators — no I/O, so it's shared by the widget (customer-facing render)
 * AND the capture route (server-side validation of what the widget submits). Keep them in
 * ONE place so the dropdown the customer sees can never drift from what the server accepts.
 */

export type BusinessType = "general" | "ecommerce";

export const BUSINESS_TYPES: readonly BusinessType[] = ["general", "ecommerce"] as const;
export const DEFAULT_BUSINESS_TYPE: BusinessType = "general";

export function isBusinessType(v: unknown): v is BusinessType {
  return v === "general" || v === "ecommerce";
}

export type HandoverTopic = {
  /** Stable machine value stored on the conversation; never rename once shipped. */
  value: string;
  /** Customer-facing label in the dropdown. */
  label: string;
  /** "Other" — the widget reveals a free-text box so the customer states their own concern. */
  isOther?: boolean;
  /** Topics where an order number is worth asking for (e-commerce). */
  needsOrderNumber?: boolean;
};

const GENERAL_TOPICS: readonly HandoverTopic[] = [
  { value: "technical_issue", label: "Technical issue" },
  { value: "system_failure", label: "System failure / outage" },
  { value: "account_login", label: "Account / login" },
  { value: "billing", label: "Billing / payment" },
  { value: "how_to", label: "How-to / instructions" },
  { value: "bug", label: "Bug report" },
  { value: "other", label: "Other (describe it)", isOther: true },
];

const ECOMMERCE_TOPICS: readonly HandoverTopic[] = [
  { value: "order_tracking", label: "Order tracking", needsOrderNumber: true },
  { value: "return_refund", label: "Return / refund", needsOrderNumber: true },
  { value: "cancel_order", label: "Cancel order", needsOrderNumber: true },
  { value: "order_problem", label: "Wrong / damaged / missing item", needsOrderNumber: true },
  { value: "product_question", label: "Product question" },
  { value: "shipping", label: "Shipping / delivery", needsOrderNumber: true },
  { value: "billing", label: "Billing / payment" },
  { value: "other", label: "Other (describe it)", isOther: true },
];

/** The topic list a company's widget shows, by its business type. */
export function handoverTopicsFor(businessType: BusinessType): readonly HandoverTopic[] {
  return businessType === "ecommerce" ? ECOMMERCE_TOPICS : GENERAL_TOPICS;
}

/** Server-side guard: is `value` a real topic for this business type? (Reject spoofed submissions.) */
export function findTopic(
  businessType: BusinessType,
  value: string | null | undefined
): HandoverTopic | null {
  if (!value) return null;
  return handoverTopicsFor(businessType).find((t) => t.value === value) ?? null;
}

/** Does the chosen topic warrant capturing an order number? */
export function topicNeedsOrderNumber(businessType: BusinessType, value: string | null): boolean {
  return Boolean(findTopic(businessType, value)?.needsOrderNumber);
}

/** Is this the free-text "Other" topic (widget should show the concern text box)? */
export function topicIsOther(businessType: BusinessType, value: string | null): boolean {
  return Boolean(findTopic(businessType, value)?.isOther);
}

/**
 * Human label for a topic machine value WITHOUT knowing the business type — used on the
 * agent side, which reads a stored value and just wants to display it. Searches both
 * topic sets; falls back to the raw value so an unknown/legacy value still renders
 * something rather than vanishing.
 */
export function labelForAnyTopic(value: string | null | undefined): string | null {
  if (!value) return null;
  const hit =
    GENERAL_TOPICS.find((t) => t.value === value) ??
    ECOMMERCE_TOPICS.find((t) => t.value === value);
  return hit?.label ?? value;
}
