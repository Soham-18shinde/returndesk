"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const REASONS = ["Damaged", "Wrong Item", "Size Issue", "Not As Described", "Changed Mind"];
const RESOLUTIONS = ["Refund", "Replacement", "Store Credit"];
const LOCKED_STATUSES = new Set(["Approved", "Rejected", "Completed"]);

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function responseError(result, fallback) {
  return result?.error?.message || fallback;
}

function toEditableRequest(request) {
  return {
    customerName: request.customerName,
    customerContact: request.customerContact,
    orderNumber: request.orderNumber,
    itemName: request.itemName,
    quantity: String(request.quantity),
    reason: request.reason,
  };
}

export default function ReturnDetails({ identifier }) {
  const [request, setRequest] = useState(null);
  const [form, setForm] = useState(null);
  const [resolution, setResolution] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/returns/${encodeURIComponent(identifier)}`, { signal: controller.signal })
      .then(async (response) => ({ response, result: await readResponse(response) }))
      .then(({ response, result }) => {
        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) throw new Error(responseError(result, "The request could not be loaded."));
        if (!result?.data) throw new Error("The request response was incomplete.");
        setRequest(result.data);
        setForm(toEditableRequest(result.data));
        setResolution(result.data.resolution || "");
        setRefundAmount(result.data.refundAmount == null ? "" : String(result.data.refundAmount));
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(error.message || "The request could not be loaded. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identifier, reloadKey]);

  function clearMessages() {
    setServerError("");
    setFeedback("");
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    clearMessages();
    if (fieldErrors[name]) {
      const message = name === "quantity"
        ? (/^\d+$/.test(value) && Number(value) > 0 ? "" : "Enter a positive whole number.")
        : (value.trim() ? "" : "This field is required.");
      setFieldErrors((current) => ({ ...current, [name]: message }));
    }
  }

  function validateDetails() {
    const nextErrors = {};
    for (const field of ["customerName", "customerContact", "orderNumber", "itemName"]) {
      if (!form[field].trim()) nextErrors[field] = "This field is required.";
    }
    if (!/^\d+$/.test(form.quantity) || Number(form.quantity) < 1) {
      nextErrors.quantity = "Enter a positive whole number.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function sendPatch(action, payload, successMessage) {
    setBusyAction(action);
    clearMessages();
    try {
      const response = await fetch(`/api/returns/${encodeURIComponent(identifier)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(responseError(result, "The request could not be updated."));
      setRequest(result.data);
      setForm(toEditableRequest(result.data));
      setResolution(result.data.resolution || "");
      setRefundAmount(result.data.refundAmount == null ? "" : String(result.data.refundAmount));
      setFieldErrors({});
      setConfirmRemoval(false);
      setFeedback(successMessage);
    } catch (error) {
      setServerError(error.message || "The request could not be updated. Check your connection and try again.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveDetails(event) {
    event.preventDefault();
    if (!validateDetails()) return;
    await sendPatch("details", {
      customerName: form.customerName,
      customerContact: form.customerContact,
      orderNumber: form.orderNumber,
      itemName: form.itemName,
      quantity: Number(form.quantity),
      reason: form.reason,
    }, "Request details saved.");
  }

  async function changeStatus(status) {
    if (status === "Approved") {
      if (!resolution) {
        setFieldErrors({ resolution: "Choose a resolution before approval." });
        return;
      }
      if (resolution === "Refund" && (!/^\d+(\.\d{1,2})?$/.test(refundAmount) || Number(refundAmount) <= 0)) {
        setFieldErrors({ refundAmount: "Enter a refund greater than zero, with up to two decimal places." });
        return;
      }
    }

    const payload = { status };
    if (status === "Approved") {
      payload.resolution = resolution;
      payload.refundAmount = resolution === "Refund" ? refundAmount : null;
    }
    const message = status === "In Review" ? "Request moved to In Review."
      : status === "Approved" ? "Request approved."
        : status === "Rejected" ? "Request rejected."
          : "Request completed.";
    await sendPatch(`status-${status}`, payload, message);
  }

  async function appendNote(event) {
    event.preventDefault();
    if (!noteBody.trim()) {
      setFieldErrors({ noteBody: "Write a note before adding it." });
      return;
    }

    setBusyAction("note");
    clearMessages();
    try {
      const response = await fetch(`/api/returns/${encodeURIComponent(identifier)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(responseError(result, "The note could not be added."));
      setRequest((current) => ({
        ...current,
        notes: [...(current.notes || []), result.data].sort((left, right) =>
          new Date(left.createdAt) - new Date(right.createdAt) || left.id.localeCompare(right.id)
        ),
      }));
      setNoteBody("");
      setFieldErrors({});
      setFeedback("Note added.");
    } catch (error) {
      setServerError(error.message || "The note could not be added. Check your connection and try again.");
    } finally {
      setBusyAction("");
    }
  }

  async function removeRequest() {
    setBusyAction("remove");
    clearMessages();
    try {
      const response = await fetch(`/api/returns/${encodeURIComponent(identifier)}`, { method: "DELETE" });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(responseError(result, "The request could not be removed."));
      setRemoved(true);
      setConfirmRemoval(false);
    } catch (error) {
      setServerError(error.message || "The request could not be removed. Check your connection and try again.");
    } finally {
      setBusyAction("");
    }
  }

  const isLocked = request ? LOCKED_STATUSES.has(request.status) : true;
  const canRemove = request?.status === "Open" || request?.status === "Rejected";
  const notes = request?.notes || [];
  const lifecycleSteps = request?.status === "Rejected"
    ? ["Open", "In Review", "Rejected"]
    : ["Open", "In Review", "Approved", "Completed"];

  return (
    <main className="dashboard-shell details-shell">
      <header className="topbar">
        <Link aria-label="ReturnDesk home" className="brand-lockup" href="/">
          <span aria-hidden="true" className="brand-symbol">R</span>
          <span className="brand-name">ReturnDesk</span>
        </Link>
        <nav aria-label="Main navigation" className="main-navigation">
          <Link className="navigation-current" href="/">Returns</Link>
        </nav>
      </header>

      <div className="details-back-row">
        <Link className="back-link" href="/">← <span>All requests</span></Link>
      </div>

      {loading ? (
        <section aria-live="polite" className="detail-state-card">
          <span aria-hidden="true" className="loading-mark" />Loading request details…
        </section>
      ) : removed ? (
        <section aria-labelledby="removed-title" className="detail-state-card detail-success-card" role="status">
          <p className="eyebrow">REQUEST REMOVED</p>
          <h1 id="removed-title">Request removed</h1>
          <p>This request is no longer shown in the active returns desk.</p>
          <Link className="primary-button" href="/">Return to requests</Link>
        </section>
      ) : notFound ? (
        <section aria-labelledby="not-found-title" className="detail-state-card detail-error-card">
          <p className="eyebrow">REQUEST UNAVAILABLE</p>
          <h1 id="not-found-title">Request not found</h1>
          <p>This request may have been removed or the reference may be incorrect.</p>
          <Link className="primary-button" href="/">Return to requests</Link>
        </section>
      ) : loadError ? (
        <section aria-labelledby="load-error-title" className="detail-state-card detail-error-card" role="alert">
          <p className="eyebrow">REQUEST UNAVAILABLE</p>
          <h1 id="load-error-title">We couldn’t load this request</h1>
          <p>{loadError}</p>
          <button className="secondary-button" onClick={() => {
            setLoading(true);
            setLoadError("");
            setNotFound(false);
            setReloadKey((current) => current + 1);
          }} type="button">Try again</button>
        </section>
      ) : request && form ? (
        <>
          <header className="details-heading">
            <div>
              <p className="eyebrow">RETURN REQUEST</p>
              <h1>Request details</h1>
              <p className="details-reference">{request.reference}</p>
            </div>
            <span className={`status-badge status-${statusClass(request.status)}`}>{request.status}</span>
          </header>

          {feedback && <p className="detail-feedback" role="status">{feedback}</p>}
          {serverError && <div className="server-error detail-server-error" role="alert"><strong>We couldn’t complete that action</strong><span>{serverError}</span></div>}

          <div className="detail-layout">
            <div className="detail-main-column">
              <section aria-labelledby="request-information-title" className="detail-card">
                <header className="detail-card-heading">
                  <div>
                    <h2 id="request-information-title">Request information</h2>
                    <p>{isLocked ? "Customer and item details are locked after a decision." : "You can correct these details before a decision."}</p>
                  </div>
                  <span className="detail-created">Created {formatDateTime(request.createdAt)}</span>
                </header>

                <form className="detail-form" onSubmit={saveDetails}>
                  <div className="detail-field-grid">
                    <div className="form-field">
                      <label htmlFor="detail-customerName">Customer name <span aria-hidden="true">*</span></label>
                      <input disabled={isLocked || Boolean(busyAction)} id="detail-customerName" name="customerName" onChange={updateField} value={form.customerName} aria-invalid={Boolean(fieldErrors.customerName)} aria-describedby={fieldErrors.customerName ? "detail-customerName-error" : undefined} />
                      {fieldErrors.customerName && <span className="field-error" id="detail-customerName-error">{fieldErrors.customerName}</span>}
                    </div>
                    <div className="form-field">
                      <label htmlFor="detail-customerContact">Customer contact <span aria-hidden="true">*</span></label>
                      <input disabled={isLocked || Boolean(busyAction)} id="detail-customerContact" name="customerContact" onChange={updateField} value={form.customerContact} aria-invalid={Boolean(fieldErrors.customerContact)} aria-describedby={fieldErrors.customerContact ? "detail-customerContact-error" : undefined} />
                      {fieldErrors.customerContact && <span className="field-error" id="detail-customerContact-error">{fieldErrors.customerContact}</span>}
                    </div>
                    <div className="form-field">
                      <label htmlFor="detail-orderNumber">Order reference <span aria-hidden="true">*</span></label>
                      <input disabled={isLocked || Boolean(busyAction)} id="detail-orderNumber" name="orderNumber" onChange={updateField} value={form.orderNumber} aria-invalid={Boolean(fieldErrors.orderNumber)} aria-describedby={fieldErrors.orderNumber ? "detail-orderNumber-error" : undefined} />
                      {fieldErrors.orderNumber && <span className="field-error" id="detail-orderNumber-error">{fieldErrors.orderNumber}</span>}
                    </div>
                    <div className="form-field">
                      <label htmlFor="detail-itemName">Item name <span aria-hidden="true">*</span></label>
                      <input disabled={isLocked || Boolean(busyAction)} id="detail-itemName" name="itemName" onChange={updateField} value={form.itemName} aria-invalid={Boolean(fieldErrors.itemName)} aria-describedby={fieldErrors.itemName ? "detail-itemName-error" : undefined} />
                      {fieldErrors.itemName && <span className="field-error" id="detail-itemName-error">{fieldErrors.itemName}</span>}
                    </div>
                    <div className="form-field">
                      <label htmlFor="detail-quantity">Quantity <span aria-hidden="true">*</span></label>
                      <input disabled={isLocked || Boolean(busyAction)} id="detail-quantity" inputMode="numeric" min="1" name="quantity" onChange={updateField} type="number" value={form.quantity} aria-invalid={Boolean(fieldErrors.quantity)} aria-describedby={fieldErrors.quantity ? "detail-quantity-error" : undefined} />
                      {fieldErrors.quantity && <span className="field-error" id="detail-quantity-error">{fieldErrors.quantity}</span>}
                    </div>
                    <div className="form-field">
                      <label htmlFor="detail-reason">Reason <span aria-hidden="true">*</span></label>
                      <select disabled={isLocked || Boolean(busyAction)} id="detail-reason" name="reason" onChange={updateField} value={form.reason}>
                        {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                    </div>
                  </div>
                  {!isLocked && (
                    <div className="detail-form-actions">
                      <button className="primary-button" disabled={Boolean(busyAction)} type="submit">
                        {busyAction === "details" ? "Saving details…" : "Save details"}
                      </button>
                    </div>
                  )}
                </form>

                <dl className="resolution-summary">
                  <div><dt>Resolution</dt><dd>{request.resolution || "Not set"}</dd></div>
                  {request.refundAmount != null && <div><dt>Refund amount</dt><dd>{request.refundAmount}</dd></div>}
                </dl>
              </section>

              <section aria-labelledby="notes-title" className="detail-card notes-card">
                <header className="detail-card-heading">
                  <div>
                    <h2 id="notes-title">Notes</h2>
                    <p>Notes are recorded in order and cannot be changed later.</p>
                  </div>
                  <span className="detail-created">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
                </header>
                {notes.length ? (
                  <ol className="notes-list">
                    {notes.map((note) => (
                      <li key={note.id}>
                        <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
                        <p>{note.body}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="notes-empty">No notes have been added to this request.</p>}
                <form className="note-form" onSubmit={appendNote}>
                  <label htmlFor="noteBody">Add a note</label>
                  <textarea
                    aria-describedby={fieldErrors.noteBody ? "noteBody-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.noteBody)}
                    disabled={Boolean(busyAction)}
                    id="noteBody"
                    onChange={(event) => {
                      setNoteBody(event.target.value);
                      setFieldErrors((current) => ({ ...current, noteBody: "" }));
                      clearMessages();
                    }}
                    rows="3"
                    value={noteBody}
                  />
                  {fieldErrors.noteBody && <span className="field-error" id="noteBody-error">{fieldErrors.noteBody}</span>}
                  <div className="note-form-footer">
                    <span>Notes are append-only.</span>
                    <button className="primary-button" disabled={Boolean(busyAction)} type="submit">
                      {busyAction === "note" ? "Adding note…" : "Add note"}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <aside className="detail-side-column">
              <section aria-labelledby="workflow-title" className="detail-card workflow-card">
                <header className="detail-card-heading">
                  <div>
                    <h2 id="workflow-title">Request workflow</h2>
                    <p>Only the next legal action is available.</p>
                  </div>
                </header>
                <div className="workflow-content">
                  <ol className="lifecycle-list" aria-label="Request lifecycle">
                    {lifecycleSteps.map((step) => (
                      <li className={request.status === step ? "lifecycle-current" : ""} key={step}>
                        <span aria-hidden="true" className="lifecycle-dot" />
                        <span>{step}</span>
                        {request.status === step && <span className="sr-only">Current status</span>}
                      </li>
                    ))}
                  </ol>
                  {request.status === "Rejected" && <p className="workflow-final-status">Rejected requests are final.</p>}
                  {request.status === "Completed" && <p className="workflow-final-status">This request is complete.</p>}

                  {request.status === "Open" && (
                    <button className="primary-button workflow-action" disabled={Boolean(busyAction)} onClick={() => changeStatus("In Review")} type="button">
                      {busyAction === "status-In Review" ? "Saving…" : "Move to In Review"}
                    </button>
                  )}

                  {request.status === "In Review" && (
                    <div className="decision-controls">
                      <div className="form-field">
                        <label htmlFor="resolution">Resolution <span aria-hidden="true">*</span></label>
                        <select
                          aria-invalid={Boolean(fieldErrors.resolution)}
                          aria-describedby={fieldErrors.resolution ? "resolution-error" : undefined}
                          disabled={Boolean(busyAction)}
                          id="resolution"
                          onChange={(event) => {
                            setResolution(event.target.value);
                            setFieldErrors((current) => ({ ...current, resolution: "", refundAmount: "" }));
                            clearMessages();
                          }}
                          value={resolution}
                        >
                          <option value="">Choose a resolution</option>
                          {RESOLUTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                        {fieldErrors.resolution && <span className="field-error" id="resolution-error">{fieldErrors.resolution}</span>}
                      </div>
                      {resolution === "Refund" && (
                        <div className="form-field">
                          <label htmlFor="refundAmount">Refund amount (INR) <span aria-hidden="true">*</span></label>
                          <input
                            aria-invalid={Boolean(fieldErrors.refundAmount)}
                            aria-describedby={fieldErrors.refundAmount ? "refundAmount-error" : undefined}
                            disabled={Boolean(busyAction)}
                            id="refundAmount"
                            inputMode="decimal"
                            min="0.01"
                            onChange={(event) => {
                              setRefundAmount(event.target.value);
                              setFieldErrors((current) => ({ ...current, refundAmount: "" }));
                              clearMessages();
                            }}
                            placeholder="0.00"
                            step="0.01"
                            type="number"
                            value={refundAmount}
                          />
                          {fieldErrors.refundAmount && <span className="field-error" id="refundAmount-error">{fieldErrors.refundAmount}</span>}
                        </div>
                      )}
                      <button className="primary-button workflow-action" disabled={Boolean(busyAction)} onClick={() => changeStatus("Approved")} type="button">
                        {busyAction === "status-Approved" ? "Saving…" : "Approve request"}
                      </button>
                      <button className="secondary-button workflow-action" disabled={Boolean(busyAction)} onClick={() => changeStatus("Rejected")} type="button">
                        {busyAction === "status-Rejected" ? "Saving…" : "Reject request"}
                      </button>
                    </div>
                  )}

                  {request.status === "Approved" && (
                    <button className="primary-button workflow-action" disabled={Boolean(busyAction)} onClick={() => changeStatus("Completed")} type="button">
                      {busyAction === "status-Completed" ? "Saving…" : "Mark as completed"}
                    </button>
                  )}
                </div>
              </section>

              {canRemove && (
                <section aria-labelledby="remove-title" className="detail-card removal-card">
                  <h2 id="remove-title">Remove request</h2>
                  <p>Only Open or Rejected requests can be removed. The record remains stored but is hidden from the active desk.</p>
                  {confirmRemoval ? (
                    <div className="removal-confirmation" role="group" aria-label="Confirm request removal">
                      <span>Remove {request.reference}?</span>
                      <button className="danger-button" disabled={Boolean(busyAction)} onClick={removeRequest} type="button">{busyAction === "remove" ? "Removing…" : "Confirm remove"}</button>
                      <button className="secondary-button" disabled={Boolean(busyAction)} onClick={() => setConfirmRemoval(false)} type="button">Keep request</button>
                    </div>
                  ) : (
                    <button className="danger-button" disabled={Boolean(busyAction)} onClick={() => { clearMessages(); setConfirmRemoval(true); }} type="button">Remove request</button>
                  )}
                </section>
              )}
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}
