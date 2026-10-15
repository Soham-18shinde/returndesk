"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CUSTOMER_CONTACT_ERROR, isValidCustomerContact } from "@/lib/return-validation";

const REASONS = ["Damaged", "Wrong Item", "Size Issue", "Not As Described", "Changed Mind"];
const EMPTY_FORM = {
  customerName: "",
  customerContact: "",
  orderNumber: "",
  itemName: "",
  quantity: "1",
  reason: "",
};
const FIELD_LABELS = {
  customerName: "Customer name",
  customerContact: "Customer contact",
  orderNumber: "Order reference",
  itemName: "Item name",
  quantity: "Quantity",
  reason: "Reason",
};

function validateField(field, value) {
  if (field === "customerContact") {
    return isValidCustomerContact(value) ? "" : CUSTOMER_CONTACT_ERROR;
  }
  if (field === "quantity") {
    if (!/^\d+$/.test(value) || Number(value) < 1) return "Enter a positive whole number.";
    return "";
  }
  if (!value.trim()) return `${FIELD_LABELS[field]} is required.`;
  return "";
}

function validateForm(form) {
  return Object.fromEntries(
    Object.keys(FIELD_LABELS)
      .map((field) => [field, validateField(field, form[field])])
      .filter(([, error]) => error)
  );
}

export default function ReturnForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const submitting = useRef(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setServerError("");
    if (errors[name]) {
      const message = validateField(name, value);
      setErrors((current) => ({ ...current, [name]: message }));
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;

    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    setServerError("");
    if (Object.keys(validationErrors).length) {
      document.getElementById(Object.keys(validationErrors)[0])?.focus();
      return;
    }

    submitting.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
      });
      const result = await response.json();
      if (!response.ok) {
        const code = result?.error?.code;
        const message = code === "CONFLICT" || code === "BUSINESS_RULE_VIOLATION"
          ? "An active return already exists for this order and item. Check the order reference and item name, then try again."
          : result?.error?.message || "The return request could not be created. Please try again.";
        throw new Error(message);
      }
      if (!result?.data?.reference) {
        throw new Error("The request was created, but its reference was missing from the response. Contact support before submitting again.");
      }
      setCreated(result.data);
    } catch (error) {
      setServerError(error.message || "The return request could not be created. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function createAnother() {
    setCreated(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError("");
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <Link aria-label="ReturnDesk home" className="brand-lockup" href="/">
          <span className="brand-name">ReturnDesk</span>
        </Link>
        <div className="topbar-meta"><span className="desk-indicator" /> Operations</div>
      </header>

      <section aria-labelledby="form-page-title" className="form-page-intro">
        <Link className="back-link" href="/">← <span>All requests</span></Link>
        <p className="eyebrow">CUSTOMER OPERATIONS <span>·</span> RETURNS</p>
        <h1 id="form-page-title">{created ? "Return request created" : "Create a return request"}</h1>
        <p className="intro-copy">
          {created ? "The request is now in your returns queue." : "Add the customer and item details to start a return."}
        </p>
      </section>

      {created ? (
        <section aria-labelledby="success-title" className="form-card success-card">
          <div aria-hidden="true" className="success-mark">✓</div>
          <p className="eyebrow">REQUEST SUBMITTED</p>
          <h2 id="success-title">You’re all set</h2>
          <p className="success-copy">A new return request has been added to the dashboard.</p>
          <div className="created-reference">
            <span>Request reference</span>
            <strong>{created.reference}</strong>
          </div>
          <div className="success-actions">
            <button className="primary-button" onClick={() => router.push("/")} type="button">Return to dashboard</button>
            <button className="secondary-button" onClick={createAnother} type="button">Create another</button>
          </div>
        </section>
      ) : (
        <form className="form-card return-form" noValidate onSubmit={submit}>
          <div className="form-card-heading">
            <div>
              <h2>Request details</h2>
              <p>All fields are required unless marked optional.</p>
            </div>
            <span className="required-note"><span aria-hidden="true">*</span> Required</span>
          </div>

          {serverError && (
            <div className="server-error" role="alert">
              <strong>We couldn’t create this request</strong>
              <span>{serverError}</span>
            </div>
          )}

          <fieldset className="form-section">
            <legend>Customer information</legend>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="customerName">Customer name <span aria-hidden="true">*</span></label>
                <input autoComplete="name" id="customerName" name="customerName" onChange={updateField} value={form.customerName} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "customerName-error" : undefined} />
                {errors.customerName && <span className="field-error" id="customerName-error">{errors.customerName}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="customerContact">Customer contact <span aria-hidden="true">*</span></label>
                <input autoComplete="email" id="customerContact" name="customerContact" onChange={updateField} placeholder="Email or phone number" value={form.customerContact} aria-invalid={Boolean(errors.customerContact)} aria-describedby={errors.customerContact ? "customerContact-error" : undefined} />
                {errors.customerContact && <span className="field-error" id="customerContact-error">{errors.customerContact}</span>}
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section return-details-section">
            <legend>Order and item</legend>
            <div className="form-grid">
            <div className="form-field">
              <label htmlFor="orderNumber">Order reference <span aria-hidden="true">*</span></label>
              <input autoComplete="off" id="orderNumber" name="orderNumber" onChange={updateField} placeholder="For example, ORD-10482" value={form.orderNumber} aria-invalid={Boolean(errors.orderNumber)} aria-describedby={errors.orderNumber ? "orderNumber-error" : undefined} />
              {errors.orderNumber && <span className="field-error" id="orderNumber-error">{errors.orderNumber}</span>}
            </div>
              <div className="form-field">
                <label htmlFor="itemName">Item name <span aria-hidden="true">*</span></label>
                <input autoComplete="off" id="itemName" name="itemName" onChange={updateField} placeholder="Enter the item name from the order" value={form.itemName} aria-invalid={Boolean(errors.itemName)} aria-describedby={errors.itemName ? "itemName-error" : undefined} />
                {errors.itemName && <span className="field-error" id="itemName-error">{errors.itemName}</span>}
              </div>
            <div className="form-field">
              <label htmlFor="quantity">Quantity <span aria-hidden="true">*</span></label>
              <input id="quantity" inputMode="numeric" min="1" name="quantity" onChange={updateField} type="number" value={form.quantity} aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? "quantity-error" : undefined} />
              {errors.quantity && <span className="field-error" id="quantity-error">{errors.quantity}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="reason">Reason for return <span aria-hidden="true">*</span></label>
              <select id="reason" name="reason" onChange={updateField} value={form.reason} aria-invalid={Boolean(errors.reason)} aria-describedby={errors.reason ? "reason-error" : undefined}>
                <option disabled value="">Select a reason</option>
                {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
              {errors.reason && <span className="field-error" id="reason-error">{errors.reason}</span>}
            </div>
            </div>
          </fieldset>

          <div className="form-footer">
            <span className="form-footnote">A unique request reference will be generated on submission.</span>
            <div className="form-actions">
              <Link className="secondary-button" href="/">Cancel</Link>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <><span aria-hidden="true" className="button-spinner" /> Saving request…</> : "Create request"}
              </button>
            </div>
          </div>
        </form>
      )}
      <footer className="app-footer"><span>ReturnDesk</span><span>Returns management</span></footer>
    </main>
  );
}
