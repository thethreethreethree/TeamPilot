// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DealAccountContacts } from "../DealAccountContacts";

/**
 * A deal's account and contacts (0370). Pinned: an account by typed name or by picking an existing one; a role change
 * and a removal are events; saving a contact's email re-reads the deal without writing a deal event (it once re-posted
 * the contact's role as a refresh, an extra event each time).
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const C = { id: "c1", name: "Dana Smith", title: "VP Sales", rank: "vp", role: "champion", email: null, phone: null };
function setup() {
  const post = vi.fn(async () => true);
  const reload = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/accounts")) return new Response(JSON.stringify({ accounts: [{ id: "a1", name: "Acme" }] }));
    if (init?.method === "POST") return new Response(JSON.stringify({ ok: true }));
    return new Response(JSON.stringify({ flows: [] }));
  }));
  render(<DealAccountContacts dealId="d1" account={null} contacts={[C]} busy={false} post={post} reload={reload} />);
  return { post, reload };
}

describe("DealAccountContacts", () => {
  it("sets the account by a typed name, or by picking an existing one", async () => {
    const { post } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Set the account" }));
    fireEvent.change(screen.getByLabelText("Account name"), { target: { value: "Acme Inc." } });
    fireEvent.click(screen.getByRole("button", { name: "Use this name" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith({ action: "account", name: "Acme Inc." }));
    fireEvent.click(screen.getByRole("button", { name: "Set the account" }));
    fireEvent.click(await screen.findByRole("button", { name: "Acme" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith({ action: "account", accountId: "a1" }));
  });
  it("a role change and a removal are posted as contact events", () => {
    const { post } = setup();
    fireEvent.change(screen.getByLabelText("Dana Smith's role on this deal"), { target: { value: "decision_maker" } });
    expect(post).toHaveBeenCalledWith({ action: "contact", contactId: "c1", role: "decision_maker" });
    fireEvent.click(screen.getByLabelText("Take Dana Smith off this deal"));
    expect(post).toHaveBeenCalledWith({ action: "contact", contactId: "c1", role: "removed" });
  });
  it("saving a contact's email re-reads the deal and writes no deal event", async () => {
    const { post, reload } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Email, phone/ }));
    const email = screen.getByLabelText("Dana Smith's email");
    fireEvent.change(email, { target: { value: "dana@example.com" } });
    fireEvent.blur(email);
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(post).not.toHaveBeenCalled();
  });
});
