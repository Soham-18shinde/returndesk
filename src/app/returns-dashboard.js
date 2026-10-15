"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const PAGE_SIZE = 12;
const STATUSES = ["Open", "In Review", "Approved", "Rejected", "Completed"];
const REASONS = ["Damaged", "Wrong Item", "Size Issue", "Not As Described", "Changed Mind"];
const SORT_OPTIONS = [
  ["createdAt", "Date created"],
  ["reference", "Reference"],
  ["customerName", "Customer"],
  ["orderNumber", "Order"],
  ["status", "Status"],
  ["reason", "Reason"],
];

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${statusClass(status)}`}>{status}</span>;
}

function SortButton({ field, sortBy, sortOrder, onSort, children }) {
  const active = sortBy === field;
  return (
    <button
      aria-label={`Sort by ${children}${active ? `, currently ${sortOrder === "asc" ? "ascending" : "descending"}` : ""}`}
      className={`sort-button${active ? " sort-active" : ""}`}
      onClick={() => onSort(field)}
      type="button"
    >
      {children}
      <span aria-hidden="true" className="sort-mark">{active ? (sortOrder === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function StatusSummary({ counts, error, activeStatus, onStatusSelect, onRetry }) {
  if (error) {
    return (
      <div className="summary-message" role="status">
        <span>Status totals could not be loaded.</span>
        <button className="text-button" onClick={onRetry} type="button">Retry totals</button>
      </div>
    );
  }

  if (!counts) {
    return <p aria-live="polite" className="summary-message">Loading live status totals…</p>;
  }

  return (
    <div className="summary-grid" aria-label="Filter requests by status">
      {STATUSES.map((requestStatus) => (
        <button
          aria-pressed={activeStatus === requestStatus}
          className={`summary-card summary-${statusClass(requestStatus)}${activeStatus === requestStatus ? " summary-card-active" : ""}`}
          key={requestStatus}
          onClick={() => onStatusSelect(requestStatus)}
          type="button"
        >
          <span className="summary-card-label"><span aria-hidden="true" className="summary-dot" />{requestStatus}</span>
          <strong>{counts[requestStatus]}</strong>
          <span className="summary-card-caption">requests</span>
        </button>
      ))}
    </div>
  );
}

export default function ReturnsDashboard() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [statusCounts, setStatusCounts] = useState(null);
  const [statusCountsError, setStatusCountsError] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadRequests = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy,
      sortOrder,
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (reason) params.set("reason", reason);

    try {
      const response = await fetch(`/api/returns?${params.toString()}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || "Requests could not be loaded.");
      setRequests(Array.isArray(result.data) ? result.data : []);
      setPagination(result.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    } catch (fetchError) {
      if (fetchError.name !== "AbortError") {
        setError(fetchError.message || "Requests could not be loaded. Check your connection and try again.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page, reason, search, sortBy, sortOrder, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => loadRequests(controller.signal), 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadRequests, retryKey]);

  const loadStatusCounts = useCallback(async (signal) => {
    try {
      const entries = await Promise.all(STATUSES.map(async (requestStatus) => {
        const params = new URLSearchParams({ status: requestStatus, page: "1", pageSize: "1" });
        const response = await fetch(`/api/returns?${params.toString()}`, { signal });
        const result = await response.json();
        const total = result?.pagination?.total;
        if (!response.ok || !Number.isInteger(total) || total < 0) {
          throw new Error("Status totals are unavailable.");
        }
        return [requestStatus, total];
      }));
      if (!signal.aborted) {
        setStatusCounts(Object.fromEntries(entries));
        setStatusCountsError(false);
      }
    } catch (countError) {
      if (countError.name !== "AbortError" && !signal.aborted) {
        setStatusCounts(null);
        setStatusCountsError(true);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const refreshCounts = () => loadStatusCounts(controller.signal);
    const timeout = window.setTimeout(refreshCounts, 0);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCounts();
    };
    window.addEventListener("focus", refreshCounts);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      window.removeEventListener("focus", refreshCounts);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadStatusCounts, retryKey]);

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function selectStatus(nextStatus) {
    setStatus((current) => current === nextStatus ? "" : nextStatus);
    setPage(1);
  }

  function sort(field) {
    if (field === sortBy) setSortOrder((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortOrder(field === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  const start = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <Link aria-label="ReturnDesk home" className="brand-lockup" href="/">
          <span aria-hidden="true" className="brand-symbol">R</span>
          <span className="brand-name">ReturnDesk</span>
        </Link>
        <nav aria-label="Main navigation" className="main-navigation">
          <span aria-current="page" className="navigation-current">Returns</span>
        </nav>
      </header>

      <section aria-labelledby="requests-title" className="dashboard-content">
        <header className="page-intro">
          <div>
            <p className="eyebrow">RETURNS MANAGEMENT</p>
            <h1 id="requests-title">Return requests</h1>
            <p className="intro-copy">Review customer requests and keep every resolution moving.</p>
          </div>
          <Link className="primary-button new-request-button" href="/returns/new">New request</Link>
        </header>

        <section aria-labelledby="status-summary-title" className="status-summary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AT A GLANCE</p>
              <h2 id="status-summary-title">Requests by status</h2>
            </div>
            {status && (
              <button className="clear-filter-button" onClick={() => changeFilter(setStatus, "")} type="button">
                Show all requests
              </button>
            )}
          </div>
          <StatusSummary
            activeStatus={status}
            counts={statusCounts}
            error={statusCountsError}
            onRetry={() => setRetryKey((value) => value + 1)}
            onStatusSelect={selectStatus}
          />
        </section>

        <section aria-label="Return request list" className="requests-panel">
          <div className="panel-heading">
            <div>
              <h2>All requests</h2>
              <p>Search and organize customer returns.</p>
            </div>
            {!loading && !error && <span className="request-count">{pagination.total} requests</span>}
          </div>

          <div className="toolbar">
            <label className="search-field">
              <span aria-hidden="true" className="search-icon">
                <svg viewBox="0 0 20 20" focusable="false"><circle cx="8.8" cy="8.8" r="5.6" /><path d="m13 13 4 4" /></svg>
              </span>
              <span className="sr-only">Search by customer, order, or reference</span>
              <input
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search customer, order, or reference"
                type="search"
                value={searchInput}
              />
            </label>
            <label className="filter-control">
              <span className="sr-only">Filter by status</span>
              <select onChange={(event) => changeFilter(setStatus, event.target.value)} value={status}>
                <option value="">All statuses</option>
                {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="filter-control">
              <span className="sr-only">Filter by reason</span>
              <select onChange={(event) => changeFilter(setReason, event.target.value)} value={reason}>
                <option value="">All reasons</option>
                {REASONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="filter-control sort-select-control">
              <span className="sr-only">Sort requests by</span>
              <select
                onChange={(event) => {
                  setSortBy(event.target.value);
                  setSortOrder(event.target.value === "createdAt" ? "desc" : "asc");
                  setPage(1);
                }}
                value={sortBy}
              >
                {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}
              </select>
            </label>
            <button
              aria-label={`Change sort order, currently ${sortOrder === "asc" ? "ascending" : "descending"}`}
              className="direction-button"
              onClick={() => { setSortOrder((current) => current === "asc" ? "desc" : "asc"); setPage(1); }}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
              type="button"
            >{sortOrder === "asc" ? "↑" : "↓"}</button>
          </div>

          <div aria-live="polite" className="table-scroll" role="region" aria-label="Returns list table" tabIndex="0">
            <table className="returns-table">
              <colgroup>
                <col className="column-reference" />
                <col className="column-customer" />
                <col className="column-order" />
                <col className="column-item" />
                <col className="column-reason" />
                <col className="column-status" />
                <col className="column-date" />
              </colgroup>
              <thead>
                <tr>
                  <th aria-sort={sortBy === "reference" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"} scope="col"><SortButton field="reference" onSort={sort} sortBy={sortBy} sortOrder={sortOrder}>Reference</SortButton></th>
                  <th aria-sort={sortBy === "customerName" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"} scope="col"><SortButton field="customerName" onSort={sort} sortBy={sortBy} sortOrder={sortOrder}>Customer</SortButton></th>
                  <th aria-sort={sortBy === "orderNumber" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"} scope="col"><SortButton field="orderNumber" onSort={sort} sortBy={sortBy} sortOrder={sortOrder}>Order</SortButton></th>
                  <th scope="col">Item</th>
                  <th aria-sort={sortBy === "reason" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"} scope="col"><SortButton field="reason" onSort={sort} sortBy={sortBy} sortOrder={sortOrder}>Reason</SortButton></th>
                  <th aria-sort={sortBy === "status" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"} scope="col"><SortButton field="status" onSort={sort} sortBy={sortBy} sortOrder={sortOrder}>Status</SortButton></th>
                  <th aria-sort={sortBy === "createdAt" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"} scope="col"><SortButton field="createdAt" onSort={sort} sortBy={sortBy} sortOrder={sortOrder}>Created</SortButton></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="state-cell" colSpan="7"><span className="loading-mark" />Loading return requests…</td></tr>
                ) : error ? (
                  <tr><td className="state-cell error-state" colSpan="7">
                    <strong>We couldn’t load the requests</strong><span>{error}</span>
                    <button className="text-button" onClick={() => setRetryKey((value) => value + 1)} type="button">Try again</button>
                  </td></tr>
                ) : requests.length === 0 ? (
                  <tr><td className="state-cell empty-state" colSpan="7">
                    <strong>{search || status || reason ? "No matching requests" : "No return requests yet"}</strong>
                    <span>{search || status || reason ? "Try adjusting your search or filters." : "New requests will appear here when they are submitted."}</span>
                  </td></tr>
                ) : requests.map((request) => (
                  <tr key={request.id}>
                    <td className="reference-cell" title={request.reference}>
                      <Link className="reference-link" href={`/returns/${encodeURIComponent(request.reference)}`}>{request.reference}</Link>
                    </td>
                    <td title={`${request.customerName} · ${request.customerContact}`}>
                      <span className="primary-cell">{request.customerName}</span>
                      <span className="secondary-cell">{request.customerContact}</span>
                    </td>
                    <td className="order-cell" title={request.orderNumber}>{request.orderNumber}</td>
                    <td title={`${request.itemName} · Quantity ${request.quantity}`}>
                      <span className="primary-cell">{request.itemName}</span>
                      <span className="secondary-cell">Qty {request.quantity}</span>
                    </td>
                    <td title={request.reason}>{request.reason}</td>
                    <td><StatusBadge status={request.status} /></td>
                    <td className="date-cell" title={new Date(request.createdAt).toLocaleString()}>{formatDate(request.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && !error && (
            <footer className="pagination-bar">
              <span className="pagination-summary">Showing <strong>{start}–{end}</strong> of <strong>{pagination.total}</strong> requests</span>
              <div className="pagination-actions">
                <button disabled={pagination.totalPages === 0 || page <= 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button>
                <span aria-live="polite">
                  {pagination.totalPages > 0 ? `Page ${pagination.page} of ${pagination.totalPages}` : "No pages"}
                </span>
                <button disabled={pagination.totalPages === 0 || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
              </div>
            </footer>
          )}
        </section>
      </section>
    </main>
  );
}
