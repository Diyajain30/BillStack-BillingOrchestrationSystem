import React, { useState, useMemo, useEffect } from 'react';
import { backendApi } from '../services/api';
import { SubEventAnalytics } from './AnalyticsCharts';

function extractYear(ev) {
  if (
    ev?.eventYear !== null &&
    ev?.eventYear !== undefined &&
    !Number.isNaN(Number(ev.eventYear))
  ) {
    return Number(ev.eventYear);
  }
  if (typeof ev?.createdDate === 'string') {
    const parts = ev.createdDate.split('-');
    if (
      parts.length === 3 &&
      parts[2].length === 4 &&
      !Number.isNaN(Number(parts[2]))
    ) {
      return Number(parts[2]);
    }
  }
  return 0;
}

function getStatusBadgeClass(status) {
  if (status === 'APPROVED') return 'bg-sage-100 text-sage-800 border-sage-200';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export default function MasterEventExplorer({
  allEvents = [],
  bills = [],
  pendingStatus = null,
  onReviewBill,
  onAuditLogs,
  onDownloadPdf,
  reviewButtonLabel,
  renderSubEventActions,
}) {
  const [selectedMasterId, setSelectedMasterId] = useState(null);
  const [selectedSubEventId, setSelectedSubEventId] = useState(null);
  const [subEventDetail, setSubEventDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const masterEvents = useMemo(
    () =>
      allEvents.filter(
        (ev) => ev.parentEventId === null || ev.parentEventId === undefined
      ),
    [allEvents]
  );

  const subEvents = useMemo(
    () =>
      allEvents.filter(
        (ev) => ev.parentEventId !== null && ev.parentEventId !== undefined
      ),
    [allEvents]
  );

  const selectedMaster = useMemo(
    () =>
      masterEvents.find((m) => String(m.id) === String(selectedMasterId)) ||
      null,
    [masterEvents, selectedMasterId]
  );

  const selectedSubEvent = useMemo(
    () =>
      subEvents.find((s) => String(s.id) === String(selectedSubEventId)) ||
      null,
    [subEvents, selectedSubEventId]
  );

  const groupedByYear = useMemo(() => {
    const map = new Map();
    for (const m of masterEvents) {
      const yr = extractYear(m);
      const key = yr > 0 ? yr : 'Undated';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === 'Undated') return 1;
        if (b === 'Undated') return -1;
        return Number(b) - Number(a);
      })
      .map(([year, list]) => ({
        year,
        events: list.sort((x, y) => Number(y.id || 0) - Number(x.id || 0)),
      }));
  }, [masterEvents]);

  useEffect(() => {
    if (!selectedSubEventId) {
      setSubEventDetail(null);
      return;
    }
    let active = true;
    setLoadingDetail(true);
    backendApi
      .get(`/subevents/${selectedSubEventId}`)
      .then((res) => {
        if (active) setSubEventDetail(res.data);
      })
      .catch(() => {
        if (active) setSubEventDetail(null);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSubEventId, allEvents, bills]);

  const getSubEventsForMaster = (masterId) =>
    subEvents.filter((se) => String(se.parentEventId) === String(masterId));

  const getBillsForSubEvent = (se) =>
    bills.filter(
      (b) =>
        (b.subEventId !== null &&
          b.subEventId !== undefined &&
          String(b.subEventId) === String(se.id)) ||
        (b.eventName &&
          se.name &&
          b.eventName.toLowerCase().trim() === se.name.toLowerCase().trim())
    );

  const getApprovedSpendForSubEvent = (se) =>
    getBillsForSubEvent(se)
      .filter((b) => b.status === 'APPROVED')
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const getApprovedSpendForMaster = (masterId) =>
    getSubEventsForMaster(masterId).reduce(
      (sum, se) => sum + getApprovedSpendForSubEvent(se),
      0
    );

  const getPendingCountForSubEvent = (se) => {
    if (!pendingStatus) return 0;
    return getBillsForSubEvent(se).filter((b) => b.status === pendingStatus)
      .length;
  };

  const getPendingCountForMaster = (masterId) => {
    if (!pendingStatus) return 0;
    return getSubEventsForMaster(masterId).reduce(
      (sum, se) => sum + getPendingCountForSubEvent(se),
      0
    );
  };

  // ─── LEVEL 3: SINGLE UNIFIED BOX (SUB-EVENT DETAILS, VISUALS & BILLS) ─────
  if (selectedMaster && selectedSubEvent) {
    const detail = subEventDetail || selectedSubEvent;
    const folderBills = getBillsForSubEvent(selectedSubEvent);
    const cap = Number(detail.budgetCap) || 0;
    const advance = Number(detail.advanceDisbursed) || 0;
    const approvedSpent = getApprovedSpendForSubEvent(selectedSubEvent);
    const balance = cap - approvedSpent;
    const masterYear = extractYear(selectedMaster) || 'Year';

    return (
      <section className="bg-white border border-sage-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedSubEventId(null)}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-sage-900 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>&larr;</span>
              <span>Back to {selectedMaster.name}</span>
            </button>

            <nav className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubEventId(null);
                  setSelectedMasterId(null);
                }}
                className="hover:text-sage-800 hover:underline cursor-pointer"
              >
                Master Events
              </button>
              <span>/</span>
              <span>{masterYear}</span>
              <span>/</span>
              <button
                type="button"
                onClick={() => setSelectedSubEventId(null)}
                className="hover:text-sage-800 hover:underline cursor-pointer"
              >
                {selectedMaster.name}
              </button>
              <span>/</span>
              <span className="font-semibold text-stone-900">{detail.name}</span>
            </nav>
          </div>

          <span className="text-[11px] font-medium px-2.5 py-1 bg-sage-100 border border-sage-200 text-sage-800 rounded-md">
            {detail.department || 'Institutional'} &middot;{' '}
            {detail.status || 'OPEN'}
          </span>
        </div>

        <div className="px-6 py-5 border-b border-sage-100 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-stone-500">Budget Cap</p>
              <p className="text-lg font-semibold text-stone-900 mt-0.5">
                INR {cap.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Advance Disbursed</p>
              <p className="text-lg font-semibold text-stone-900 mt-0.5">
                INR {advance.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Approved Expenditure</p>
              <p className="text-lg font-semibold text-sage-800 mt-0.5">
                INR {approvedSpent.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Remaining Balance</p>
              <p
                className={`text-lg font-semibold mt-0.5 ${
                  balance < 0 ? 'text-rose-700' : 'text-stone-900'
                }`}
              >
                INR {balance.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-sage-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs flex-1">
              <div>
                <span className="text-stone-500 block mb-0.5">
                  Assigned Faculty Head(s)
                </span>
                <span className="font-medium text-stone-900">
                  {loadingDetail
                    ? 'Loading...'
                    : detail.facultyHeads?.length > 0
                    ? detail.facultyHeads
                        .map(
                          (f) => `${f.name} (${f.institutionalId || f.username})`
                        )
                        .join(', ')
                    : 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block mb-0.5">
                  Assigned Student Coordinator(s)
                </span>
                <span className="font-medium text-stone-900">
                  {loadingDetail
                    ? 'Loading...'
                    : detail.coordinators?.length > 0
                    ? detail.coordinators
                        .map(
                          (c) => `${c.name} (${c.institutionalId || c.username})`
                        )
                        .join(', ')
                    : 'Unassigned'}
                </span>
              </div>
            </div>

            {typeof renderSubEventActions === 'function' && (
              <div className="shrink-0">
                {renderSubEventActions(detail, approvedSpent)}
              </div>
            )}
          </div>
        </div>

        {/* Sub-Event Visuals inside Drill-Down */}
        <div className="px-6 py-5 border-b border-sage-100 bg-sage-50/25">
          <SubEventAnalytics allocatedBudget={cap} bills={folderBills} />
        </div>

        <div className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-stone-900">
            Bills in {detail.name} ({folderBills.length})
          </h3>

          {folderBills.length === 0 ? (
            <div className="py-10 text-center text-xs text-stone-500 bg-sage-50/50 border border-sage-200/80 rounded-lg">
              No bills uploaded for this sub-event yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-sage-200 rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-sage-50 text-stone-600 text-xs font-medium border-b border-sage-200">
                  <tr>
                    <th className="py-2.5 px-4">Invoice No</th>
                    <th className="py-2.5 px-4">Vendor</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100 text-stone-800">
                  {folderBills.map((b) => {
                    const label =
                      typeof reviewButtonLabel === 'function'
                        ? reviewButtonLabel(b)
                        : 'View';
                    const isPendingAction =
                      pendingStatus && b.status === pendingStatus;

                    return (
                      <tr key={b.id} className="hover:bg-sage-50/40">
                        <td className="py-2.5 px-4 font-mono text-xs text-stone-600">
                          {b.billNo || b.id}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-stone-900">
                          {b.vendorName}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-stone-500">
                          {b.billDate || 'N/A'}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-stone-900">
                          INR {Number(b.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getStatusBadgeClass(
                              b.status
                            )}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            {typeof onReviewBill === 'function' && (
                              <button
                                type="button"
                                onClick={() => onReviewBill(b)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                                  isPendingAction
                                    ? 'bg-sage-600 hover:bg-sage-700 text-white'
                                    : 'bg-white hover:bg-sage-50 border border-sage-200 text-stone-700'
                                }`}
                              >
                                {label}
                              </button>
                            )}
                            {typeof onDownloadPdf === 'function' && (
                              <button
                                type="button"
                                onClick={() => onDownloadPdf(b)}
                                className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-sage-800 rounded-md text-xs font-medium cursor-pointer"
                              >
                                PDF
                              </button>
                            )}
                            {typeof onAuditLogs === 'function' && (
                              <button
                                type="button"
                                onClick={() => onAuditLogs(b.id)}
                                className="px-2.5 py-1 bg-white hover:bg-sage-50 border border-sage-200 text-stone-700 rounded-md text-xs font-medium cursor-pointer"
                              >
                                Logs
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ─── LEVEL 2: SINGLE UNIFIED BOX (MASTER EVENT → SUB-EVENTS) ──────────────
  if (selectedMaster) {
    const childSubEvents = getSubEventsForMaster(selectedMaster.id);
    const masterCap = Number(selectedMaster.budgetCap) || 0;
    const masterApprovedSpent = getApprovedSpendForMaster(selectedMaster.id);
    const masterRemaining = masterCap - masterApprovedSpent;
    const masterYear = extractYear(selectedMaster) || 'Year';

    return (
      <section className="bg-white border border-sage-200 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-6 py-4 border-b border-sage-100 bg-sage-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedSubEventId(null);
                setSelectedMasterId(null);
              }}
              className="px-3 py-1.5 bg-white hover:bg-sage-50 border border-sage-200 text-sage-900 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>&larr;</span>
              <span>Back to Master Events</span>
            </button>

            <nav className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
              <button
                type="button"
                onClick={() => setSelectedMasterId(null)}
                className="hover:text-sage-800 hover:underline cursor-pointer"
              >
                Master Events
              </button>
              <span>/</span>
              <span>{masterYear}</span>
              <span>/</span>
              <span className="font-semibold text-stone-900">
                {selectedMaster.name}
              </span>
            </nav>
          </div>

          <span className="text-[11px] font-medium px-2.5 py-1 bg-sage-100 border border-sage-200 text-sage-800 rounded-md">
            {selectedMaster.wingName || 'Master Event'} &middot;{' '}
            {childSubEvents.length} Sub-Event
            {childSubEvents.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="px-6 py-4 border-b border-sage-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-stone-500">Master Budget Cap</p>
            <p className="text-lg font-semibold text-stone-900 mt-0.5">
              INR {masterCap.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Total Approved Spend</p>
            <p className="text-lg font-semibold text-sage-800 mt-0.5">
              INR {masterApprovedSpent.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Remaining Master Balance</p>
            <p
              className={`text-lg font-semibold mt-0.5 ${
                masterRemaining < 0 ? 'text-rose-700' : 'text-stone-900'
              }`}
            >
              INR {masterRemaining.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-stone-900">
              Sub-Events under {selectedMaster.name} ({childSubEvents.length})
            </h3>
            <span className="text-xs text-stone-400">
              Click a sub-event folder to inspect details &amp; bills
            </span>
          </div>

          {childSubEvents.length === 0 ? (
            <div className="py-10 text-center bg-sage-50/50 border border-sage-200/80 rounded-lg text-xs text-stone-500">
              No sub-events created under this Master Event yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {childSubEvents.map((se) => {
                const cap = Number(se.budgetCap) || 0;
                const spent = getApprovedSpendForSubEvent(se);
                const balance = cap - spent;
                const billCount = getBillsForSubEvent(se).length;
                const pendingCount = getPendingCountForSubEvent(se);

                return (
                  <button
                    key={se.id}
                    type="button"
                    onClick={() => setSelectedSubEventId(se.id)}
                    className="text-left bg-sage-50/40 hover:bg-sage-50 border border-sage-200 hover:border-sage-400 p-5 rounded-xl space-y-3.5 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sage-100 border border-sage-200 text-sage-800">
                          {se.department || 'Institutional'}
                        </span>
                        {pendingCount > 0 ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                            {pendingCount} pending
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-500">
                            {billCount} bill{billCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-stone-900">
                        {se.name}
                      </h4>
                    </div>

                    <div className="w-full bg-white p-3 rounded-lg border border-sage-100 space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-600">
                        <span>Budget Cap</span>
                        <span className="font-medium text-stone-900">
                          INR {cap.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Approved Spend</span>
                        <span className="font-medium text-sage-800">
                          INR {spent.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600 pt-1.5 border-t border-sage-100">
                        <span>Balance</span>
                        <span className="font-semibold text-stone-900">
                          INR {balance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ─── LEVEL 1: MASTER EVENTS GROUPED BY YEAR (DESCENDING) ──────────────────
  return (
    <section className="space-y-6">
      {groupedByYear.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-sage-200 text-center text-xs text-stone-500">
          No Master Events found yet.
        </div>
      ) : (
        groupedByYear.map(({ year, events: yearEvents }) => (
          <div
            key={year}
            className="bg-white p-6 rounded-xl border border-sage-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-sage-100">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-stone-900">{year}</h2>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-sage-100 text-sage-800 border border-sage-200">
                  {yearEvents.length} Master Event
                  {yearEvents.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className="text-xs text-stone-400">
                Click a Master Event to view its sub-events
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {yearEvents.map((m) => {
                const subCount = getSubEventsForMaster(m.id).length;
                const cap = Number(m.budgetCap) || 0;
                const spent = getApprovedSpendForMaster(m.id);
                const pendingCount = getPendingCountForMaster(m.id);

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMasterId(m.id);
                      setSelectedSubEventId(null);
                    }}
                    className="text-left bg-sage-50/40 hover:bg-sage-50 border border-sage-200 hover:border-sage-400 p-5 rounded-xl space-y-3.5 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sage-100 border border-sage-200 text-sage-800">
                          {m.wingName || 'Master Event'}
                        </span>
                        {pendingCount > 0 ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                            {pendingCount} pending
                          </span>
                        ) : (
                          <span className="text-[11px] text-stone-500 font-mono">
                            {m.createdDate || year}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-stone-900">
                        {m.name}
                      </h3>
                    </div>

                    <div className="w-full bg-white p-3 rounded-lg border border-sage-100 space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-600">
                        <span>Sub-Events</span>
                        <span className="font-medium text-stone-900">
                          {subCount}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600">
                        <span>Budget Cap</span>
                        <span className="font-medium text-stone-900">
                          INR {cap.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-stone-600 pt-1.5 border-t border-sage-100">
                        <span>Approved Spend</span>
                        <span className="font-semibold text-sage-800">
                          INR {spent.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}